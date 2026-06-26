"""
Biometric Integration — Phase 2: FastAPI Router
Exposes manual trigger, sync status, and device configuration endpoints.
All write operations are admin/HR only (enforced by role check helper).
"""

from datetime import datetime
from typing import Optional

import mysql.connector
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from config import DB_CONFIG
from biometric_sync import BiometricSyncEngine, DEVICE_IDS

router = APIRouter(prefix="/api/biometric", tags=["Biometric Attendance"])


def _get_db():
    return mysql.connector.connect(**DB_CONFIG)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class TriggerRequest(BaseModel):
    device_id:      Optional[str] = None   # None = all devices
    lookback_hours: Optional[int] = None   # override default lookback


class SyncStatusResponse(BaseModel):
    device_id:       str
    sync_start:      str
    sync_end:        Optional[str]
    records_fetched: int
    records_new:     int
    status:          str
    error_detail:    Optional[str]


# ---------------------------------------------------------------------------
# Simple role guard — checks the same JWT payload stored by your auth system
# Header: X-User-Role: admin  (or hr)
# In production, decode the Bearer token instead.
# ---------------------------------------------------------------------------
def _require_hr_or_admin(x_user_role: str = Header(default="")):
    if x_user_role.lower() not in ("admin", "hr"):
        raise HTTPException(status_code=403, detail="HR or Admin role required")


# ---------------------------------------------------------------------------
# POST /api/biometric/sync/trigger
# Manually kick off a sync — useful for testing or catch-up after downtime
# ---------------------------------------------------------------------------
@router.post("/sync/trigger")
def trigger_sync(
    body: TriggerRequest,
    x_user_role: str = Header(default=""),
):
    _require_hr_or_admin(x_user_role)

    engine  = BiometricSyncEngine()
    results = []

    if body.device_id:
        results.append(engine.run_sync(body.device_id, body.lookback_hours))
    else:
        for device_id in DEVICE_IDS:
            results.append(engine.run_sync(device_id, body.lookback_hours))

    # Always process after sync — converts new raw logs into attendance records.
    # Without this, "Sync Now" only stored raw logs but never wrote attendance.
    proc_result = None
    try:
        from biometric_processor import process_pending_punches
        proc_result = process_pending_punches()
        for r in results:
            r["processor"] = proc_result
    except Exception as exc:
        import logging as _log
        _log.getLogger(__name__).warning("trigger_sync: processor failed: %s", exc)

    all_ok = all(r["status"] == "SUCCESS" for r in results)
    return {
        "success":    all_ok,
        "results":    results,
        "processor":  proc_result,
        "triggered_at": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /api/biometric/sync/status?limit=20
# Returns most recent sync log entries across all devices
# ---------------------------------------------------------------------------
@router.get("/sync/status")
def sync_status(limit: int = 20):
    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT device_id, sync_start, sync_end, records_fetched,
                  records_new, status, error_detail
           FROM biometric_sync_log
           ORDER BY sync_start DESC
           LIMIT %s""",
        (limit,),
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        row["sync_start"] = row["sync_start"].isoformat() if row["sync_start"] else None
        row["sync_end"]   = row["sync_end"].isoformat()   if row["sync_end"]   else None

    # Build a quick health summary per device
    latest: dict[str, dict] = {}
    for row in rows:
        if row["device_id"] not in latest:
            latest[row["device_id"]] = row

    health = []
    for device_id, entry in latest.items():
        minutes_ago = None
        if entry["sync_end"]:
            delta = datetime.now() - datetime.fromisoformat(entry["sync_end"])
            minutes_ago = int(delta.total_seconds() / 60)

        health.append({
            "device_id":    device_id,
            "last_sync":    entry["sync_end"],
            "minutes_ago":  minutes_ago,
            "last_status":  entry["status"],
            "health":       _health_label(entry["status"], minutes_ago),
        })

    return {
        "success": True,
        "health":  health,
        "log":     rows,
    }


def _health_label(status: str, minutes_ago: Optional[int]) -> str:
    if status == "FAILED":
        return "RED"
    if minutes_ago is None or minutes_ago > 15:
        return "AMBER"
    return "GREEN"


# ---------------------------------------------------------------------------
# GET /api/biometric/sync/last-punch?device_id=1
# Returns the most recent punch timestamp for a device — useful for debugging
# ---------------------------------------------------------------------------
@router.get("/sync/last-punch")
def last_punch(device_id: str = "1"):
    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT enroll_id, device_id, punch_time, punch_type, synced_at
           FROM biometric_raw_logs
           WHERE device_id = %s
           ORDER BY punch_time DESC
           LIMIT 5""",
        (device_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        row["punch_time"] = row["punch_time"].isoformat() if row["punch_time"] else None
        row["synced_at"]  = row["synced_at"].isoformat()  if row["synced_at"]  else None

    return {"success": True, "device_id": device_id, "recent_punches": rows}


# ---------------------------------------------------------------------------
# GET /api/biometric/devices
# Returns the list of configured device IDs
# ---------------------------------------------------------------------------
@router.get("/devices")
def list_devices():
    return {"success": True, "device_ids": DEVICE_IDS}


# ---------------------------------------------------------------------------
# GET /api/biometric/raw-logs?date=2026-06-11&device_id=1&limit=50
# Paginated view of raw punch log — for HR audit/debug
# ---------------------------------------------------------------------------
@router.get("/raw-logs")
def raw_logs(
    date:      Optional[str] = None,
    device_id: Optional[str] = None,
    limit:     int = 50,
    offset:    int = 0,
    x_user_role: str = Header(default=""),
):
    _require_hr_or_admin(x_user_role)

    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)

    conditions = []
    params: list = []

    if date:
        conditions.append("DATE(punch_time) = %s")
        params.append(date)
    if device_id:
        conditions.append("device_id = %s")
        params.append(device_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    cursor.execute(
        f"""SELECT id, enroll_id, device_id, punch_time, punch_type,
                   source, synced_at, is_processed
            FROM biometric_raw_logs
            {where}
            ORDER BY punch_time DESC
            LIMIT %s OFFSET %s""",
        params + [limit, offset],
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        row["punch_time"] = row["punch_time"].isoformat() if row["punch_time"] else None
        row["synced_at"]  = row["synced_at"].isoformat()  if row["synced_at"]  else None

    return {"success": True, "records": rows, "count": len(rows)}


# ===========================================================================
# PHASE 3 — Employee Mapping endpoints
# ===========================================================================

class MappingCreatePayload(BaseModel):
    enroll_id:   str
    device_id:   str
    employee_id: str
    notes:       Optional[str] = None


class MappingUpdatePayload(BaseModel):
    employee_id: Optional[str] = None
    is_active:   Optional[int] = None
    notes:       Optional[str] = None


# ---------------------------------------------------------------------------
# GET /api/biometric/unmapped
# EnrollIDs that have punch records but no active mapping — the HR action queue
# ---------------------------------------------------------------------------
@router.get("/unmapped")
def get_unmapped(x_user_role: str = Header(default="")):
    _require_hr_or_admin(x_user_role)

    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        """SELECT
               r.enroll_id,
               r.device_id,
               COUNT(*)          AS punch_count,
               MAX(r.punch_time) AS last_punch,
               MIN(r.punch_time) AS first_punch
           FROM biometric_raw_logs r
           WHERE NOT EXISTS (
               SELECT 1 FROM biometric_employee_map m
               WHERE m.enroll_id  = r.enroll_id
                 AND (m.device_id = r.device_id OR m.device_id = '*')
                 AND m.is_active  = 1
           )
           GROUP BY r.enroll_id, r.device_id
           ORDER BY last_punch DESC"""
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        row["last_punch"]  = row["last_punch"].isoformat()  if row["last_punch"]  else None
        row["first_punch"] = row["first_punch"].isoformat() if row["first_punch"] else None

    return {"success": True, "unmapped": rows, "count": len(rows)}


# ---------------------------------------------------------------------------
# GET /api/biometric/mappings
# All active (and optionally inactive) mappings
# ---------------------------------------------------------------------------
@router.get("/mappings")
def list_mappings(
    include_inactive: bool = False,
    x_user_role: str = Header(default=""),
):
    _require_hr_or_admin(x_user_role)

    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)

    where = "" if include_inactive else "WHERE m.is_active = 1"
    cursor.execute(
        f"""SELECT
               m.id, m.enroll_id, m.device_id, m.employee_id,
               m.is_active, m.mapped_by, m.notes,
               m.mapped_at,
               e.full_name  AS employee_name,
               e.department AS department
           FROM biometric_employee_map m
           LEFT JOIN employees e ON e.employee_code = m.employee_id
           {where}
           ORDER BY m.mapped_at DESC"""
    )
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        row["mapped_at"] = row["mapped_at"].isoformat() if row["mapped_at"] else None

    return {"success": True, "mappings": rows, "count": len(rows)}


# ---------------------------------------------------------------------------
# POST /api/biometric/mappings
# Create a new enroll_id → employee_id mapping
# ---------------------------------------------------------------------------
@router.post("/mappings")
def create_mapping(
    body: MappingCreatePayload,
    x_user_role: str = Header(default=""),
    x_user_id:   str = Header(default=""),
):
    _require_hr_or_admin(x_user_role)

    conn   = _get_db()
    cursor = conn.cursor()

    # UPSERT: handles both first-time mapping and re-mapping.
    # A plain UPDATE+INSERT pattern would fail on re-mapping because the
    # UNIQUE KEY (enroll_id, device_id) rejects a second INSERT for the same pair.
    cursor.execute(
        """INSERT INTO biometric_employee_map
               (enroll_id, device_id, employee_id, is_active, mapped_by, notes)
           VALUES (%s, %s, %s, 1, %s, %s)
           ON DUPLICATE KEY UPDATE
               employee_id = VALUES(employee_id),
               is_active   = 1,
               mapped_by   = VALUES(mapped_by),
               notes       = VALUES(notes),
               mapped_at   = CURRENT_TIMESTAMP""",
        (
            body.enroll_id,
            body.device_id,
            body.employee_id,
            x_user_id or x_user_role,
            body.notes,
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {
        "success": True,
        "message": f"EnrollID {body.enroll_id} mapped to {body.employee_id}",
        "mapping_id": new_id,
    }


# ---------------------------------------------------------------------------
# PUT /api/biometric/mappings/{mapping_id}
# Update employee assignment or deactivate a mapping
# ---------------------------------------------------------------------------
@router.put("/mappings/{mapping_id}")
def update_mapping(
    mapping_id: int,
    body: MappingUpdatePayload,
    x_user_role: str = Header(default=""),
):
    _require_hr_or_admin(x_user_role)

    conn   = _get_db()
    cursor = conn.cursor()

    updates = []
    params  = []
    if body.employee_id is not None:
        updates.append("employee_id = %s"); params.append(body.employee_id)
    if body.is_active is not None:
        updates.append("is_active = %s"); params.append(body.is_active)
    if body.notes is not None:
        updates.append("notes = %s"); params.append(body.notes)

    if not updates:
        conn.close()
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(mapping_id)
    cursor.execute(
        f"UPDATE biometric_employee_map SET {', '.join(updates)} WHERE id = %s",
        params,
    )
    conn.commit()
    conn.close()

    return {"success": True, "message": "Mapping updated"}


# ---------------------------------------------------------------------------
# GET /api/biometric/stats
# Quick counts for the dashboard widget
# ---------------------------------------------------------------------------
@router.get("/stats")
def biometric_stats():
    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total_raw FROM biometric_raw_logs")
    total_raw = cursor.fetchone()["total_raw"]

    cursor.execute(
        "SELECT COUNT(DISTINCT enroll_id) AS unique_enrolls FROM biometric_raw_logs"
    )
    unique_enrolls = cursor.fetchone()["unique_enrolls"]

    cursor.execute(
        "SELECT COUNT(*) AS mapped FROM biometric_employee_map WHERE is_active = 1"
    )
    mapped = cursor.fetchone()["mapped"]

    cursor.execute(
        """SELECT COUNT(DISTINCT enroll_id) AS unmapped_count
           FROM biometric_raw_logs
           WHERE NOT EXISTS (
               SELECT 1 FROM biometric_employee_map m
               WHERE m.enroll_id = biometric_raw_logs.enroll_id AND m.is_active = 1
           )"""
    )
    unmapped = cursor.fetchone()["unmapped_count"]

    cursor.execute(
        "SELECT COUNT(*) AS today FROM biometric_raw_logs WHERE DATE(punch_time) = CURDATE()"
    )
    today = cursor.fetchone()["today"]

    conn.close()

    return {
        "success":        True,
        "total_punches":  total_raw,
        "unique_enrolls": unique_enrolls,
        "mapped":         mapped,
        "unmapped":       unmapped,
        "today_punches":  today,
    }


# ---------------------------------------------------------------------------
# Phase 4: manually trigger the attendance processing engine
# ---------------------------------------------------------------------------
@router.post("/process/trigger")
def trigger_processing(x_user_role: str = Header(default="")):
    _require_hr_or_admin(x_user_role)

    from biometric_processor import process_pending_punches

    result = process_pending_punches()
    return {
        "success":            result["errors"] == 0,
        "auto_provisioned":   result.get("auto_provisioned", 0),
        "processed_punches":  result["processed"],
        "attendance_created": result["attendance_created"],
        "attendance_updated": result["attendance_updated"],
        "skipped_protected":  result["skipped"],
        "errors":             result["errors"],
        "triggered_at":       datetime.now().isoformat(),
    }
