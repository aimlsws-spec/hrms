"""
WFO attendance helpers — selfie + geo (office location) replaces biometric punching.

Used by wfh_geo_api and wfh_selfie_api so that a WFO employee's check-in, made through
the same selfie / geo flows as WFH, is also reflected in daily_work_mode and the
attendance late flag (which the HR WFO view and the late-arrival rules read).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from backend.core.attendance_rules import LATE_THRESHOLD, apply_late_flags

log = logging.getLogger(__name__)


def get_work_mode(cur, employee_id: str) -> str:
    """Return the employee's committed work mode ('WFO' or 'WFH'; WFH if unset)."""
    cur.execute(
        "SELECT default_work_mode FROM employees WHERE employee_code = %s LIMIT 1",
        (employee_id,),
    )
    row = cur.fetchone()
    mode = (row["default_work_mode"] if isinstance(row, dict) else (row[0] if row else None))
    return "WFO" if mode == "WFO" else "WFH"


def get_office_location(conn) -> Optional[dict]:
    """
    Office geo-fence set by HR (wfh_system_config).
    Returns {latitude, longitude, radius_meters} or None when not configured.
    """
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT config_key, config_value FROM wfh_system_config "
        "WHERE config_key IN ('office_latitude','office_longitude','office_geo_radius_meters','wfh_geo_radius_meters')"
    )
    cfg = {r["config_key"]: r["config_value"] for r in cur.fetchall()}
    cur.close()
    try:
        lat = float(cfg["office_latitude"])
        lon = float(cfg["office_longitude"])
    except (KeyError, TypeError, ValueError):
        return None
    if lat == 0.0 and lon == 0.0:
        return None
    radius = int(cfg.get("office_geo_radius_meters") or cfg.get("wfh_geo_radius_meters") or 300)
    return {"latitude": lat, "longitude": lon, "radius_meters": radius}


def mark_wfo_present(cur, employee_id: str, now: datetime, method: str) -> None:
    """
    Apply the late-arrival policy for any selfie / geo check-in (WFO or WFH), and for
    WFO employees also mirror it into daily_work_mode. Caller owns the transaction.
    """
    today = now.date()
    apply_late_flags(cur, employee_id, today, now.time())
    if get_work_mode(cur, employee_id) != "WFO":
        return
    cur.execute(
        """INSERT INTO daily_work_mode (employee_id, work_date, mode, checked_in_at, check_in_method, status)
           VALUES (%s, %s, 'WFO', %s, %s, 'PRESENT')
           ON DUPLICATE KEY UPDATE
               checked_in_at   = COALESCE(checked_in_at, VALUES(checked_in_at)),
               check_in_method = VALUES(check_in_method),
               status          = 'PRESENT'""",
        (employee_id, today, now, method),
    )
    cur.execute(
        "UPDATE attendance SET check_in_source = %s WHERE employee_id = %s AND date = %s",
        (f"WFO_{method}", employee_id, today),
    )
    log.info("mark_wfo_present: emp=%r method=%s late=%s", employee_id, method, now.time() > LATE_THRESHOLD)
