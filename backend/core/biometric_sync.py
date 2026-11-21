"""
Biometric Integration — Phase 2: Sync Engine + Continuous Worker

Data flow:
  idms.dbo.tbl_realtime_glog  →  biometric_raw_logs  →  attendance (Phase 4)

Two execution modes
───────────────────
BiometricSyncEngine  — stateless, used by the manual "Sync Now" REST endpoint.
BiometricWorker      — persistent background thread; polls every POLL_INTERVAL_S
                       seconds with persistent DB connections and log throttling.

Idempotency guarantee
─────────────────────
biometric_raw_logs has UNIQUE KEY uq_punch (enroll_id, device_id, punch_time).
All inserts use INSERT IGNORE, so fetching the same punch twice — which the
60-second overlap window intentionally allows — never creates duplicates.
"""

import json as _json
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Optional

import mysql.connector
try:
    import pyodbc
except ImportError:  # optional: only needed for the legacy IDMS biometric sync
    import types as _types
    pyodbc = _types.SimpleNamespace(Connection=object, connect=None)  # stub so annotations still load

from backend.config import DB_CONFIG

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
IDMS_SERVER   = os.getenv("IDMS_SERVER",   r"DESKTOP-EQ55Q8H\SQLEXPRESS")
IDMS_DATABASE = os.getenv("IDMS_DATABASE", "idms")
IDMS_USER     = os.getenv("IDMS_USER",     "sa")
IDMS_PASSWORD = os.getenv("IDMS_PASSWORD", "sss")
IDMS_DRIVER   = os.getenv("IDMS_DRIVER",   "ODBC Driver 17 for SQL Server")

DEVICE_IDS = [
    d.strip()
    for d in os.getenv("TIMEWATCH_DEVICE_IDS", "C2622C67A7241B36").split(",")
    if d.strip()
]

DEFAULT_LOOKBACK_HOURS = int(os.getenv("TIMEWATCH_LOOKBACK_HOURS", "2"))

# Worker timing constants
POLL_INTERVAL_S     = 3    # how often to query IDMS for new punches
PROCESS_INTERVAL_S  = 30   # minimum gap between processor runs
HEARTBEAT_INTERVAL_S= 30   # how often to write a sync_log heartbeat
IDLE_LOG_INTERVAL_S = 300  # throttle "no new punches" log to once per 5 min
OVERLAP_SECONDS     = 60   # look this far behind last known punch (clock-skew buffer)


# ── Low-level connection factories (used by both classes) ─────────────────────

def _get_hrms_db() -> mysql.connector.MySQLConnection:
    return mysql.connector.connect(**DB_CONFIG)


def _get_idms_db() -> pyodbc.Connection:
    """
    IDMS is the biometric device vendor's own database — it runs on SQL Server,
    not our MySQL stack, and we only ever read from it. Everything we own
    (biometric_raw_logs, attendance, etc.) lives in MySQL via _get_hrms_db().
    """
    conn_str = (
        f"DRIVER={{{IDMS_DRIVER}}};"
        f"SERVER={IDMS_SERVER};"
        f"DATABASE={IDMS_DATABASE};"
        f"UID={IDMS_USER};"
        f"PWD={IDMS_PASSWORD};"
        "TrustServerCertificate=yes;"
        "Connection Timeout=10;"
    )
    return pyodbc.connect(conn_str, timeout=10)


# ─────────────────────────────────────────────────────────────────────────────
# BiometricWorker — continuous 3-second polling loop
# ─────────────────────────────────────────────────────────────────────────────

class BiometricWorker:
    """
    Runs in a daemon background thread. Maintains persistent connections to
    both IDMS (SQL Server) and HRMS (MySQL) and reconnects transparently on
    error so the FastAPI process never needs to restart the worker.

    Per-cycle work (every POLL_INTERVAL_S seconds):
      1. Ensure IDMS + HRMS connections are alive (ping / reconnect if needed).
      2. For each configured device: query tbl_realtime_glog for io_time values
         newer than (last_known_punch - OVERLAP_SECONDS).
      3. Bulk INSERT IGNORE new punches into biometric_raw_logs.
      4. Update in-memory high-water mark per device.

    Periodic work (every PROCESS_INTERVAL_S seconds):
      - Call process_pending_punches() to convert raw logs → attendance.
      - Write a sync_log heartbeat row (so the dashboard shows a fresh timestamp).
    """

    def __init__(self):
        self._stop      = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # High-water mark: latest io_time confirmed stored, per device
        self._last_punch: dict[str, datetime] = {}

        # Throttle state
        self._idle_log_at:   dict[str, float] = {}   # last "no new punches" log
        self._last_process:  float = 0.0              # last process_pending run
        self._last_heartbeat:float = 0.0              # last sync_log write

        # Accumulated new-punch count since last heartbeat
        self._cycle_new: dict[str, int] = {}

        # Persistent connections — lazily created, auto-reconnected
        self._hrms: Optional[mysql.connector.MySQLConnection] = None
        self._idms: Optional[pyodbc.Connection]                                          = None

    # ── Connection management ─────────────────────────────────────────────────

    def _hrms_conn(self) -> mysql.connector.MySQLConnection:
        """Returns a live HRMS MySQL connection, reconnecting if needed."""
        try:
            if self._hrms and self._hrms.is_connected():
                self._hrms.ping(reconnect=True, attempts=1, delay=0)
                return self._hrms
        except Exception:
            pass
        self._hrms = _get_hrms_db()
        logger.info("[WORKER] HRMS MySQL connection (re)established")
        return self._hrms

    def _idms_conn(self) -> pyodbc.Connection:
        """Returns a live IDMS SQL Server connection, reconnecting if needed."""
        if self._idms is not None:
            try:
                # Lightweight liveness probe — explicit cursor to avoid chaining issues
                _cur = self._idms.cursor()
                _cur.execute("SELECT 1")
                _cur.close()
                return self._idms
            except Exception:
                try:
                    self._idms.close()
                except Exception:
                    pass
                self._idms = None
        self._idms = _get_idms_db()
        logger.info("[WORKER] IDMS SQL Server connection (re)established")
        return self._idms

    # ── Startup: seed high-water mark from existing raw_logs ─────────────────

    def _init_high_water(self, device_id: str) -> datetime:
        """
        Reads the latest punch_time already stored for this device.
        Falls back to DEFAULT_LOOKBACK_HOURS ago so the first run catches
        any punches that arrived before the worker started.
        """
        fallback = datetime.now() - timedelta(hours=DEFAULT_LOOKBACK_HOURS)
        try:
            conn   = self._hrms_conn()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT MAX(punch_time) FROM biometric_raw_logs WHERE device_id = %s",
                (device_id,),
            )
            row = cursor.fetchone()
            cursor.close()
            if row and row[0]:
                logger.info(
                    "[WORKER] device=%s — high-water seeded from DB: %s",
                    device_id, row[0],
                )
                return row[0]
        except Exception as exc:
            logger.warning("[WORKER] Could not read high-water mark: %s", exc)
        logger.info(
            "[WORKER] device=%s — no existing punches; looking back %dh",
            device_id, DEFAULT_LOOKBACK_HOURS,
        )
        return fallback

    # ── Per-cycle: fetch from IDMS ────────────────────────────────────────────

    def _fetch_punches(self, device_id: str, from_dt: datetime, to_dt: datetime) -> list[dict]:
        """
        Queries tbl_realtime_glog for valid punches in [from_dt, to_dt].
        Raises on connection error so the caller can flag a reconnect.
        """
        conn   = self._idms_conn()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT user_id, io_time, io_mode, device_id
            FROM   tbl_realtime_glog
            WHERE  device_id = ?
              AND  io_time   >= ?
              AND  io_time   <= ?
              AND  user_id   >  0
            ORDER  BY io_time ASC
            """,
            device_id, from_dt, to_dt,
        )
        rows = cursor.fetchall()
        cursor.close()
        return [
            {
                "user_id":   str(r[0]),
                "io_time":   r[1],
                "io_mode":   str(r[2]) if r[2] else None,
                "device_id": r[3],
            }
            for r in rows
        ]

    # ── Per-cycle: bulk INSERT IGNORE into biometric_raw_logs ────────────────

    def _insert_punches(self, records: list[dict]) -> tuple[int, int]:
        """
        Bulk-inserts using executemany + INSERT IGNORE.
        The UNIQUE KEY (enroll_id, device_id, punch_time) makes this fully
        idempotent — the same punch fetched in overlapping windows is silently
        skipped, never duplicated.
        Returns (inserted, skipped).
        """
        if not records:
            return 0, 0

        conn   = self._hrms_conn()
        cursor = conn.cursor()

        params = [
            (
                rec["user_id"],
                rec["device_id"],
                rec["io_time"],
                _json.dumps({
                    "user_id": rec["user_id"],
                    "io_mode": rec["io_mode"],
                    "io_time": rec["io_time"].isoformat() if rec["io_time"] else None,
                }),
            )
            for rec in records
        ]

        cursor.executemany(
            """INSERT IGNORE INTO biometric_raw_logs
               (enroll_id, device_id, punch_time, punch_type, raw_payload, source)
               VALUES (%s, %s, %s, 'UNKNOWN', %s, 'TIMEWATCH')""",
            params,
        )
        conn.commit()

        # executemany rowcount is the total affected rows (all INSERTs minus IGNOREd)
        inserted = cursor.rowcount if cursor.rowcount >= 0 else 0
        skipped  = len(records) - inserted
        cursor.close()
        return inserted, skipped

    # ── Periodic: write sync_log heartbeat ───────────────────────────────────

    def _write_heartbeat(self, device_id: str, new_total: int, status: str = "SUCCESS"):
        """
        Writes (or updates) the latest biometric_sync_log row for this device.
        Called every HEARTBEAT_INTERVAL_S so the dashboard always shows a
        recent timestamp without flooding the table with one row per 3-second cycle.
        """
        try:
            conn   = self._hrms_conn()
            cursor = conn.cursor()
            now    = datetime.now()
            cursor.execute(
                """INSERT INTO biometric_sync_log
                       (device_id, sync_start, sync_end, records_fetched,
                        records_new, status, error_detail)
                   VALUES (%s, %s, %s, %s, %s, %s, NULL)
                   ON DUPLICATE KEY UPDATE
                       sync_end        = VALUES(sync_end),
                       records_fetched = VALUES(records_fetched),
                       records_new     = VALUES(records_new),
                       status          = VALUES(status),
                       error_detail    = NULL""",
                (device_id, now, now, new_total, new_total, status),
            )
            conn.commit()
            cursor.close()
        except Exception as exc:
            logger.warning("[WORKER] Failed to write sync heartbeat: %s", exc)

    # ── One full poll cycle ───────────────────────────────────────────────────

    def _run_cycle(self):
        now = time.monotonic()

        for device_id in DEVICE_IDS:
            # Seed high-water mark on first encounter
            if device_id not in self._last_punch:
                self._last_punch[device_id]    = self._init_high_water(device_id)
                self._cycle_new[device_id]     = 0

            from_dt = self._last_punch[device_id] - timedelta(seconds=OVERLAP_SECONDS)
            to_dt   = datetime.now()

            try:
                records  = self._fetch_punches(device_id, from_dt, to_dt)
                inserted, skipped = self._insert_punches(records)

                if inserted > 0:
                    self._cycle_new[device_id] += inserted
                    # Advance high-water mark to the latest punch we just stored
                    max_time = max(r["io_time"] for r in records)
                    self._last_punch[device_id] = max_time
                    logger.info(
                        "[WORKER] device=%s — %d new punch(es) stored"
                        " (skipped %d duplicates) | window=%s→%s",
                        device_id, inserted, skipped,
                        from_dt.strftime("%H:%M:%S"), to_dt.strftime("%H:%M:%S"),
                    )
                else:
                    # Throttle "nothing new" to once per IDLE_LOG_INTERVAL_S
                    last = self._idle_log_at.get(device_id, 0.0)
                    if now - last >= IDLE_LOG_INTERVAL_S:
                        logger.debug(
                            "[WORKER] device=%s — no new punches (last known: %s)",
                            device_id,
                            self._last_punch[device_id].strftime("%Y-%m-%d %H:%M:%S"),
                        )
                        self._idle_log_at[device_id] = now

            except Exception as exc:
                # Mark connection as dead so next cycle reconnects
                logger.error("[WORKER] device=%s cycle error: %s", device_id, exc)
                self._idms = None   # force reconnect next tick

        # ── Periodic: process + heartbeat ─────────────────────────────────
        if now - self._last_heartbeat >= HEARTBEAT_INTERVAL_S:
            for device_id in DEVICE_IDS:
                accumulated = self._cycle_new.get(device_id, 0)
                self._write_heartbeat(device_id, accumulated)
                self._cycle_new[device_id] = 0
            print(
                f"[Sync Loop Heartbeat] - Processed up to: "
                f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
                f"devices={DEVICE_IDS}"
            )
            self._last_heartbeat = now

        if now - self._last_process >= PROCESS_INTERVAL_S:
            try:
                from backend.core.biometric_processor import process_pending_punches
                result = process_pending_punches()
                if any(result.get(k, 0) > 0 for k in
                       ("auto_provisioned", "attendance_created", "attendance_updated")):
                    logger.info(
                        "[WORKER] Processor — provisioned=%d created=%d updated=%d"
                        " skipped=%d errors=%d",
                        result.get("auto_provisioned",   0),
                        result.get("attendance_created", 0),
                        result.get("attendance_updated", 0),
                        result.get("skipped",            0),
                        result.get("errors",             0),
                    )
            except Exception as exc:
                logger.error("[WORKER] Processor error: %s", exc)
            self._last_process = now

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _loop(self):
        logger.info(
            "[WORKER] Started — poll=%ds  process=%ds  idle_log=%ds | devices=%s",
            POLL_INTERVAL_S, PROCESS_INTERVAL_S, IDLE_LOG_INTERVAL_S, DEVICE_IDS,
        )

        # One-time IDMS config check before the hot loop starts
        try:
            from backend.core.biometric_processor import run_startup_diagnostic
            run_startup_diagnostic()
        except Exception as exc:
            logger.warning("[WORKER] Startup diagnostic failed (non-fatal): %s", exc)

        while not self._stop.is_set():
            t0 = time.monotonic()
            try:
                self._run_cycle()
            except Exception as exc:
                logger.error("[WORKER] Unhandled cycle exception: %s", exc)

            elapsed = time.monotonic() - t0
            sleep_for = max(0.0, POLL_INTERVAL_S - elapsed)
            # Use wait() instead of sleep() so stop() wakes us immediately
            self._stop.wait(timeout=sleep_for)

        logger.info("[WORKER] Stopped cleanly.")

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        if self._thread and self._thread.is_alive():
            logger.warning("[WORKER] Already running — ignoring start() call")
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name="biometric-worker",
            daemon=True,   # killed automatically when the FastAPI process exits
        )
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=10)
        # Close persistent connections
        for conn, label in ((self._hrms, "HRMS"), (self._idms, "IDMS")):
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
        self._hrms = self._idms = None
        logger.info("[WORKER] Connections closed.")

    def force_resync(self, hours: int = 24) -> dict:
        """
        Resets the in-memory high-water mark for every device so the next poll
        cycle re-fetches punches from `hours` ago.

        Use this after:
          • Fixing a broken IDMS table config (e.g. Userdetail → UserInfo)
          • Clearing stuck 'Unknown' placeholder mappings
          • Any gap in the sync log that needs to be back-filled

        Thread-safe: the high-water dict is replaced between cycles; the
        running loop reads it at the start of each 3-second iteration.

        Returns a dict describing the reset window for logging/API responses.
        """
        cutoff = datetime.now() - timedelta(hours=hours)
        before = dict(self._last_punch)  # snapshot for the log

        # Clear all per-device marks — _init_high_water() reseeds from DB on
        # the next cycle, but will find nothing newer than `cutoff` if we
        # also forcibly set the mark below.
        for device_id in list(self._last_punch.keys()):
            self._last_punch[device_id] = cutoff
        # Also clear any devices that haven't seeded yet so they start at cutoff
        for device_id in DEVICE_IDS:
            self._last_punch[device_id] = cutoff

        print(
            f"[WORKER] force_resync called — high-water reset to {cutoff.strftime('%Y-%m-%d %H:%M:%S')} "
            f"(last {hours}h) for devices: {list(self._last_punch.keys())}"
        )
        logger.info(
            "[WORKER] force_resync: high-water reset to %s for %d device(s). "
            "Previous marks: %s",
            cutoff, len(self._last_punch),
            {k: v.strftime("%H:%M:%S") for k, v in before.items()},
        )
        return {
            "reset_to":      cutoff.isoformat(),
            "lookback_hours": hours,
            "devices":        list(self._last_punch.keys()),
        }


# ─────────────────────────────────────────────────────────────────────────────
# BiometricSyncEngine — stateless, used by the manual trigger REST endpoint
# ─────────────────────────────────────────────────────────────────────────────

class BiometricSyncEngine:
    """
    One-shot sync used by POST /api/biometric/sync/trigger.
    Opens fresh connections per call — fine for infrequent manual use.
    Includes diagnostic queries that would be too noisy in the hot loop.
    """

    def _get_last_sync_time(self, device_id: str) -> datetime:
        fallback = datetime.now() - timedelta(hours=DEFAULT_LOOKBACK_HOURS)
        try:
            conn   = _get_hrms_db()
            cursor = conn.cursor()
            cursor.execute(
                """SELECT sync_start FROM biometric_sync_log
                   WHERE device_id = %s AND status = 'SUCCESS'
                   ORDER BY sync_start DESC LIMIT 1""",
                (device_id,),
            )
            row = cursor.fetchone()
            conn.close()
            return (row[0] - timedelta(hours=2)) if row else fallback
        except Exception as exc:
            logger.warning("Could not read last sync time: %s", exc)
            return fallback

    def fetch_logs(self, device_id: str, from_dt: datetime, to_dt: datetime) -> list[dict]:
        logger.info(
            "[SYNC] Manual trigger — device=%s | %s → %s",
            device_id,
            from_dt.strftime("%Y-%m-%d %H:%M:%S"),
            to_dt.strftime("%Y-%m-%d %H:%M:%S"),
        )

        try:
            conn = _get_idms_db()
            logger.info("[SYNC] IDMS connection OK")
        except Exception as exc:
            logger.error("[SYNC] IDMS connection FAILED: %s", exc)
            raise

        cursor = conn.cursor()

        # Diagnostic: only runs on manual trigger, not in the hot loop
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM tbl_realtime_glog"
                " WHERE device_id=? AND io_time>=? AND io_time<=? AND user_id>0",
                device_id, from_dt, to_dt,
            )
            valid_count = cursor.fetchone()[0]
            logger.info("[SYNC] IDMS valid punches in window: %d", valid_count)
            if valid_count == 0:
                cursor.execute("SELECT DISTINCT device_id FROM tbl_realtime_glog")
                known = [str(r[0]) for r in cursor.fetchall()]
                logger.warning(
                    "[SYNC] 0 rows for device_id=%r — known IDs in IDMS: %s",
                    device_id, known,
                )
        except Exception as exc:
            logger.warning("[SYNC] Diagnostic query failed (non-fatal): %s", exc)

        cursor.execute(
            """SELECT user_id, io_time, io_mode, device_id
               FROM   tbl_realtime_glog
               WHERE  device_id = ?
                 AND  io_time   >= ?
                 AND  io_time   <= ?
                 AND  user_id   >  0
               ORDER  BY io_time ASC""",
            device_id, from_dt, to_dt,
        )
        rows = cursor.fetchall()
        conn.close()

        records = [
            {
                "user_id":   str(r[0]),
                "io_time":   r[1],
                "io_mode":   str(r[2]) if r[2] else None,
                "device_id": r[3],
            }
            for r in rows
        ]
        if records:
            logger.info(
                "[SYNC] Fetched %d punch(es) — first=%s last=%s",
                len(records), records[0]["io_time"], records[-1]["io_time"],
            )
        else:
            logger.warning("[SYNC] 0 punches in window for device=%s", device_id)
        return records

    def insert_raw_logs(self, records: list[dict]) -> tuple[int, int]:
        if not records:
            return 0, 0

        conn     = _get_hrms_db()
        cursor   = conn.cursor()
        inserted = skipped = 0

        for rec in records:
            try:
                cursor.execute(
                    """INSERT IGNORE INTO biometric_raw_logs
                       (enroll_id, device_id, punch_time, punch_type, raw_payload, source)
                       VALUES (%s, %s, %s, 'UNKNOWN', %s, 'TIMEWATCH')""",
                    (
                        rec["user_id"],
                        rec["device_id"],
                        rec["io_time"],
                        _json.dumps({
                            "user_id": rec["user_id"],
                            "io_mode": rec["io_mode"],
                            "io_time": rec["io_time"].isoformat() if rec["io_time"] else None,
                        }),
                    ),
                )
                if cursor.rowcount == 1:
                    inserted += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.error(
                    "[SYNC] Insert failed — enroll=%s time=%s: %s",
                    rec.get("user_id"), rec.get("io_time"), exc,
                )

        conn.commit()
        conn.close()
        logger.info("[SYNC] Wrote %d new, skipped %d duplicates", inserted, skipped)
        return inserted, skipped

    def _write_sync_log(
        self,
        device_id: str, sync_start: datetime, sync_end: datetime,
        fetched: int, new: int, status: str, error: str = "",
    ):
        conn   = _get_hrms_db()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO biometric_sync_log
                   (device_id, sync_start, sync_end, records_fetched,
                    records_new, status, error_detail)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                   sync_end        = VALUES(sync_end),
                   records_fetched = VALUES(records_fetched),
                   records_new     = VALUES(records_new),
                   status          = VALUES(status),
                   error_detail    = VALUES(error_detail)""",
            (device_id, sync_start, sync_end, fetched, new, status, error or None),
        )
        conn.commit()
        conn.close()

    def run_sync(self, device_id: str, lookback_hours: Optional[int] = None) -> dict:
        sync_start = datetime.now()
        from_dt    = self._get_last_sync_time(device_id)
        to_dt      = datetime.now()
        if lookback_hours is not None:
            from_dt = datetime.now() - timedelta(hours=lookback_hours)

        self._write_sync_log(device_id, sync_start, sync_start, 0, 0, "RUNNING")
        try:
            raw_logs         = self.fetch_logs(device_id, from_dt, to_dt)
            inserted, skipped = self.insert_raw_logs(raw_logs)
            self._write_sync_log(
                device_id, sync_start, datetime.now(),
                len(raw_logs), inserted, "SUCCESS",
            )
            return {
                "device_id":       device_id,
                "status":          "SUCCESS",
                "from":            from_dt.isoformat(),
                "to":              to_dt.isoformat(),
                "records_fetched": len(raw_logs),
                "records_new":     inserted,
                "duplicates":      skipped,
            }
        except Exception as exc:
            msg = str(exc)
            self._write_sync_log(device_id, sync_start, datetime.now(), 0, 0, "FAILED", msg)
            logger.error("[SYNC] device=%s FAILED: %s", device_id, msg)
            return {"device_id": device_id, "status": "FAILED", "error": msg}

    def run_all_devices(self) -> list[dict]:
        results = []
        for device_id in DEVICE_IDS:
            result = self.run_sync(device_id)
            results.append(result)
        try:
            from backend.core.biometric_processor import process_pending_punches
            proc = process_pending_punches()
            logger.info("[SYNC] Processor: %s", proc)
            for r in results:
                r["processor"] = proc
        except Exception as exc:
            logger.error("[SYNC] Processor failed: %s", exc)
        return results


# ─────────────────────────────────────────────────────────────────────────────
# Public lifecycle API — called by app.py startup/shutdown events
# ─────────────────────────────────────────────────────────────────────────────

_worker: Optional[BiometricWorker] = None


def start_biometric_scheduler():
    """Starts the continuous BiometricWorker (name kept for app.py compatibility)."""
    global _worker
    if os.getenv("BIOMETRIC_SYNC_ENABLED", "1").strip().lower() in ("0", "false", "no", "off"):
        logging.getLogger(__name__).info("Biometric sync disabled (BIOMETRIC_SYNC_ENABLED=0)")
        return
    _worker = BiometricWorker()
    _worker.start()


def stop_biometric_scheduler():
    """Stops the worker and closes its persistent connections."""
    global _worker
    if _worker:
        _worker.stop()
        _worker = None


def force_resync_hours(hours: int = 24) -> dict:
    """
    Resets the worker's high-water mark so the next poll cycle re-fetches
    the last `hours` worth of punches from IDMS.

    Call this after fixing a config problem (e.g. wrong table name) to
    back-fill any punches the sync loop missed while the config was broken.

    Returns the reset summary, or raises RuntimeError if the worker is not running.

    Quick terminal usage:
        python - <<'EOF'
        from backend.core.biometric_sync import force_resync_hours
        print(force_resync_hours(24))
        EOF
    """
    if _worker is None:
        raise RuntimeError(
            "BiometricWorker is not running. "
            "Call start_biometric_scheduler() first, or restart the FastAPI server."
        )
    return _worker.force_resync(hours=hours)
