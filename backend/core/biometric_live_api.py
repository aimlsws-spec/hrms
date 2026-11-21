"""biometric_live_api.py -- Real-time attendance log endpoint (MySQL ONLY)

Queries the HRMS MySQL database for punch records and employee names.
Uses biometric_raw_logs for punches and biometric_userinfo for real names.
NO SQL Server dependency -- fully MySQL for production deployment.
"""

import logging
from datetime import datetime
from typing import List, Optional

import mysql.connector
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.config import DB_CONFIG

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/attendance", tags=["Live Attendance"])


class AttendanceRecord(BaseModel):
    user_id:    str             = Field(..., description="Biometric device enroll ID")
    first_name: Optional[str]  = Field(None, description="Employee first name")
    last_name:  Optional[str]  = Field(None, description="Employee last name")
    full_name:  str             = Field(..., description="Display name from biometric_userinfo")
    io_time:    datetime        = Field(..., description="Punch timestamp")
    device_id:  str             = Field(..., description="Device that recorded this punch")
    model_config = {"from_attributes": True}


class LiveAttendanceResponse(BaseModel):
    success:     bool
    count:       int                     = Field(..., description="Number of records returned")
    records:     List[AttendanceRecord]
    fetched_at:  str                     = Field(..., description="Server timestamp of this response")
    query_since: Optional[str]           = Field(None, description="Echo of the since filter")
    has_more:    bool                    = Field(..., description="True when count == limit")


_BASE_SQL = """
SELECT
    brl.enroll_id   AS user_id,
    bu.user_name    AS user_name,
    e.first_name    AS first_name,
    e.last_name     AS last_name,
    e.full_name     AS display_name,
    brl.punch_time  AS io_time,
    brl.device_id   AS device_id
FROM biometric_raw_logs brl
LEFT JOIN biometric_userinfo bu
       ON brl.enroll_id = bu.enroll_id
LEFT JOIN biometric_employee_map bem
       ON brl.enroll_id = bem.enroll_id
      AND brl.device_id = bem.device_id
      AND bem.is_active = 1
LEFT JOIN employees e
       ON bem.employee_id = e.employee_id
{where_clause}
ORDER BY brl.punch_time DESC
LIMIT %s
"""


def _build_record(row: dict) -> AttendanceRecord:
    user_id      = str(row["user_id"]).strip() if row.get("user_id") else ""
    first_name   = row.get("first_name")
    last_name    = row.get("last_name")
    display_name = row.get("display_name")
    user_name    = row.get("user_name")

    # Priority 1: Real name from biometric_userinfo (synced from device)
    # Priority 2: MySQL employee full_name (if not a placeholder)
    # Priority 3: Unknown fallback
    if user_name and str(user_name).strip():
        full_name = str(user_name).strip()
    elif display_name and str(display_name).strip() and not str(display_name).startswith("Unknown"):
        full_name = str(display_name).strip()
    else:
        full_name = f"Unknown (ID: {user_id})" if user_id else "Unknown"

    return AttendanceRecord(
        user_id    = user_id,
        first_name = first_name.strip() if first_name and str(first_name).strip() else None,
        last_name  = last_name.strip() if last_name and str(last_name).strip() else None,
        full_name  = full_name,
        io_time    = row["io_time"],
        device_id  = str(row["device_id"]).strip() if row.get("device_id") else "",
    )


def _get_mysql_conn():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as exc:
        logger.error("[LIVE] MySQL connection failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Database is unavailable. Detail: {exc}",
        )


@router.get("/live", response_model=LiveAttendanceResponse)
def get_live_attendance(
    limit: int = Query(default=50, ge=1, le=500, description="Maximum records to return (1-500)"),
    since: Optional[datetime] = Query(default=None, description="ISO-8601 datetime for incremental polling"),
):
    logger.info("[LIVE] GET /api/attendance/live  since=%r  limit=%s", since, limit)
    used_fallback = False
    conn = None
    cursor = None
    try:
        conn = _get_mysql_conn()
        cursor = conn.cursor(dictionary=True)
        if since is not None:
            where_clause = "WHERE brl.punch_time >= %s"
            params = (since, limit)
        else:
            where_clause = ""
            params = (limit,)
        sql = _BASE_SQL.format(where_clause=where_clause)
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        if since is not None and len(rows) == 0:
            logger.info("[LIVE] FALLBACK triggered")
            fallback_sql = _BASE_SQL.format(where_clause="")
            cursor.execute(fallback_sql, (10,))
            rows = cursor.fetchall()
            used_fallback = True
        records = [_build_record(row) for row in rows]
        fetched_at = datetime.now().isoformat()
        return LiveAttendanceResponse(
            success=True,
            count=len(records),
            records=records,
            fetched_at=fetched_at,
            query_since=since.isoformat() if since else None,
            has_more=(len(records) == limit and not used_fallback),
        )
    except mysql.connector.Error as exc:
        logger.exception("[LIVE] MySQL error")
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    except Exception as exc:
        logger.exception("[LIVE] Unexpected error")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/debug-time")
def debug_time():
    python_now = datetime.now()
    python_utc = datetime.utcnow()
    conn = None
    cursor = None
    try:
        conn = _get_mysql_conn()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT punch_time, device_id FROM biometric_raw_logs ORDER BY punch_time DESC LIMIT 1")
        latest_row = cursor.fetchone()
        latest_io_time = latest_row["punch_time"] if latest_row else None
        latest_device  = latest_row["device_id"] if latest_row else None
        # Count of names available
        cursor.execute("SELECT COUNT(*) as cnt FROM biometric_userinfo")
        name_count = cursor.fetchone()["cnt"]
        result = {
            "python_local":     python_now.isoformat(),
            "python_utc":       python_utc.isoformat(),
            "latest_io_time":   latest_io_time.isoformat() if latest_io_time else None,
            "latest_device":    latest_device,
            "db_table":         "biometric_raw_logs (MySQL)",
            "name_records":     name_count,
            "diagnosis": (
                "OK -- MySQL live feed active"
                if latest_io_time and (python_now - latest_io_time).total_seconds() < 86400
                else "WARNING -- No recent punches found in biometric_raw_logs"
            ),
        }
        logger.info("[DEBUG-TIME] %s", result)
        return result
    except mysql.connector.Error as exc:
        logger.exception("[DEBUG-TIME] MySQL error")
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    except Exception as exc:
        logger.exception("[DEBUG-TIME] Unexpected error")
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")
    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()
