"""
retention_scheduler.py — Automated selfie file deletion job.

Runs daily at 02:00 server time via APScheduler.
Registered at app startup in app.py.

Process per run:
  1. Query attendance_selfies WHERE retention_expires_at <= TODAY AND status = 'active'
  2. For each expired record:
      a. Delete encrypted file from disk
      b. Update status → 'deleted', deleted_at, deletion_reason
      c. Write audit log entry (access_type = 'retention_delete')
  3. Log summary

Also handles auto-close of WFH sessions left open overnight.
"""

import logging
from datetime import date, datetime

import mysql.connector
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.config import DB_CONFIG
from backend.core import selfie_storage as storage
from backend.core.attendance_rules import run_daily_rules
from backend.core.leave_accounting import credit_monthly_leaves_job

log = logging.getLogger(__name__)

# ── DB helper ──────────────────────────────────────────────────────────────────

def _db():
    return mysql.connector.connect(**DB_CONFIG)

def _cfg(conn, key: str, default: str) -> str:
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT config_value FROM wfh_system_config WHERE config_key = %s", (key,))
        row = cur.fetchone()
        cur.close()
        return row["config_value"] if row else default
    except Exception:
        return default


# ── Job 1: Retention cleanup ───────────────────────────────────────────────────

def run_retention_cleanup() -> None:
    """
    Delete expired selfie files and update their database records.
    Called daily at 02:00.
    """
    log.info("[retention] Starting selfie retention cleanup run")
    today = date.today()
    deleted_count  = 0
    skipped_count  = 0
    error_count    = 0

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Find all expired active selfie records
        cur.execute("""
            SELECT id, storage_key, employee_id, wfh_attendance_id
            FROM attendance_selfies
            WHERE retention_expires_at <= %s
              AND status = 'active'
            ORDER BY retention_expires_at ASC
            LIMIT 500
        """, (today,))
        expired = cur.fetchall()
        log.info("[retention] Found %d expired selfie records", len(expired))

        for row in expired:
            selfie_id    = row["id"]
            storage_key  = row["storage_key"]
            employee_id  = row["employee_id"]
            wfh_id       = row["wfh_attendance_id"]

            try:
                # Delete encrypted file from disk
                was_present = storage.delete_selfie(storage_key)
                if not was_present:
                    log.warning("[retention] File not found on disk for selfie_id=%d (marking deleted anyway)", selfie_id)
                    skipped_count += 1
                else:
                    deleted_count += 1

                # Update DB record
                cur.execute("""
                    UPDATE attendance_selfies
                    SET status = 'deleted',
                        deleted_at = %s,
                        deletion_reason = 'retention_expired'
                    WHERE id = %s
                """, (datetime.now(), selfie_id))

                # Write audit log (system-generated entry — no user_id)
                cur.execute("""
                    INSERT INTO selfie_access_log
                        (selfie_id, wfh_attendance_id, employee_id,
                         accessed_by_user_id, accessed_by_name, accessed_by_role,
                         access_type, hr_comment, ip_address, user_agent)
                    VALUES (%s, %s, %s, 0, 'SYSTEM', 'system',
                            'retention_delete',
                            'Automated deletion: retention period expired',
                            '127.0.0.1', 'retention-scheduler/1.0')
                """, (selfie_id, wfh_id, employee_id))

                conn.commit()

            except Exception as exc:
                log.error("[retention] Error processing selfie_id=%d: %s", selfie_id, exc)
                error_count += 1
                conn.rollback()

        cur.close()
        conn.close()

    except Exception as exc:
        log.error("[retention] Fatal error during retention run: %s", exc)
        return

    log.info(
        "[retention] Run complete — deleted: %d, skipped (no file): %d, errors: %d",
        deleted_count, skipped_count, error_count,
    )


# ── Job 2: Auto-close overnight sessions ──────────────────────────────────────

def run_auto_close() -> None:
    """
    Close any WFH sessions that were punched in but never punched out
    by a configurable number of hours after punch-in.
    Called daily at 23:55.
    """
    log.info("[auto-close] Starting WFH session auto-close run")

    try:
        conn = _db()
        auto_close_hours = int(_cfg(conn, "wfh_auto_close_hours", "14"))
        cur  = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT id, employee_id, punch_in_at
            FROM wfh_attendance
            WHERE punch_out_at IS NULL
              AND punch_in_at <= NOW() - INTERVAL %s HOUR
        """, (auto_close_hours,))
        stale = cur.fetchall()
        log.info("[auto-close] Found %d stale open sessions", len(stale))

        for row in stale:
            wfh_id     = row["id"]
            punch_in   = row["punch_in_at"]
            auto_out   = punch_in.replace(hour=18, minute=0, second=0)  # default close at 18:00
            duration   = int((auto_out - punch_in).total_seconds() / 60)

            cur.execute("""
                UPDATE wfh_attendance
                SET punch_out_at    = %s,
                    duration_minutes = %s,
                    flag_reason = CONCAT(COALESCE(flag_reason, ''), ' | AUTO_CLOSED_NO_CHECKOUT')
                WHERE id = %s
            """, (auto_out, max(0, duration), wfh_id))

            # Also update attendance check_out if missing
            cur.execute("""
                UPDATE attendance a
                JOIN wfh_attendance w ON w.attendance_id = a.id
                SET a.check_out = %s
                WHERE w.id = %s AND a.check_out IS NULL
            """, (auto_out.strftime("%H:%M:%S"), wfh_id))

            # close any running break and store net working time
            try:
                from backend.core.time_tracking import finalize_day
                finalize_day(cur, row["employee_id"], wfh_id, punch_in, auto_out)
            except Exception as exc:
                log.warning("[auto-close] break finalisation failed for %s: %s", wfh_id, exc)

        conn.commit()
        cur.close()
        conn.close()
        log.info("[auto-close] Auto-close run complete")

    except Exception as exc:
        log.error("[auto-close] Error: %s", exc)


# ── Scheduler setup ────────────────────────────────────────────────────────────

_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    """Call this from app.py lifespan or startup event."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

    # Retention cleanup: daily at 02:00
    _scheduler.add_job(
        run_retention_cleanup,
        trigger=CronTrigger(hour=2, minute=0),
        id="selfie_retention",
        name="Selfie Retention Cleanup",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Auto-close orphaned sessions: daily at 23:55
    _scheduler.add_job(
        run_auto_close,
        trigger=CronTrigger(hour=23, minute=55),
        id="wfh_auto_close",
        name="WFH Auto-Close Sessions",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Attendance rules engine: mark absences + late arrivals + recalculate deductions at 23:30
    _scheduler.add_job(
        run_daily_rules,
        trigger=CronTrigger(hour=23, minute=30),
        id="attendance_rules",
        name="Attendance Rules Engine",
        replace_existing=True,
        misfire_grace_time=600,
    )

    _scheduler.add_job(
        credit_monthly_leaves_job,
        trigger=CronTrigger(day=1, hour=0, minute=10, timezone='Asia/Kolkata'),
        id="monthly_leave_credit",
        name="Monthly Leave Credit",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    _scheduler.start()
    log.info(
        "Retention scheduler started "
        "(selfie_retention @ 02:00, wfh_auto_close @ 23:55, "
        "attendance_rules @ 23:30, "
        "monthly_leave_credit @ day 1 00:10)"
    )


def stop_scheduler() -> None:
    """Call this from app.py shutdown event."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Retention scheduler stopped")
