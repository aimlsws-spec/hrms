"""
WFH Geo-Attendance API — FastAPI router
/api/wfh/home-location/*  and  /api/wfh/geo-checkin  and  /api/hr/geo-*

Authentication model: same lightweight pattern as the rest of this HRMS.
Employee endpoints accept employee_id; HR-only endpoints require reviewer_user_id
and verify hr/admin role in the users table.
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
import uuid
from datetime import datetime
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

import mysql.connector
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.config import DB_CONFIG
from backend.core.time_tracking import require_desktop, finalize_day
from backend.core.wfo_attendance import get_office_location, get_work_mode

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)          # ensure all stage logs are emitted
if not log.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"))
    log.addHandler(_h)

router = APIRouter()


def _parse_client_ts(raw: Optional[str]) -> Optional[datetime]:
    """
    Convert a frontend ISO-8601 timestamp to a MySQL-safe naive datetime.
    Handles: '2026-06-03T08:42:52.776Z', '2026-06-03T08:42:52Z', '2026-06-03 08:42:52'
    Returns None on any failure so the column is stored as NULL rather than crashing.
    """
    if not raw:
        return None
    try:
        # Normalise: replace T separator and strip Z / +00:00 offset
        normalised = raw.strip().replace("T", " ").rstrip("Z")
        # Remove +HH:MM or -HH:MM offset if present
        if "+" in normalised:
            normalised = normalised[:normalised.index("+")]
        # Truncate to seconds (MySQL TIMESTAMP has no sub-second precision)
        normalised = normalised[:19]
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except Exception as exc:
        log.debug("_parse_client_ts: could not parse %r: %s", raw, exc)
        return None


# ── DB / helpers ───────────────────────────────────────────────────────────────

def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _sf(v, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two WGS-84 coordinates (Haversine)."""
    R = 6_371_000  # Earth radius in metres
    φ1, φ2 = radians(lat1), radians(lat2)
    Δφ = radians(lat2 - lat1)
    Δλ = radians(lon2 - lon1)
    a = sin(Δφ / 2) ** 2 + cos(φ1) * cos(φ2) * sin(Δλ / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def _cfg(conn, key: str, default: str) -> str:
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT config_value FROM wfh_system_config WHERE config_key = %s", (key,))
        row = cur.fetchone()
        cur.close()
        return row["config_value"] if row else default
    except Exception:
        return default


def _reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """Reverse-geocode coordinates to a display address string using Nominatim."""
    try:
        params = urllib.parse.urlencode({'lat': lat, 'lon': lon, 'format': 'json'})
        url = f'https://nominatim.openstreetmap.org/reverse?{params}'
        req = urllib.request.Request(url, headers={
            'User-Agent': 'HRMS-SeawindSolutions/1.0 (internal WFH geo attendance)',
            'Accept-Language': 'en',
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        return data.get("display_name") or None
    except Exception as exc:
        log.warning("_reverse_geocode failed for %.5f,%.5f: %s", lat, lon, exc)
    return None


def _geocode_address(address: str):
    """
    Forward-geocode an address using Nominatim (OpenStreetMap, free, no key needed).
    Returns (lat, lon) floats or None on failure.
    """
    if not address or not address.strip():
        return None
    try:
        params = urllib.parse.urlencode({'q': address.strip(), 'format': 'json', 'limit': 1})
        url    = f'https://nominatim.openstreetmap.org/search?{params}'
        req    = urllib.request.Request(url, headers={
            'User-Agent': 'HRMS-SeawindSolutions/1.0 (internal WFH geo attendance)',
            'Accept-Language': 'en',
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read().decode())
        if results:
            return float(results[0]['lat']), float(results[0]['lon'])
    except Exception as exc:
        log.warning("_geocode_address failed for %r: %s", address[:60], exc)
    return None


def _log_geo_attempt(
    conn,
    employee_id:     str,
    latitude:        float,
    longitude:       float,
    home_latitude:   Optional[float],
    home_longitude:  Optional[float],
    distance_meters: Optional[float],
    radius_meters:   int,
    within_radius:   bool,
    wfh_id:          Optional[int],
    client_ip:       str,
) -> None:
    """Insert a row into geo_attendance_attempts (both successful and failed)."""
    try:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO geo_attendance_attempts
               (employee_id, latitude, longitude,
                home_latitude, home_longitude,
                distance_meters, radius_meters, within_radius,
                wfh_id, client_ip)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (employee_id, latitude, longitude,
             home_latitude, home_longitude,
             round(distance_meters, 2) if distance_meters is not None else None,
             radius_meters, within_radius,
             wfh_id, client_ip[:45])
        )
        cur.close()
    except Exception as exc:
        log.warning("_log_geo_attempt failed: %s", exc)


def _verify_hr(reviewer_user_id: str) -> dict:
    uid = (reviewer_user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=403, detail="reviewer_user_id is required")
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT user_id, COALESCE(full_name, username, '') AS full_name, role "
            "FROM users WHERE user_id = %s LIMIT 1",
            (uid,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
    except Exception as exc:
        log.error("_verify_hr error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to verify reviewer")

    if not row:
        raise HTTPException(status_code=403, detail="Reviewer not found")
    if row["role"] not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="HR or admin role required")
    return {"user_id": str(row["user_id"]), "full_name": row["full_name"], "role": row["role"]}


# ── Pydantic models ────────────────────────────────────────────────────────────

class SetHomeLocationBody(BaseModel):
    employee_id:    str
    latitude:       float
    longitude:      float
    address_label:  Optional[str] = None
    registered_via: Optional[str] = "employee_gps"  # employee_gps | hr_manual
    reviewer_user_id: Optional[str] = None           # required when HR sets it


class ChangeRequestBody(BaseModel):
    employee_id:    str
    latitude:       float
    longitude:      float
    address_label:  Optional[str] = None
    reason:         Optional[str] = None


class HRActionBody(BaseModel):
    reviewer_user_id: str
    action:           str   # 'approve' | 'reject'
    hr_comment:       Optional[str] = None


class GeoCheckinBody(BaseModel):
    employee_id:      str
    latitude:         float
    longitude:        float
    idempotency_key:  str
    client_timestamp: Optional[str] = None
    address:          Optional[str] = None


class GeoCheckoutBody(BaseModel):
    employee_id:      str
    latitude:         float
    longitude:        float
    client_timestamp: Optional[str] = None
    address:          Optional[str] = None


class GeoConfigBody(BaseModel):
    radius_meters:        Optional[int] = None
    reviewer_user_id:     str
    wfh_geo_enforce:      Optional[bool] = None
    office_geo_enforce:   Optional[bool] = None
    office_latitude:      Optional[float] = None
    office_longitude:     Optional[float] = None
    office_radius_meters: Optional[int] = None


class OfficeLocationBody(BaseModel):
    reviewer_user_id: str
    latitude:         float
    longitude:        float
    radius_meters:    int = 200
    enforce_radius:   Optional[bool] = None   # False = test mode: record distance but do not block


# ── Home location endpoints ────────────────────────────────────────────────────

@router.get("/api/wfh/home-location/{employee_id}")
def get_home_location(employee_id: str):
    """
    Return the registered home GPS coordinates for an employee.
    Returns { found: false } when no location is saved yet.
    """
    emp_id = employee_id.strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT id, employee_id, latitude, longitude, address_label, "
            "registered_via, updated_by, updated_at "
            "FROM employee_home_locations WHERE employee_id = %s LIMIT 1",
            (emp_id,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return {"found": False}

        updated_at = row["updated_at"]
        return {
            "found":          True,
            "id":             row["id"],
            "employee_id":    row["employee_id"],
            "latitude":       float(row["latitude"]),
            "longitude":      float(row["longitude"]),
            "address_label":  row["address_label"],
            "registered_via": row["registered_via"],
            "updated_by":     row["updated_by"],
            "updated_at":     updated_at.isoformat() if updated_at else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("get_home_location error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch home location")


@router.get("/api/wfh/reverse-geocode")
def reverse_geocode_endpoint(lat: float, lon: float):
    """Reverse-geocode a coordinate pair to a human-readable address label (Nominatim)."""
    if abs(lat) > 90 or abs(lon) > 180:
        raise HTTPException(status_code=422, detail="Invalid coordinates")
    address = _reverse_geocode(lat, lon)
    return {"address": address}


@router.post("/api/wfh/home-location")
async def set_home_location(body: SetHomeLocationBody):
    """
    Create or update an employee's home location.

    - Employee calling from home: registered_via='employee_gps', no reviewer_user_id needed.
    - HR setting manually: registered_via='hr_manual', reviewer_user_id required.
    """
    emp_id = (body.employee_id or "").strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")

    if abs(body.latitude) > 90 or abs(body.longitude) > 180:
        raise HTTPException(status_code=422, detail="Invalid GPS coordinates")

    via      = (body.registered_via or "employee_gps").strip()
    updater  = None

    # HR-manual calls must supply a valid reviewer
    if via == "hr_manual":
        reviewer = _verify_hr(body.reviewer_user_id or "")
        updater  = reviewer["user_id"]
    else:
        updater = emp_id  # employee self-registers

    addr_label = (body.address_label or "").strip() or None

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Employees may only set their home location once.
        # Subsequent changes require an HR-approved change request.
        if via != "hr_manual":
            cur.execute(
                "SELECT id FROM employee_home_locations WHERE employee_id = %s LIMIT 1",
                (emp_id,)
            )
            row = cur.fetchone()
            cur.close()
            if row:
                conn.close()
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Home location already set. "
                        "To change your home location please submit a change request "
                        "and wait for HR approval."
                    ),
                )
        else:
            cur.close()

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO employee_home_locations
                (employee_id, latitude, longitude, address_label, registered_via, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                latitude       = VALUES(latitude),
                longitude      = VALUES(longitude),
                address_label  = VALUES(address_label),
                registered_via = VALUES(registered_via),
                updated_by     = VALUES(updated_by)
        """, (emp_id, body.latitude, body.longitude, addr_label, via, updater))

        # Audit log — non-fatal if table doesn't exist yet
        try:
            cur.execute(
                """INSERT INTO employee_home_location_audit
                       (employee_id, latitude, longitude, address_label, registered_via, changed_by)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (emp_id, body.latitude, body.longitude, addr_label, via, updater)
            )
        except Exception as audit_exc:
            log.warning("home_location audit insert skipped: %s", audit_exc)

        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Home location saved successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("set_home_location error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to save home location: {exc}")


# ── Geo Check-in endpoint ──────────────────────────────────────────────────────

@router.post("/api/wfh/geo-checkin")
async def wfh_geo_checkin(body: GeoCheckinBody, request: Request):
    """WFH geo check-in — validates GPS location against registered home, auto-approves if within radius."""
    # ── Stage 0: request validation ───────────────────────────────────────────
    require_desktop(request)
    emp_id = (body.employee_id or "").strip()
    log.info("[geo-checkin] STAGE 0  emp=%r lat=%.6f lon=%.6f idem=%s",
             emp_id, body.latitude, body.longitude, body.idempotency_key)

    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    if abs(body.latitude) > 90 or abs(body.longitude) > 180:
        raise HTTPException(status_code=422, detail="Invalid GPS coordinates")
    try:
        uuid.UUID(body.idempotency_key, version=4)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="idempotency_key must be a valid UUID v4")

    client_ip  = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    now        = datetime.now()
    today      = now.date()

    conn = None
    cur  = None
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # ── Stage 1: DB connection ─────────────────────────────────────────────
        log.info("[geo-checkin] STAGE 1  db connected")

        # ── Stage 2: employee lookup ───────────────────────────────────────────
        log.info("[geo-checkin] STAGE 2  employee lookup emp=%r", emp_id)
        cur.execute(
            "SELECT employee_code FROM employees WHERE employee_code = %s LIMIT 1",
            (emp_id,)
        )
        if not cur.fetchone():
            log.warning("[geo-checkin] STAGE 2  FAIL employee not found emp=%r", emp_id)
            raise HTTPException(status_code=404,
                detail="Employee not found. Make sure your employee profile is set up correctly.")

        # ── Stage 3: reference location (office for WFO, home for WFH) ────────
        work_mode = get_work_mode(cur, emp_id)
        is_wfo    = work_mode == "WFO"
        place     = "the office" if is_wfo else "home"
        log.info("[geo-checkin] STAGE 3  reference location emp=%r mode=%s", emp_id, work_mode)
        if is_wfo:
            office = get_office_location(conn)
            if not office:
                raise HTTPException(status_code=422,
                    detail="Office location is not configured yet. Please ask HR to set it under WFH Geo Logs → Configuration.")
            home_lat, home_lon = office["latitude"], office["longitude"]
            radius_m = office["radius_meters"]
        else:
            cur.execute(
                "SELECT latitude, longitude FROM employee_home_locations WHERE employee_id = %s",
                (emp_id,)
            )
            home = cur.fetchone()
            if not home:
                log.warning("[geo-checkin] STAGE 3  FAIL no home location for emp=%r", emp_id)
                raise HTTPException(status_code=422,
                    detail="Home location not registered. Please go to My Profile → Home Location and set your GPS coordinates first.")

            home_lat = float(home["latitude"])
            home_lon = float(home["longitude"])
            if home_lat == 0.0 and home_lon == 0.0:
                log.warning("[geo-checkin] STAGE 3  FAIL home coords are 0,0 for emp=%r (geocoding failed earlier)", emp_id)
                raise HTTPException(status_code=422,
                    detail="Home location coordinates are invalid (0, 0). Please re-set your home location from My Profile.")
            radius_m = int(_cfg(conn, "wfh_geo_radius_meters", "300"))
        log.info("[geo-checkin] STAGE 3  OK ref=(%.6f,%.6f) current=(%.6f,%.6f)",
                 home_lat, home_lon, body.latitude, body.longitude)

        # ── Stage 4: distance calculation ─────────────────────────────────────
        log.info("[geo-checkin] STAGE 4  calculating distance")
        distance_m = _haversine_meters(body.latitude, body.longitude, home_lat, home_lon)
        log.info("[geo-checkin] STAGE 4  OK distance=%.1f m  radius=%d m  within=%s",
                 distance_m, radius_m, distance_m <= radius_m)

        # Flexible punch: HR can toggle enforcement for WFO and WFH employees.
        # When enforcement is disabled ('0'), the punch succeeds from any location while recording actual coordinates & distance.
        if is_wfo:
            enforce = _cfg(conn, "office_geo_enforce", "0") != "0"
        else:
            enforce = _cfg(conn, "wfh_geo_enforce", "0") != "0"

        punch_in_addr = (body.address or "").strip()[:500] if body.address else None
        if not punch_in_addr:
            try:
                punch_in_addr = _reverse_geocode(body.latitude, body.longitude)
            except Exception:
                punch_in_addr = None

        if enforce and distance_m > radius_m:
            _log_geo_attempt(conn, emp_id,
                body.latitude, body.longitude, home_lat, home_lon,
                distance_m, radius_m, within_radius=False, wfh_id=None, client_ip=client_ip)
            conn.commit()
            cur.close(); conn.close()
            return {
                "success":         False,
                "within_radius":   False,
                "distance_meters": round(distance_m, 1),
                "radius_meters":   radius_m,
                "message": (
                    f"You are {round(distance_m)} m from {place} (allowed radius: {radius_m} m). "
                    + ("Please move to the office premises or use Selfie Attendance."
                       if is_wfo else
                       "Please use Selfie Attendance or contact HR if your home address has changed.")
                ),
            }

        # ── Stage 4b: idempotency + duplicate session checks ──────────────────
        cur.execute("SELECT id, status FROM wfh_attendance WHERE idempotency_key = %s",
                    (body.idempotency_key,))
        existing = cur.fetchone()
        if existing:
            cur.close(); conn.close()
            return {"success": True, "wfh_id": existing["id"], "status": existing["status"],
                    "within_radius": True, "distance_meters": round(distance_m, 1), "duplicate": True}

        cur.execute("SELECT id, status, geo_latitude FROM wfh_attendance WHERE employee_id = %s AND DATE(punch_in_at) = %s",
                    (emp_id, today))
        prior = cur.fetchone()
        if prior:
            if prior["status"] == "PENDING_SELFIE" and prior["geo_latitude"] is None:
                # Session left behind by the old selfie-only punch-in (no location, no selfie).
                # Location + selfie are both mandatory now, so redo it as a proper geo session
                # and undo the premature "present" mark; the selfie upload will record it.
                cur.execute("""
                    UPDATE wfh_attendance
                       SET attendance_method = 'GEO', punch_in_at = %s, punch_out_at = NULL,
                           duration_minutes = NULL, geo_latitude = %s, geo_longitude = %s,
                           geo_distance_meters = %s, punch_in_address = %s, idempotency_key = %s
                     WHERE id = %s
                """, (now, body.latitude, body.longitude, round(distance_m, 2),
                      punch_in_addr, body.idempotency_key, prior["id"]))
                cur.execute("DELETE FROM attendance WHERE employee_id = %s AND date = %s", (emp_id, today))
                cur.execute("""UPDATE daily_work_mode SET status = 'PENDING', checked_in_at = NULL,
                               check_in_method = NULL WHERE employee_id = %s AND work_date = %s""",
                            (emp_id, today))
                _log_geo_attempt(conn, emp_id,
                    body.latitude, body.longitude, home_lat, home_lon,
                    distance_m, radius_m, within_radius=True, wfh_id=prior["id"], client_ip=client_ip)
                conn.commit()
                cur.close(); conn.close()
                return {
                    "success": True, "wfh_id": prior["id"], "status": "PENDING_SELFIE",
                    "selfie_required": True, "attendance_method": "GEO", "within_radius": True,
                    "distance_meters": round(distance_m, 1), "radius_meters": radius_m,
                    "punch_in_at": now.isoformat(),
                    "punch_in_address": punch_in_addr,
                    "message": f"Location verified ({round(distance_m)} m from {place}). Now take your selfie to complete check-in.",
                }
            cur.close(); conn.close()
            raise HTTPException(status_code=409, detail="You have already punched in today.")

        # ── Stage 5: create wfh_attendance record ─────────────────────────────
        client_ts = _parse_client_ts(body.client_timestamp)
        log.info("[geo-checkin] STAGE 5  inserting wfh_attendance emp=%r lat=%.6f lon=%.6f dist=%.1f client_ts=%s",
                 emp_id, body.latitude, body.longitude, distance_m, client_ts)
        cur.execute("""
            INSERT INTO wfh_attendance
                (employee_id, punch_in_at, idempotency_key,
                 status, attendance_method,
                 geo_latitude, geo_longitude, geo_distance_meters,
                 punch_in_address,
                 client_ip, user_agent, client_timestamp)
            VALUES (%s, %s, %s, 'PENDING_SELFIE', 'GEO', %s, %s, %s, %s, %s, %s, %s)
        """, (emp_id, now, body.idempotency_key,
              body.latitude, body.longitude, round(distance_m, 2),
              punch_in_addr, client_ip, user_agent[:500], client_ts))
        wfh_id = cur.lastrowid
        log.info("[geo-checkin] STAGE 5  wfh_attendance inserted wfh_id=%s", wfh_id)

        # Mirror initial location to attendance
        cur.execute("""
            INSERT INTO attendance (employee_id, date, check_in, status, punch_in_latitude, punch_in_longitude, punch_in_address, work_mode)
            VALUES (%s, %s, %s, 'PRESENT', %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                check_in = VALUES(check_in),
                punch_in_latitude = VALUES(punch_in_latitude),
                punch_in_longitude = VALUES(punch_in_longitude),
                punch_in_address = VALUES(punch_in_address),
                work_mode = VALUES(work_mode)
        """, (emp_id, today, now.strftime("%H:%M:%S"), body.latitude, body.longitude, punch_in_addr, ("WFO" if is_wfo else "WFH")))

        # Attendance is NOT recorded yet: location AND selfie are both mandatory.
        # wfh_selfie_api.selfie_upload completes the check-in once the selfie arrives.

        # ── Stage 6: commit ────────────────────────────────────────────────────
        log.info("[geo-checkin] STAGE 6  committing transaction")
        _log_geo_attempt(conn, emp_id,
            body.latitude, body.longitude, home_lat, home_lon,
            distance_m, radius_m, within_radius=True, wfh_id=wfh_id, client_ip=client_ip)
        conn.commit()
        cur.close(); conn.close()
        log.info("[geo-checkin] STAGE 6  OK — geo attendance committed wfh_id=%s emp=%r", wfh_id, emp_id)

        return {
            "success":           True,
            "wfh_id":            wfh_id,
            "status":            "PENDING_SELFIE",
            "selfie_required":   True,
            "attendance_method": "GEO",
            "within_radius":     True,
            "distance_meters":   round(distance_m, 1),
            "radius_meters":     radius_m,
            "punch_in_at":       now.isoformat(),
            "message":           f"Location verified ({round(distance_m)} m from {place}). Now take your selfie to complete check-in.",
        }

    except HTTPException:
        raise
    except mysql.connector.IntegrityError as exc:
        log.error("[geo-checkin] IntegrityError: %s", exc, exc_info=True)
        if "uq_emp_date" in str(exc) or "uq_idempotency" in str(exc) or "Duplicate" in str(exc):
            raise HTTPException(status_code=409, detail="WFH session already exists for today")
        raise HTTPException(status_code=422, detail=f"Database constraint: {exc}")
    except mysql.connector.Error as exc:
        log.error("[geo-checkin] MySQL error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    except Exception as exc:
        log.error("[geo-checkin] Unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Geo check-in failed: {exc}")
    finally:
        try:
            if cur:  cur.close()
            if conn: conn.close()
        except Exception:
            pass


# ── Geo Punch-Out endpoint ────────────────────────────────────────────────────

@router.post("/api/wfh/geo-checkout")
async def wfh_geo_checkout(body: GeoCheckoutBody, request: Request):
    """
    WFH geo punch-out.
    Validates the employee's current GPS location against their registered home
    coordinates. If within radius, closes today's open geo attendance session.
    """
    require_desktop(request)
    emp_id = (body.employee_id or "").strip()
    log.info("[geo-checkout] emp=%r lat=%.6f lon=%.6f", emp_id, body.latitude, body.longitude)

    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    if abs(body.latitude) > 90 or abs(body.longitude) > 180:
        raise HTTPException(status_code=422, detail="Invalid GPS coordinates")

    now   = datetime.now()
    today = now.date()
    conn  = None
    cur   = None

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # ── Stage 1: reference location (office for WFO, home for WFH) ─────────
        is_wfo = get_work_mode(cur, emp_id) == "WFO"
        place  = "the office" if is_wfo else "your registered home location"
        if is_wfo:
            office = get_office_location(conn)
            if not office:
                raise HTTPException(status_code=422,
                    detail="Office location is not configured yet. Please ask HR to set it.")
            home_lat, home_lon = office["latitude"], office["longitude"]
            radius_m = office["radius_meters"]
        else:
            cur.execute(
                "SELECT latitude, longitude FROM employee_home_locations WHERE employee_id = %s",
                (emp_id,)
            )
            home = cur.fetchone()
            if not home:
                log.warning("[geo-checkout] no home location for emp=%r", emp_id)
                raise HTTPException(status_code=422,
                    detail="Home location not registered. Please set your home location from My Profile first.")

            home_lat = float(home["latitude"])
            home_lon = float(home["longitude"])
            radius_m = int(_cfg(conn, "wfh_geo_radius_meters", "300"))

        # ── Stage 2: distance validation ──────────────────────────────────────
        distance_m = _haversine_meters(body.latitude, body.longitude, home_lat, home_lon)
        log.info("[geo-checkout] distance=%.1f m  radius=%d m  within=%s",
                 distance_m, radius_m, distance_m <= radius_m)

        # Flexible punch: HR can toggle enforcement for WFO and WFH employees.
        if is_wfo:
            enforce = _cfg(conn, "office_geo_enforce", "0") != "0"
        else:
            enforce = _cfg(conn, "wfh_geo_enforce", "0") != "0"

        punch_out_addr = (body.address or "").strip()[:500] if getattr(body, "address", None) else None
        if not punch_out_addr:
            try:
                punch_out_addr = _reverse_geocode(body.latitude, body.longitude)
            except Exception:
                punch_out_addr = None

        if enforce and distance_m > radius_m:
            return {
                "success":         False,
                "within_radius":   False,
                "distance_meters": round(distance_m, 1),
                "radius_meters":   radius_m,
                "message": (
                    f"You are {round(distance_m)} m from {place} "
                    f"(allowed radius: {radius_m} m). "
                    + ("Please punch out from the office premises." if is_wfo else
                       "Please use Selfie Attendance or contact HR if your address has changed.")
                ),
            }

        # ── Stage 3: find the open geo session for today ───────────────────────
        cur.execute("""
            SELECT id, punch_in_at, status
            FROM wfh_attendance
            WHERE employee_id = %s
              AND DATE(punch_in_at) = %s
              AND attendance_method = 'GEO'
              AND punch_out_at IS NULL
            LIMIT 1
        """, (emp_id, today))
        session = cur.fetchone()
        if not session:
            log.warning("[geo-checkout] no open geo session for emp=%r today", emp_id)
            raise HTTPException(status_code=404,
                detail="No open Geo attendance session found for today. You may have already punched out.")

        if session["status"] == "PENDING_SELFIE":
            raise HTTPException(status_code=409,
                detail="Take your check-in selfie first. Attendance is complete only after location and selfie.")

        punch_in   = session["punch_in_at"]
        duration_m = int((now - punch_in).total_seconds() / 60)
        wfh_id     = session["id"]

        # ── Stage 4: close the session ─────────────────────────────────────────
        cur.execute("""
            UPDATE wfh_attendance
            SET punch_out_at = %s, duration_minutes = %s,
                punch_out_latitude = %s, punch_out_longitude = %s,
                punch_out_distance_meters = %s, punch_out_address = %s
            WHERE id = %s
        """, (now, duration_m, body.latitude, body.longitude, round(distance_m, 2), punch_out_addr, wfh_id))

        # Mirror punch-out to attendance table
        cur.execute("""
            UPDATE attendance
            SET check_out = %s,
                punch_out_latitude = %s, punch_out_longitude = %s,
                punch_out_address = %s
            WHERE employee_id = %s AND date = %s
        """, (now.strftime("%H:%M:%S"), body.latitude, body.longitude, punch_out_addr, emp_id, today))

        totals = finalize_day(cur, emp_id, wfh_id, punch_in, now)

        conn.commit()
        log.info("[geo-checkout] OK wfh_id=%s emp=%r duration=%dm", wfh_id, emp_id, duration_m)

        h, m = divmod(duration_m, 60)
        dur_str = f"{h}h {m}m" if h else f"{m}m"
        return {
            "success":                   True,
            "punch_out_at":              now.isoformat(),
            "duration_minutes":          duration_m,
            "break_minutes":             totals["break_minutes"],
            "work_minutes":              totals["work_minutes"],
            "distance_meters":           round(distance_m, 1),
            "punch_out_latitude":        body.latitude,
            "punch_out_longitude":       body.longitude,
            "punch_out_distance_meters": round(distance_m, 1),
            "punch_out_address":         punch_out_addr,
            "message":                   f"Geo attendance completed. Duration: {dur_str}. Net working time: {totals['work_minutes'] // 60}h {totals['work_minutes'] % 60}m.",
        }

    except HTTPException:
        raise
    except mysql.connector.Error as exc:
        log.error("[geo-checkout] MySQL error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    except Exception as exc:
        log.error("[geo-checkout] Unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Geo checkout failed: {exc}")
    finally:
        try:
            if cur:  cur.close()
            if conn: conn.close()
        except Exception:
            pass


# ── Geo history for an employee ────────────────────────────────────────────────

@router.get("/api/wfh/geo-history/{employee_id}")
def wfh_geo_history(employee_id: str, month: Optional[str] = None):
    """Return geo-only WFH records for an employee (optionally filtered to month YYYY-MM)."""
    emp_id = employee_id.strip()
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        base = """
            SELECT id, punch_in_at, punch_out_at, duration_minutes,
                   status, geo_latitude, geo_longitude, geo_distance_meters
            FROM wfh_attendance
            WHERE employee_id = %s AND attendance_method = 'GEO'
        """
        params = [emp_id]
        if month:
            base += " AND DATE_FORMAT(punch_in_at, '%%Y-%%m') = %s"
            params.append(month)
        base += " ORDER BY punch_in_at DESC LIMIT 90"
        cur.execute(base, params)
        rows = cur.fetchall()
        cur.close(); conn.close()

        records = []
        for r in rows:
            records.append({
                "id":                  r["id"],
                "punch_in_at":         r["punch_in_at"].isoformat() if r["punch_in_at"] else None,
                "punch_out_at":        r["punch_out_at"].isoformat() if r["punch_out_at"] else None,
                "duration_minutes":    r["duration_minutes"],
                "status":              r["status"],
                "geo_latitude":        float(r["geo_latitude"])  if r["geo_latitude"]  else None,
                "geo_longitude":       float(r["geo_longitude"]) if r["geo_longitude"] else None,
                "geo_distance_meters": float(r["geo_distance_meters"]) if r["geo_distance_meters"] else None,
            })
        return {"success": True, "records": records}
    except Exception as exc:
        log.error("wfh_geo_history error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch geo history")


# ── HR endpoints ───────────────────────────────────────────────────────────────

@router.get("/api/hr/geo-config")
def get_geo_config(reviewer_user_id: str = ""):
    """HR/admin: get the configured geo radius and flexible punch enforcement settings."""
    _verify_hr(reviewer_user_id)
    try:
        conn = _db()
        radius = int(_cfg(conn, "wfh_geo_radius_meters", "300"))
        office = get_office_location(conn)
        office_enforce = _cfg(conn, "office_geo_enforce", "0") != "0"
        wfh_enforce = _cfg(conn, "wfh_geo_enforce", "0") != "0"
        conn.close()
        return {
            "success":            True,
            "radius_meters":      radius,
            "wfh_geo_radius_meters": radius,
            "office":             office,   # None until HR sets it; used for WFO geo attendance
            "enforce_radius":     office_enforce,
            "office_geo_enforce": office_enforce,
            "wfh_geo_enforce":    wfh_enforce,
        }
    except Exception as exc:
        log.error("get_geo_config error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch geo config")


@router.put("/api/hr/office-location")
async def update_office_location(body: OfficeLocationBody):
    """HR/admin: set the office coordinates + radius used for WFO geo attendance."""
    _verify_hr(body.reviewer_user_id)
    if abs(body.latitude) > 90 or abs(body.longitude) > 180 or (body.latitude == 0 and body.longitude == 0):
        raise HTTPException(status_code=422, detail="Invalid office coordinates")
    if not (20 <= body.radius_meters <= 2000):
        raise HTTPException(status_code=422, detail="Radius must be between 20 and 2000 metres")
    try:
        conn = _db()
        cur  = conn.cursor()
        for key, val in (
            ("office_latitude",          repr(body.latitude)),
            ("office_longitude",         repr(body.longitude)),
            ("office_geo_radius_meters", str(body.radius_meters)),
            *((("office_geo_enforce", "1" if body.enforce_radius else "0"),) if body.enforce_radius is not None else ()),
        ):
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                (key, val),
            )
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "office": {"latitude": body.latitude, "longitude": body.longitude,
                                            "radius_meters": body.radius_meters}}
    except Exception as exc:
        log.error("update_office_location error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update office location")


@router.put("/api/hr/geo-config")
async def update_geo_config(body: GeoConfigBody):
    """HR/admin: update geo radius and flexible punch enforcement settings."""
    _verify_hr(body.reviewer_user_id)
    try:
        conn = _db()
        cur  = conn.cursor()
        if body.radius_meters is not None:
            if not (20 <= body.radius_meters <= 5000):
                raise HTTPException(status_code=422, detail="Radius must be between 20 and 5000 metres")
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("wfh_geo_radius_meters", str(body.radius_meters))
            )
        if body.wfh_geo_enforce is not None:
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("wfh_geo_enforce", "1" if body.wfh_geo_enforce else "0")
            )
        if body.office_geo_enforce is not None:
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("office_geo_enforce", "1" if body.office_geo_enforce else "0")
            )
        if body.office_latitude is not None and body.office_longitude is not None:
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("office_latitude", repr(body.office_latitude))
            )
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("office_longitude", repr(body.office_longitude))
            )
        if body.office_radius_meters is not None:
            cur.execute(
                "INSERT INTO wfh_system_config (config_key, config_value) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)",
                ("office_geo_radius_meters", str(body.office_radius_meters))
            )
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Geo configuration updated successfully"}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("update_geo_config error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to update geo config")


@router.get("/api/hr/geo-attendance")
def hr_geo_attendance(
    reviewer_user_id: str = "",
    page: int = 1,
    per_page: int = 20,
    month: Optional[str] = None,
    employee_id: Optional[str] = None,
):
    """
    HR/admin: paginated list of all geo WFH attendance records
    with employee name, distance, coordinates.
    """
    _verify_hr(reviewer_user_id)
    per_page = min(per_page, 100)
    offset   = (max(page, 1) - 1) * per_page

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        conditions = ["w.attendance_method = 'GEO'"]
        params     = []

        if month:
            conditions.append("DATE_FORMAT(w.punch_in_at, '%%Y-%%m') = %s")
            params.append(month)
        if employee_id:
            conditions.append("w.employee_id = %s")
            params.append(employee_id.strip())

        where = "WHERE " + " AND ".join(conditions)

        count_sql = f"SELECT COUNT(*) AS total FROM wfh_attendance w {where}"
        cur.execute(count_sql, params)
        total = cur.fetchone()["total"]

        data_sql = f"""
            SELECT w.id, w.employee_id,
                   COALESCE(e.full_name, w.employee_id) AS employee_name,
                   COALESCE(e.department, '')            AS department,
                   COALESCE(e.title, '')                 AS job_title,
                   w.punch_in_at, w.punch_out_at, w.duration_minutes,
                   w.status, w.geo_latitude, w.geo_longitude, w.geo_distance_meters,
                   w.punch_out_latitude, w.punch_out_longitude, w.punch_out_distance_meters,
                   w.punch_in_address, w.punch_out_address,
                   COALESCE(a.work_mode, 'WFH')          AS work_mode
            FROM wfh_attendance w
            LEFT JOIN employees e ON e.employee_code = w.employee_id
            LEFT JOIN attendance a ON a.employee_id = w.employee_id AND a.date = DATE(w.punch_in_at)
            {where}
            ORDER BY w.punch_in_at DESC
            LIMIT %s OFFSET %s
        """
        cur.execute(data_sql, params + [per_page, offset])
        rows = cur.fetchall()
        cur.close(); conn.close()

        records = []
        for r in rows:
            records.append({
                "id":                        r["id"],
                "employee_id":               r["employee_id"],
                "employee_name":             r["employee_name"],
                "department":                r["department"],
                "job_title":                 r["job_title"],
                "punch_in_at":               r["punch_in_at"].isoformat()  if r["punch_in_at"]  else None,
                "punch_out_at":              r["punch_out_at"].isoformat() if r["punch_out_at"] else None,
                "duration_minutes":          r["duration_minutes"],
                "status":                    r["status"],
                "geo_latitude":              float(r["geo_latitude"])       if r["geo_latitude"]       else None,
                "geo_longitude":             float(r["geo_longitude"])      if r["geo_longitude"]      else None,
                "geo_distance_meters":       float(r["geo_distance_meters"]) if r["geo_distance_meters"] else None,
                "punch_in_address":          r.get("punch_in_address"),
                "punch_out_latitude":        float(r["punch_out_latitude"])        if r.get("punch_out_latitude")        else None,
                "punch_out_longitude":       float(r["punch_out_longitude"])       if r.get("punch_out_longitude")       else None,
                "punch_out_distance_meters": float(r["punch_out_distance_meters"]) if r.get("punch_out_distance_meters") else None,
                "punch_out_address":         r.get("punch_out_address"),
                "work_mode":                 r.get("work_mode") or "WFH",
            })

        return {
            "success":     True,
            "records":     records,
            "total":       total,
            "page":        page,
            "per_page":    per_page,
            "total_pages": max(1, -(-total // per_page)),  # ceiling division
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("hr_geo_attendance error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch geo attendance logs")


@router.get("/api/hr/home-locations")
def hr_home_locations(
    reviewer_user_id: str = "",
    page: int = 1,
    per_page: int = 50,
):
    """HR/admin: list all registered employee home locations."""
    _verify_hr(reviewer_user_id)
    per_page = min(per_page, 200)
    offset   = (max(page, 1) - 1) * per_page

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute("SELECT COUNT(*) AS total FROM employee_home_locations")
        total = cur.fetchone()["total"]

        cur.execute("""
            SELECT h.id, h.employee_id,
                   COALESCE(e.full_name, h.employee_id) AS employee_name,
                   COALESCE(e.department, '')            AS department,
                   h.latitude, h.longitude, h.address_label,
                   h.registered_via, h.updated_by, h.updated_at
            FROM employee_home_locations h
            LEFT JOIN employees e ON e.employee_code = h.employee_id
            ORDER BY h.updated_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        rows = cur.fetchall()
        cur.close(); conn.close()

        records = []
        for r in rows:
            records.append({
                "id":             r["id"],
                "employee_id":    r["employee_id"],
                "employee_name":  r["employee_name"],
                "department":     r["department"],
                "latitude":       float(r["latitude"]),
                "longitude":      float(r["longitude"]),
                "address_label":  r["address_label"],
                "registered_via": r["registered_via"],
                "updated_by":     r["updated_by"],
                "updated_at":     r["updated_at"].isoformat() if r["updated_at"] else None,
            })
        return {
            "success":     True,
            "records":     records,
            "total":       total,
            "page":        page,
            "per_page":    per_page,
            "total_pages": max(1, -(-total // per_page)),
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("hr_home_locations error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch home locations")


# ── HR: failed geo attempts ────────────────────────────────────────────────────

@router.get("/api/hr/geo-failed-attempts")
def hr_geo_failed_attempts(
    reviewer_user_id: str = "",
    page:             int = 1,
    per_page:         int = 20,
    month:            Optional[str] = None,
    employee_id:      Optional[str] = None,
    only_failed:      bool = True,
):
    """
    HR/admin: paginated log of geo attendance attempts.
    By default returns only failed attempts (within_radius=FALSE).
    Pass only_failed=false to see all attempts.
    """
    _verify_hr(reviewer_user_id)
    per_page = min(per_page, 100)
    offset   = (max(page, 1) - 1) * per_page

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        conditions: list[str] = []
        params: list = []

        if only_failed:
            conditions.append("a.within_radius = FALSE")
        if month:
            conditions.append("DATE_FORMAT(a.attempted_at, '%%Y-%%m') = %s")
            params.append(month)
        if employee_id:
            conditions.append("a.employee_id = %s")
            params.append(employee_id.strip())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"SELECT COUNT(*) AS total FROM geo_attendance_attempts a {where}",
            params
        )
        total = cur.fetchone()["total"]

        cur.execute(
            f"""SELECT a.id, a.employee_id,
                       COALESCE(e.full_name, a.employee_id) AS employee_name,
                       COALESCE(e.department, '')            AS department,
                       a.attempted_at,
                       a.latitude, a.longitude,
                       a.home_latitude, a.home_longitude,
                       a.distance_meters, a.radius_meters,
                       a.within_radius, a.wfh_id, a.client_ip
                FROM geo_attendance_attempts a
                LEFT JOIN employees e ON e.employee_code = a.employee_id
                {where}
                ORDER BY a.attempted_at DESC
                LIMIT %s OFFSET %s""",
            params + [per_page, offset]
        )
        rows = cur.fetchall()
        cur.close(); conn.close()

        records = []
        for r in rows:
            at = r["attempted_at"]
            records.append({
                "id":              r["id"],
                "employee_id":     r["employee_id"],
                "employee_name":   r["employee_name"],
                "department":      r["department"],
                "attempted_at":    at.isoformat() if at else None,
                "latitude":        float(r["latitude"])       if r["latitude"]       else None,
                "longitude":       float(r["longitude"])      if r["longitude"]      else None,
                "home_latitude":   float(r["home_latitude"])  if r["home_latitude"]  else None,
                "home_longitude":  float(r["home_longitude"]) if r["home_longitude"] else None,
                "distance_meters": float(r["distance_meters"]) if r["distance_meters"] else None,
                "radius_meters":   r["radius_meters"],
                "within_radius":   bool(r["within_radius"]),
                "wfh_id":          r["wfh_id"],
            })

        return {
            "success":     True,
            "records":     records,
            "total":       total,
            "page":        page,
            "per_page":    per_page,
            "total_pages": max(1, -(-total // per_page)),
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("hr_geo_failed_attempts error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to fetch geo attempt logs")


# ── Address geocoding endpoint (for HR to geocode an address directly) ─────────

class GeocodeAddressBody(BaseModel):
    employee_id:      str
    address:          str
    reviewer_user_id: Optional[str] = None   # HR sets for another employee; omit for self-service


@router.post("/api/wfh/home-location/from-address")
async def set_home_location_from_address(body: GeocodeAddressBody):
    """
    Geocode a text address and store as the employee's home location.
    Used by HR when manually setting an employee's home address.
    The employee's profile update endpoint uses the same logic inline.
    """
    emp_id = (body.employee_id or "").strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")

    # HR check when reviewer_user_id provided
    if body.reviewer_user_id:
        _verify_hr(body.reviewer_user_id)
        updater = body.reviewer_user_id
    else:
        updater = emp_id

    if not body.address or not body.address.strip():
        raise HTTPException(status_code=422, detail="address is required")

    coords = _geocode_address(body.address.strip())
    if not coords:
        return {
            "success":  False,
            "geocoded": False,
            "message":  "Could not geocode the provided address. Please verify the address or set location via GPS.",
        }

    lat, lon = coords
    try:
        conn = _db()
        cur  = conn.cursor()
        cur.execute(
            """INSERT INTO employee_home_locations
                   (employee_id, latitude, longitude, address_label, registered_via, updated_by)
               VALUES (%s, %s, %s, %s, 'geocoded', %s)
               ON DUPLICATE KEY UPDATE
                   latitude      = VALUES(latitude),
                   longitude     = VALUES(longitude),
                   address_label = VALUES(address_label),
                   registered_via = 'geocoded',
                   updated_by    = VALUES(updated_by)""",
            (emp_id, lat, lon, body.address.strip(), updater)
        )
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "geocoded": True, "message": "Home address geocoded and saved."}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("set_home_location_from_address db error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to save geocoded location: {exc}")


# ── Home Location Change Request endpoints ─────────────────────────────────────

@router.post("/api/wfh/home-location/change-request")
async def submit_change_request(body: ChangeRequestBody):
    """
    Employee submits a request to change their registered home location.
    Requires an existing home location. HR must approve before the change takes effect.
    """
    emp_id = (body.employee_id or "").strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    if abs(body.latitude) > 90 or abs(body.longitude) > 180:
        raise HTTPException(status_code=422, detail="Invalid GPS coordinates")

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        # Must have an existing home location to request a change
        cur.execute(
            "SELECT id FROM employee_home_locations WHERE employee_id = %s LIMIT 1",
            (emp_id,)
        )
        has_location = cur.fetchone()
        if not has_location:
            cur.close(); conn.close()
            raise HTTPException(
                status_code=422,
                detail="No home location is set yet. Please set your home location first.",
            )

        # Block if a pending request already exists
        cur.execute(
            "SELECT id FROM home_location_change_requests "
            "WHERE employee_id = %s AND status = 'pending' LIMIT 1",
            (emp_id,)
        )
        has_pending = cur.fetchone()
        cur.close()
        if has_pending:
            conn.close()
            raise HTTPException(
                status_code=409,
                detail="You already have a pending change request. Please wait for HR to review it.",
            )

        addr_label = (body.address_label or "").strip() or None
        reason     = (body.reason or "").strip() or None

        cur = conn.cursor()
        cur.execute(
            """INSERT INTO home_location_change_requests
                   (employee_id, requested_latitude, requested_longitude,
                    requested_address_label, request_reason)
               VALUES (%s, %s, %s, %s, %s)""",
            (emp_id, body.latitude, body.longitude, addr_label, reason)
        )
        request_id = cur.lastrowid
        conn.commit()
        cur.close(); conn.close()

        return {
            "success":    True,
            "request_id": request_id,
            "message":    "Change request submitted. You will be notified once HR reviews it.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("submit_change_request error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to submit change request")


@router.get("/api/wfh/home-location/change-request/status/{employee_id}")
def get_change_request_status(employee_id: str):
    """Return the most recent home-location change request for an employee."""
    emp_id = employee_id.strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT id, employee_id, requested_latitude, requested_longitude,
                      requested_address_label, request_reason,
                      status, hr_comment, reviewed_by, reviewed_at, created_at
               FROM home_location_change_requests
               WHERE employee_id = %s
               ORDER BY created_at DESC LIMIT 1""",
            (emp_id,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return {"found": False}

        return {
            "found":          True,
            "id":             row["id"],
            "employee_id":    row["employee_id"],
            "latitude":       float(row["requested_latitude"]),
            "longitude":      float(row["requested_longitude"]),
            "address_label":  row["requested_address_label"],
            "reason":         row["request_reason"],
            "status":         row["status"],
            "hr_comment":     row["hr_comment"],
            "reviewed_by":    row["reviewed_by"],
            "reviewed_at":    row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
            "created_at":     row["created_at"].isoformat() if row["created_at"] else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        # If the table doesn't exist yet, return no-request rather than crashing
        if "doesn't exist" in str(exc) or "1146" in str(exc):
            log.warning("home_location_change_requests table missing, returning found=False")
            return {"found": False}
        log.error("get_change_request_status error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch change request status: {exc}")


@router.get("/api/hr/home-location-requests")
def hr_home_location_requests(
    reviewer_user_id: str = "",
    status:           str = "pending",
    page:             int = 1,
    per_page:         int = 20,
):
    """HR/admin: paginated list of home-location change requests."""
    _verify_hr(reviewer_user_id)
    per_page = min(per_page, 100)
    offset   = (max(page, 1) - 1) * per_page

    allowed_statuses = {"pending", "approved", "rejected", "all"}
    if status not in allowed_statuses:
        status = "pending"

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        where  = "" if status == "all" else "WHERE r.status = %s"
        params = [] if status == "all" else [status]

        cur.execute(
            f"SELECT COUNT(*) AS total FROM home_location_change_requests r {where}",
            params
        )
        total = cur.fetchone()["total"]

        cur.execute(
            f"""SELECT r.id, r.employee_id,
                       COALESCE(e.full_name, r.employee_id) AS employee_name,
                       COALESCE(e.department, '')            AS department,
                       r.requested_latitude, r.requested_longitude,
                       r.requested_address_label, r.request_reason,
                       r.status, r.hr_comment, r.reviewed_by, r.reviewed_at, r.created_at,
                       h.address_label AS current_address_label,
                       h.latitude      AS current_latitude,
                       h.longitude     AS current_longitude
                FROM home_location_change_requests r
                LEFT JOIN employees e ON e.employee_code = r.employee_id
                LEFT JOIN employee_home_locations h ON h.employee_id = r.employee_id
                {where}
                ORDER BY r.created_at DESC
                LIMIT %s OFFSET %s""",
            params + [per_page, offset]
        )
        rows = cur.fetchall()
        cur.close(); conn.close()

        records = []
        for r in rows:
            records.append({
                "id":                    r["id"],
                "employee_id":           r["employee_id"],
                "employee_name":         r["employee_name"],
                "department":            r["department"],
                "requested_latitude":    float(r["requested_latitude"]),
                "requested_longitude":   float(r["requested_longitude"]),
                "requested_address":     r["requested_address_label"],
                "reason":                r["request_reason"],
                "status":                r["status"],
                "hr_comment":            r["hr_comment"],
                "reviewed_by":           r["reviewed_by"],
                "reviewed_at":           r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                "created_at":            r["created_at"].isoformat() if r["created_at"] else None,
                "current_address":       r["current_address_label"],
                "current_latitude":      float(r["current_latitude"])  if r["current_latitude"]  else None,
                "current_longitude":     float(r["current_longitude"]) if r["current_longitude"] else None,
            })

        return {
            "success":     True,
            "records":     records,
            "total":       total,
            "page":        page,
            "per_page":    per_page,
            "total_pages": max(1, -(-total // per_page)),
        }
    except HTTPException:
        raise
    except Exception as exc:
        if "doesn't exist" in str(exc) or "1146" in str(exc):
            return {"success": True, "records": [], "total": 0, "page": page, "per_page": per_page, "total_pages": 1}
        log.error("hr_home_location_requests error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch location change requests: {exc}")


@router.post("/api/hr/home-location-requests/{request_id}/action")
async def hr_action_change_request(request_id: int, body: HRActionBody):
    """
    HR approves or rejects a home-location change request.
    On approval the employee's home location is immediately updated.
    """
    reviewer = _verify_hr(body.reviewer_user_id or "")
    action   = (body.action or "").strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=422, detail="action must be 'approve' or 'reject'")

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT * FROM home_location_change_requests WHERE id = %s LIMIT 1",
            (request_id,)
        )
        req = cur.fetchone()
        if not req:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail="Change request not found")
        if req["status"] != "pending":
            cur.close(); conn.close()
            raise HTTPException(
                status_code=409,
                detail=f"Request is already {req['status']} and cannot be actioned again.",
            )

        now        = datetime.now()
        new_status = "approved" if action == "approve" else "rejected"
        hr_comment = (body.hr_comment or "").strip() or None

        cur = conn.cursor()
        cur.execute(
            """UPDATE home_location_change_requests
               SET status = %s, hr_comment = %s, reviewed_by = %s, reviewed_at = %s
               WHERE id = %s""",
            (new_status, hr_comment, reviewer["user_id"], now, request_id)
        )

        if action == "approve":
            emp_id     = req["employee_id"]
            lat        = float(req["requested_latitude"])
            lon        = float(req["requested_longitude"])
            addr_label = req["requested_address_label"]

            cur.execute(
                """INSERT INTO employee_home_locations
                       (employee_id, latitude, longitude, address_label, registered_via, updated_by)
                   VALUES (%s, %s, %s, %s, 'hr_manual', %s)
                   ON DUPLICATE KEY UPDATE
                       latitude       = VALUES(latitude),
                       longitude      = VALUES(longitude),
                       address_label  = VALUES(address_label),
                       registered_via = 'hr_manual',
                       updated_by     = VALUES(updated_by)""",
                (emp_id, lat, lon, addr_label, reviewer["user_id"])
            )

            # Audit log
            try:
                cur.execute(
                    """INSERT INTO employee_home_location_audit
                           (employee_id, latitude, longitude, address_label, registered_via, changed_by)
                       VALUES (%s, %s, %s, %s, 'hr_manual', %s)""",
                    (emp_id, lat, lon, addr_label, reviewer["user_id"])
                )
            except Exception as audit_exc:
                log.warning("home_location audit insert skipped: %s", audit_exc)

        conn.commit()
        cur.close(); conn.close()

        return {
            "success": True,
            "status":  new_status,
            "message": f"Change request {new_status}.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        log.error("hr_action_change_request error: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to action change request")
