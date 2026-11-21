"""
WFH Selfie Evidence System — FastAPI router
/api/wfh/* endpoints

Authentication model (consistent with existing HRMS):
  The HRMS users table has no session-token column. The frontend token is
  a JWT stored client-side only. Following the existing HRMS pattern, we
  accept employee_id as a request parameter and trust the frontend's
  role-based routing for access control.

  For HR-only endpoints we accept a reviewer_user_id parameter and verify
  the role in the users table — the same lightweight check used throughout
  this HRMS for accountability logging.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta
from typing import Optional

import mysql.connector
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from backend.config import DB_CONFIG
from backend.core import selfie_storage as storage
from backend.core.wfo_attendance import mark_wfo_present
from backend.core.time_tracking import require_desktop, finalize_day

log    = logging.getLogger(__name__)
router = APIRouter()


def _parse_client_ts(raw: Optional[str]) -> Optional[datetime]:
    """Convert a frontend ISO-8601 string to a MySQL-safe naive datetime, or None."""
    if not raw:
        return None
    try:
        normalised = raw.strip().replace("T", " ").rstrip("Z")
        if "+" in normalised:
            normalised = normalised[:normalised.index("+")]
        return datetime.strptime(normalised[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


# ── DB helper ──────────────────────────────────────────────────────────────────

def _db():
    return mysql.connector.connect(**DB_CONFIG)

def _sf(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default

# ── Auth helpers ───────────────────────────────────────────────────────────────

def _lookup_reviewer(reviewer_user_id: str) -> dict:
    """
    Look up a user by user_id and return { user_id, full_name, role }.
    Used by HR-only endpoints to verify the caller has hr/admin role.
    Raises HTTP 403 if user not found or role is not hr/admin.
    """
    uid = (reviewer_user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=403, detail="reviewer_user_id is required for HR actions")
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT user_id, COALESCE(full_name, username, '') AS full_name, role "
            "FROM users WHERE user_id = %s LIMIT 1",
            (uid,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as exc:
        log.error("_lookup_reviewer error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to verify reviewer")

    if not row:
        raise HTTPException(status_code=403, detail="Reviewer user not found")
    if row["role"] not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR or admin role required")
    return {"user_id": str(row["user_id"]), "full_name": row["full_name"], "role": row["role"]}


# ── Config helper ──────────────────────────────────────────────────────────────

def _cfg(conn, key: str, default: str) -> str:
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT config_value FROM wfh_system_config WHERE config_key = %s", (key,))
        row = cur.fetchone()
        cur.close()
        return row["config_value"] if row else default
    except Exception:
        return default


# ─────────────────────────────────────────────────────────────────────────────
# WFH SESSION ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/wfh/status")
def wfh_status(employee_id: str = ""):
    """
    Return today's WFH session status for the given employee.
    employee_id must be passed as a query parameter (e.g. ?employee_id=EMP0001).
    """
    emp_id = employee_id.strip()
    if not emp_id:
        return {"has_session": False, "status": None}

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT w.id, w.status, w.punch_in_at, w.punch_out_at,
                   COALESCE(w.attendance_method, 'SELFIE') AS attendance_method,
                   w.geo_distance_meters,
                   s.id AS selfie_id, s.status AS selfie_status
            FROM wfh_attendance w
            LEFT JOIN attendance_selfies s
                   ON s.wfh_attendance_id = w.id AND s.capture_type = 'checkin'
            WHERE w.employee_id = %s
              AND DATE(w.punch_in_at) = CURDATE()
            LIMIT 1
        """, (emp_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return {"has_session": False, "status": None}

        punch_in = row["punch_in_at"]
        punch_out = row["punch_out_at"]
        return {
            "has_session":       True,
            "wfh_id":            row["id"],
            "status":            row["status"],
            "attendance_method": row["attendance_method"],
            "punch_in_at":       punch_in.isoformat() if punch_in else None,
            "punch_out_at":      punch_out.isoformat() if punch_out else None,
            "selfie_captured":   row["selfie_id"] is not None,
            "geo_distance_meters": float(row["geo_distance_meters"]) if row["geo_distance_meters"] else None,
        }
    except Exception as exc:
        log.error("wfh_status error: %s", exc)
        return {"has_session": False, "status": None}


@router.post("/api/wfh/checkin")
async def wfh_checkin(request: Request):
    """
    WFH punch-in.
    Expects JSON body: { employee_id, idempotency_key, client_timestamp? }
    Creates a wfh_attendance record (PENDING_SELFIE status) and mirrors
    into the attendance table so payslip present-day counts work unchanged.
    """
    # Location AND selfie are both mandatory: punch-in starts with the geo check-in
    # (POST /api/wfh/geo-checkin) and the selfie upload completes it.
    raise HTTPException(
        status_code=409,
        detail="Selfie-only punch-in is not allowed. Verify your location first, then take your selfie.",
    )

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    emp_id  = (body.get("employee_id") or "").strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")

    idempotency_key = (body.get("idempotency_key") or "").strip()

    # Validate UUID format to prevent injection
    try:
        uuid.UUID(idempotency_key, version=4)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="idempotency_key must be a valid UUID v4")

    client_ip  = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    client_ts  = _parse_client_ts(body.get("client_timestamp"))
    
    # Optional GPS coordinates
    latitude = _sf(body.get("latitude"))
    longitude = _sf(body.get("longitude"))

    now        = datetime.now()
    today      = now.date()

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Verify employee exists — use employee_code directly (not virtual employee_id column)
        cur.execute(
            "SELECT employee_code FROM employees WHERE employee_code = %s LIMIT 1",
            (emp_id,)
        )
        if not cur.fetchone():
            cur.close(); conn.close()
            log.warning("wfh_checkin: employee not found emp_id=%r", emp_id)
            raise HTTPException(status_code=404, detail="Employee record not found")

        # Idempotency: return existing record if key was already used
        cur.execute(
            "SELECT id, status FROM wfh_attendance WHERE idempotency_key = %s",
            (idempotency_key,)
        )
        existing = cur.fetchone()
        if existing:
            cur.close(); conn.close()
            return {"success": True, "wfh_id": existing["id"], "status": existing["status"], "duplicate": True}

        # Prevent duplicate session for today
        cur.execute(
            "SELECT id FROM wfh_attendance WHERE employee_id = %s AND DATE(punch_in_at) = %s",
            (emp_id, today)
        )
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=409, detail="WFH session already exists for today")

        # Create wfh_attendance record
        log.info("wfh_checkin: creating session for emp=%r at %s", emp_id, now)
        cur.execute("""
            INSERT INTO wfh_attendance
                (employee_id, punch_in_at, idempotency_key, status,
                 client_ip, user_agent, client_timestamp)
            VALUES (%s, %s, %s, 'PENDING_SELFIE', %s, %s, %s)
        """, (emp_id, now, idempotency_key, client_ip, user_agent[:500], client_ts))
        wfh_id = cur.lastrowid

        # Mirror into the attendance table (upsert) so payslip counts work
        check_in_time = now.strftime("%H:%M:%S")
        cur.execute("""
            INSERT INTO attendance (employee_id, date, check_in, status)
            VALUES (%s, %s, %s, 'PRESENT')
            ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), status = 'PRESENT'
        """, (emp_id, today, check_in_time))
        att_id = cur.lastrowid or None

        # Link attendance FK (non-fatal if column is missing on older installs)
        if att_id:
            try:
                cur.execute(
                    "UPDATE wfh_attendance SET attendance_id = %s WHERE id = %s",
                    (att_id, wfh_id)
                )
            except Exception as link_exc:
                log.warning("wfh_checkin: could not set attendance_id: %s", link_exc)

        mark_wfo_present(cur, emp_id, now, "SELFIE")

        conn.commit()
        cur.close()
        conn.close()

        log.info("wfh_checkin: OK wfh_id=%s emp=%r", wfh_id, emp_id)
        return {
            "success":     True,
            "wfh_id":      wfh_id,
            "status":      "PENDING_SELFIE",
            "punch_in_at": now.isoformat(),
            "message":     "WFH check-in recorded. Please upload your selfie to complete.",
        }

    except HTTPException:
        raise
    except mysql.connector.IntegrityError as exc:
        log.error("wfh_checkin IntegrityError: %s", exc)
        if "uq_emp_date" in str(exc) or "uq_idempotency" in str(exc) or "Duplicate" in str(exc):
            raise HTTPException(status_code=409, detail="WFH session already exists for today")
        raise HTTPException(status_code=422, detail=f"Database constraint: {exc}")
    except mysql.connector.Error as exc:
        log.error("wfh_checkin DB error (table/column missing?): %s", exc)
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    except Exception as exc:
        log.error("wfh_checkin unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to record WFH check-in: {exc}")


@router.post("/api/wfh/checkout")
async def wfh_checkout(request: Request):
    """
    WFH punch-out. Closes the open wfh_attendance session for today.
    Expects JSON body: { employee_id }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    emp_id = (body.get("employee_id") or "").strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")

    require_desktop(request)
    client_ip = request.client.host if request.client else "unknown"
    now       = datetime.now()
    today     = now.date()

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Find today's open session
        cur.execute("""
            SELECT id, punch_in_at, status
            FROM wfh_attendance
            WHERE employee_id = %s AND DATE(punch_in_at) = %s AND punch_out_at IS NULL
        """, (emp_id, today))
        session = cur.fetchone()
        if not session:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="No open WFH session found for today")

        if session["status"] == "PENDING_SELFIE":
            cur.close(); conn.close()
            raise HTTPException(status_code=409, detail="Take your check-in selfie first.")

        punch_in = session["punch_in_at"]
        duration = int((now - punch_in).total_seconds() / 60)

        cur.execute("""
            UPDATE wfh_attendance
            SET punch_out_at = %s, duration_minutes = %s
            WHERE id = %s
        """, (now, duration, session["id"]))

        # Update attendance table check_out
        cur.execute("""
            UPDATE attendance SET check_out = %s
            WHERE employee_id = %s AND date = %s
        """, (now.strftime("%H:%M:%S"), emp_id, today))

        totals = finalize_day(cur, emp_id, session["id"], punch_in, now)

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success":     True,
            "punch_out_at": now.isoformat(),
            "duration_minutes": duration,
            "break_minutes": totals["break_minutes"],
            "work_minutes":  totals["work_minutes"],
        }
    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        log.error("Database error in wfh_checkout: %s", exc)
        raise HTTPException(status_code=500, detail="Database operation failed")
    except Exception as exc:
        log.error("wfh_checkout error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to record WFH check-out")


@router.get("/api/wfh/history/{employee_id}")
def wfh_history(employee_id: str, month: Optional[str] = None):
    """Return WFH attendance history for an employee."""

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        if month:
            cur.execute("""
                SELECT w.id, w.punch_in_at, w.punch_out_at, w.duration_minutes,
                       w.status, w.flag_reason,
                       COALESCE(w.attendance_method, 'SELFIE') AS attendance_method,
                       w.geo_distance_meters,
                       s.id AS selfie_id, s.status AS selfie_status
                FROM wfh_attendance w
                LEFT JOIN attendance_selfies s ON s.wfh_attendance_id = w.id
                  AND s.capture_type = 'checkin'
                WHERE w.employee_id = %s AND DATE_FORMAT(w.punch_in_at, '%%Y-%%m') = %s
                ORDER BY w.punch_in_at DESC
            """, (employee_id, month))
        else:
            cur.execute("""
                SELECT w.id, w.punch_in_at, w.punch_out_at, w.duration_minutes,
                       w.status, w.flag_reason,
                       COALESCE(w.attendance_method, 'SELFIE') AS attendance_method,
                       w.geo_distance_meters,
                       s.id AS selfie_id, s.status AS selfie_status
                FROM wfh_attendance w
                LEFT JOIN attendance_selfies s ON s.wfh_attendance_id = w.id
                  AND s.capture_type = 'checkin'
                WHERE w.employee_id = %s
                ORDER BY w.punch_in_at DESC LIMIT 30
            """, (employee_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            pi = r["punch_in_at"]
            po = r["punch_out_at"]
            result.append({
                "id":                  r["id"],
                "punch_in_at":         pi.isoformat() if pi else None,
                "punch_out_at":        po.isoformat() if po else None,
                "duration_minutes":    r["duration_minutes"],
                "status":              r["status"],
                "flag_reason":         r["flag_reason"],
                "attendance_method":   r["attendance_method"],
                "geo_distance_meters": float(r["geo_distance_meters"]) if r["geo_distance_meters"] else None,
                "selfie_captured":     r["selfie_id"] is not None,
                "selfie_status":       r["selfie_status"],
            })
        return {"success": True, "records": result}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("wfh_history error: %s", exc)
        return {"success": False, "records": []}


# ─────────────────────────────────────────────────────────────────────────────
# SELFIE UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/api/wfh/selfie/upload")
async def selfie_upload(
    wfh_id:           int           = Form(...),
    employee_id:      str           = Form(...),
    capture_type:     str           = Form("checkin"),
    capture_attempts: int           = Form(1),
    camera_label:     Optional[str] = Form(None),
    file:             UploadFile    = File(...),
    request:          Request       = None,
):
    """
    Accept a selfie upload for a WFH session.

    Server-side pipeline:
      1. Employee identity + session ownership check
      2. Duplicate upload guard
      3. File size pre-check
      4. Magic bytes + full Pillow decode
      5. Minimum dimension check
      6. EXIF strip + JPEG re-encode
      7. AES-256-GCM encryption
      8. UUID filename write to private directory
      9. DB record creation

    The selfie is attendance EVIDENCE only — not biometric identification.
    """
    if request is not None:
        require_desktop(request)
    emp_id = (employee_id or "").strip()

    # ── Validate capture_type ──────────────────────────────────────────────────
    if capture_type not in ("checkin", "checkout"):
        raise HTTPException(status_code=422, detail="capture_type must be 'checkin' or 'checkout'")

    # ── Pre-check content type ─────────────────────────────────────────────────
    ct = (file.content_type or "").lower()
    if ct not in ("image/jpeg", "image/png", "image/jpg", "application/octet-stream"):
        raise HTTPException(status_code=422, detail="Unsupported file type. Upload a JPEG or PNG image.")

    # ── Read file bytes ────────────────────────────────────────────────────────
    try:
        raw_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read upload stream")
        
    if not raw_bytes:
        raise HTTPException(status_code=422, detail="Empty file uploaded")

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # ── Verify session exists and belongs to this employee ─────────────────
        cur.execute(
            "SELECT id, employee_id, status, punch_in_at, geo_latitude FROM wfh_attendance WHERE id = %s",
            (wfh_id,)
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="WFH session not found")
        if session["employee_id"] != emp_id:
            raise HTTPException(status_code=403, detail="This session belongs to a different employee")

        # ── Location AND selfie are both mandatory ─────────────────────────────
        if capture_type == "checkin" and session.get("geo_latitude") is None:
            cur.close(); conn.close()
            raise HTTPException(
                status_code=409,
                detail="Verify your location first. A check-in selfie is accepted only after the geo check.",
            )

        # ── Prevent duplicate selfie for this session + capture_type ──────────
        cur.execute("""
            SELECT id FROM attendance_selfies
            WHERE wfh_attendance_id = %s AND capture_type = %s AND status != 'deleted'
        """, (wfh_id, capture_type))
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=409, detail="Selfie already uploaded for this session")

        # ── Get config values ─────────────────────────────────────────────────
        max_kb           = int(_cfg(conn, "selfie_max_file_size_kb", "2048"))
        retention_months = int(_cfg(conn, "selfie_retention_months", "12"))
        max_attempts     = int(_cfg(conn, "selfie_max_capture_attempts", "3"))

        if capture_attempts > max_attempts:
            raise HTTPException(
                status_code=422,
                detail=f"Maximum {max_attempts} capture attempts allowed"
            )

        # ── Storage pipeline ──────────────────────────────────────────────────
        # Raises ValueError on validation failure (bad image / too large / wrong format)
        try:
            meta = storage.save_selfie(raw_bytes, max_kb=max_kb)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        except OSError as exc:
            log.error("Filesystem error during selfie upload: %s", exc)
            raise HTTPException(status_code=500, detail="Storage filesystem error")

        # ── Retention date ────────────────────────────────────────────────────
        retention_expires = (
            date.today().replace(day=1) + timedelta(days=31 * retention_months)
        ).replace(day=1)  # start of month N months from now

        now = datetime.now()

        # ── Write attendance_selfies record ───────────────────────────────────
        cur.execute("""
            INSERT INTO attendance_selfies
                (employee_id, wfh_attendance_id, capture_type, storage_key, storage_backend,
                 file_hash, mime_type, file_size_bytes, width_px, height_px,
                 camera_device_label, capture_attempt_count,
                 captured_at, uploaded_at, retention_expires_at, status)
            VALUES (%s, %s, %s, %s, 'local_encrypted',
                    %s, %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, 'active')
        """, (
            emp_id, wfh_id, capture_type,
            meta["storage_key"],
            meta["file_hash"], meta["mime_type"],
            meta["file_size_bytes"], meta["width_px"], meta["height_px"],
            camera_label[:200] if camera_label else None,
            capture_attempts,
            now, now, retention_expires,
        ))
        selfie_id = cur.lastrowid

        # ── Update wfh_attendance status ──────────────────────────────────────
        # PENDING_SELFIE → AUTO_APPROVED (selfie received, no other flags set yet)
        if session["status"] == "PENDING_SELFIE":
            cur.execute(
                "UPDATE wfh_attendance SET status = 'AUTO_APPROVED' WHERE id = %s",
                (wfh_id,)
            )

            # Location verified (geo-checkin) + selfie received → attendance is now recorded.
            punch_in = session["punch_in_at"]
            cur.execute("""
                INSERT INTO attendance (employee_id, date, check_in, status)
                VALUES (%s, %s, %s, 'PRESENT')
                ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), status = 'PRESENT'
            """, (emp_id, punch_in.date(), punch_in.strftime("%H:%M:%S")))
            att_id = cur.lastrowid or None
            if att_id:
                try:
                    cur.execute("UPDATE wfh_attendance SET attendance_id = %s WHERE id = %s",
                                (att_id, wfh_id))
                except Exception as link_exc:
                    log.warning("selfie_upload: attendance_id link skipped: %s", link_exc)
            mark_wfo_present(cur, emp_id, punch_in, "GEO_SELFIE")

        conn.commit()
        cur.close()
        conn.close()

        return {
            "success":    True,
            "selfie_id":  selfie_id,
            "status":     "AUTO_APPROVED",
            "notice":     (
                "This selfie is collected as attendance evidence only "
                "and is not used for biometric identification."
            ),
        }

    except HTTPException:
        raise
    except mysql.connector.IntegrityError as exc:
        log.warning("Database integrity error in selfie_upload: %s", exc)
        raise HTTPException(status_code=422, detail=f"Database constraint violation: {exc}")
    except mysql.connector.Error as exc:
        log.error("Database error in selfie_upload: %s", exc)
        raise HTTPException(status_code=500, detail="Database operation failed")
    except Exception as exc:
        log.error("selfie_upload error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process selfie upload")


# ─────────────────────────────────────────────────────────────────────────────
# HR REVIEW QUEUE — must be registered BEFORE /selfie/{selfie_id} so FastAPI
# does not attempt to coerce the literal string "review" to int.
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/wfh/selfie/review")
def selfie_review_list(
    reviewer_user_id: str          = "",
    status:           Optional[str] = None,
    page:             int           = 1,
    per_page:         int           = 20,
):
    """
    HR review queue — paginated list of WFH sessions with selfies.
    reviewer_user_id must belong to a user with hr or admin role.
    """
    _lookup_reviewer(reviewer_user_id)

    page     = max(1, page)
    per_page = min(100, max(5, per_page))
    offset   = (page - 1) * per_page

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        where_clauses = ["s.status = 'active'"]
        params: list = []
        if status:
            where_clauses.append("w.status = %s")
            params.append(status)

        where = " AND ".join(where_clauses)

        # Total count for pagination
        cur.execute(f"""
            SELECT COUNT(*) AS cnt
            FROM attendance_selfies s
            JOIN wfh_attendance w ON w.id = s.wfh_attendance_id
            WHERE {where}
        """, params)
        total = (cur.fetchone() or {}).get("cnt", 0)

        # Page of results
        cur.execute(f"""
            SELECT
                w.id           AS wfh_id,
                w.employee_id,
                COALESCE(e.full_name, w.employee_id)  AS employee_name,
                COALESCE(e.department, 'N/A')         AS department,
                COALESCE(e.title, 'N/A')              AS job_title,
                w.punch_in_at,
                w.punch_out_at,
                w.status       AS wfh_status,
                w.flag_reason,
                s.id           AS selfie_id,
                s.capture_type,
                s.captured_at,
                s.file_size_bytes
            FROM attendance_selfies s
            JOIN wfh_attendance w  ON w.id = s.wfh_attendance_id
            LEFT JOIN employees e  ON e.employee_code = w.employee_id
            WHERE {where}
            ORDER BY w.punch_in_at DESC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])
        rows = cur.fetchall()
        cur.close()
        conn.close()

        records = []
        for r in rows:
            pi = r["punch_in_at"]
            po = r["punch_out_at"]
            ca = r["captured_at"]
            records.append({
                "wfh_id":          r["wfh_id"],
                "employee_id":     r["employee_id"],
                "employee_name":   r["employee_name"],
                "department":      r["department"],
                "job_title":       r["job_title"],
                "punch_in_at":     pi.isoformat() if pi else None,
                "punch_out_at":    po.isoformat() if po else None,
                "wfh_status":      r["wfh_status"],
                "flag_reason":     r["flag_reason"],
                "selfie_id":       r["selfie_id"],
                "capture_type":    r["capture_type"],
                "captured_at":     ca.isoformat() if ca else None,
                "file_size_bytes": r["file_size_bytes"],
            })

        return {
            "success":     True,
            "records":     records,
            "total":       total,
            "page":        page,
            "per_page":    per_page,
            "total_pages": (total + per_page - 1) // per_page,
        }
    except Exception as exc:
        log.error("selfie_review_list error: %s", exc)
        return {"success": False, "records": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 1}


# ─────────────────────────────────────────────────────────────────────────────
# SELFIE RETRIEVAL (HR ONLY)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/api/wfh/selfie/{selfie_id}")
def selfie_view(
    selfie_id:          int,
    request:            Request,
    reviewer_user_id:   str = "",
):
    """
    Decrypt and stream a selfie image. HR/admin only.
    Pass reviewer_user_id as a query parameter — role is verified against users table.
    Creates an audit log entry BEFORE streaming image bytes.
    Never exposes storage path or filename.
    """
    reviewer   = _lookup_reviewer(reviewer_user_id)
    client_ip  = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Fetch selfie metadata
        cur.execute("""
            SELECT s.id, s.storage_key, s.storage_backend, s.status,
                   s.employee_id, s.wfh_attendance_id, s.mime_type
            FROM attendance_selfies s
            WHERE s.id = %s
        """, (selfie_id,))
        selfie = cur.fetchone()

        if not selfie:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Selfie not found")
        if selfie["status"] == "deleted":
            cur.close(); conn.close()
            raise HTTPException(status_code=410, detail="Selfie has been deleted (retention policy)")

        # Fetch current wfh status for audit snapshot
        cur.execute(
            "SELECT status FROM wfh_attendance WHERE id = %s",
            (selfie["wfh_attendance_id"],)
        )
        wfh_row = cur.fetchone()
        wfh_status = wfh_row["status"] if wfh_row else "unknown"

        # ── Write audit log FIRST — before streaming image ────────────────────
        cur.execute("""
            INSERT INTO selfie_access_log
                (selfie_id, wfh_attendance_id, employee_id,
                 accessed_by_user_id, accessed_by_name, accessed_by_role,
                 access_type, wfh_status_before, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, 'view', %s, %s, %s)
        """, (
            selfie["id"], selfie["wfh_attendance_id"], selfie["employee_id"],
            reviewer["user_id"], reviewer["full_name"], reviewer["role"],
            wfh_status, client_ip, user_agent[:500],
        ))
        conn.commit()
        cur.close()
        conn.close()

        # ── Decrypt and stream ────────────────────────────────────────────────
        try:
            image_bytes = storage.read_selfie(selfie["storage_key"])
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Selfie file not found on storage")
        except Exception as exc:
            log.error("Selfie decryption failed for %s: %s", selfie["storage_key"], exc)
            raise HTTPException(status_code=500, detail="Failed to retrieve selfie")

        return Response(
            content=image_bytes,
            media_type="image/jpeg",
            headers={
                "Cache-Control":        "no-store, no-cache, must-revalidate",
                "Pragma":               "no-cache",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition":  "inline",  # display in browser, not download
            },
        )

    except HTTPException:
        raise
    except Exception as exc:
        log.error("selfie_view error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to retrieve selfie")


@router.post("/api/wfh/selfie/{selfie_id}/action")
async def selfie_action(selfie_id: int, request: Request):
    """
    HR approve or reject a WFH attendance record.
    Expects JSON body: { reviewer_user_id, action, comment }
    """
    body               = await request.json()
    reviewer_user_id   = (body.get("reviewer_user_id") or "").strip()
    reviewer           = _lookup_reviewer(reviewer_user_id)

    action     = (body.get("action") or "").strip().lower()
    comment    = (body.get("comment") or "").strip()
    client_ip  = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    if action not in ("approve", "reject"):
        raise HTTPException(status_code=422, detail="action must be 'approve' or 'reject'")
    if not comment:
        raise HTTPException(status_code=422, detail="comment is required for HR actions")

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Fetch selfie and current wfh status
        cur.execute("""
            SELECT s.id, s.wfh_attendance_id, s.employee_id, s.storage_key,
                   w.status AS wfh_status
            FROM attendance_selfies s
            JOIN wfh_attendance w ON w.id = s.wfh_attendance_id
            WHERE s.id = %s AND s.status = 'active'
        """, (selfie_id,))
        selfie = cur.fetchone()
        if not selfie:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Active selfie record not found")

        old_status = selfie["wfh_status"]
        new_status = "APPROVED" if action == "approve" else "REJECTED"

        # Update wfh_attendance status
        cur.execute(
            "UPDATE wfh_attendance SET status = %s WHERE id = %s",
            (new_status, selfie["wfh_attendance_id"])
        )

        # If rejected, also mark attendance as ABSENT
        if action == "reject":
            cur.execute("""
                UPDATE attendance a
                JOIN wfh_attendance w ON w.attendance_id = a.id
                SET a.status = 'ABSENT'
                WHERE w.id = %s
            """, (selfie["wfh_attendance_id"],))

        # Write audit log
        cur.execute("""
            INSERT INTO selfie_access_log
                (selfie_id, wfh_attendance_id, employee_id,
                 accessed_by_user_id, accessed_by_name, accessed_by_role,
                 access_type, hr_comment, wfh_status_before, wfh_status_after,
                 ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            selfie_id, selfie["wfh_attendance_id"], selfie["employee_id"],
            reviewer["user_id"], reviewer["full_name"], reviewer["role"],
            action, comment, old_status, new_status,
            client_ip, user_agent[:500],
        ))

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "new_status": new_status}

    except HTTPException:
        raise
    except Exception as exc:
        log.error("selfie_action error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process HR action")
