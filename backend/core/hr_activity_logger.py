"""
HR Activity Logger for HRMS.
Tracks and audits all actions performed by HR / Admin users:
- Applying leaves on behalf of employees
- Approving / rejecting leaves
- Applying or ignoring late-arrival deductions
- Attendance regularizations and manual edits
- Employee profile and salary adjustments
"""
import logging
from typing import Optional, Dict, Any, List
import mysql.connector
from backend.config import DB_CONFIG

log = logging.getLogger(__name__)


def _get_db():
    return mysql.connector.connect(**DB_CONFIG)


def log_hr_activity(
    performed_by: str,
    performed_name: str,
    action: str,
    details: str,
    target_employee_id: Optional[str] = None,
    target_employee_name: Optional[str] = None,
    ip_address: str = "127.0.0.1",
    role: str = "hr",
) -> bool:
    """Log an action performed by HR or Admin into hr_activity_logs."""
    try:
        conn = _get_db()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO hr_activity_logs 
                (performed_by, performed_name, performed_role, action,
                 target_employee_id, target_employee_name, details, ip_address, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            (
                str(performed_by or "HR"),
                str(performed_name or "HR Admin"),
                str(role or "hr"),
                str(action).upper(),
                str(target_employee_id) if target_employee_id else None,
                str(target_employee_name) if target_employee_name else None,
                str(details or ""),
                str(ip_address or "127.0.0.1"),
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as exc:
        log.warning("log_hr_activity failed: %s", exc)
        return False


def get_hr_activity_logs(
    page: int = 1,
    limit: int = 50,
    action: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    role: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieve filtered, paginated HR activity logs."""
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        conditions = ["1=1"]
        params: List[Any] = []

        if action and action.strip():
            conditions.append("action = %s")
            params.append(action.strip().upper())

        if role and role.strip():
            conditions.append("LOWER(performed_role) = %s")
            params.append(role.strip().lower())

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                "(performed_name LIKE %s OR performed_by LIKE %s OR "
                "target_employee_name LIKE %s OR target_employee_id LIKE %s OR details LIKE %s)"
            )
            params.extend([term, term, term, term, term])

        if start_date and start_date.strip():
            conditions.append("DATE(created_at) >= %s")
            params.append(start_date.strip())

        if end_date and end_date.strip():
            conditions.append("DATE(created_at) <= %s")
            params.append(end_date.strip())

        where_clause = " AND ".join(conditions)

        # Count total
        count_query = f"SELECT COUNT(*) AS total FROM hr_activity_logs WHERE {where_clause}"
        cur.execute(count_query, params)
        total = int((cur.fetchone() or {}).get("total", 0) or 0)

        # Fetch records
        offset = max(0, (page - 1) * limit)
        fetch_query = f"""
            SELECT id, performed_by, performed_name, performed_role, action,
                   target_employee_id, target_employee_name, details, ip_address,
                   created_at
            FROM hr_activity_logs
            WHERE {where_clause}
            ORDER BY id DESC
            LIMIT %s OFFSET %s
        """
        fetch_params = list(params) + [limit, offset]
        cur.execute(fetch_query, fetch_params)
        raw_logs = cur.fetchall()

        logs = []
        for r in raw_logs:
            ca = r.get("created_at")
            logs.append({
                "id": r["id"],
                "performed_by": r["performed_by"],
                "performed_name": r["performed_name"],
                "performed_role": r.get("performed_role") or "hr",
                "action": r["action"],
                "target_employee_id": r["target_employee_id"],
                "target_employee_name": r["target_employee_name"],
                "details": r["details"],
                "ip_address": r.get("ip_address") or "127.0.0.1",
                "created_at": ca.strftime("%Y-%m-%d %H:%M:%S") if ca and hasattr(ca, "strftime") else (str(ca) if ca else None),
            })

        cur.close()
        conn.close()

        return {
            "success": True,
            "logs": logs,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        }
    except Exception as exc:
        log.error("get_hr_activity_logs failed: %s", exc)
        return {"success": False, "message": str(exc), "logs": [], "total": 0}
