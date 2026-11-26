"""
API Router for HR Management Features:
- Late-arrival deduction review & decisions (apply / ignore)
- HR Activity logs
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
import mysql.connector

from backend.config import DB_CONFIG
from backend.core.hr_activity_logger import log_hr_activity, get_hr_activity_logs

log = logging.getLogger(__name__)

router = APIRouter(tags=["HR Features"])


def _get_db():
    return mysql.connector.connect(**DB_CONFIG)


class LateDeductionActionRequest(BaseModel):
    action: str  # 'APPLY' or 'IGNORE'
    notes: Optional[str] = ""
    actor_id: Optional[str] = "hr"
    actor_name: Optional[str] = "HR Manager"


@router.get("/api/hr/late-deductions")
@router.get("/api/hr/salary-deductions")
def get_late_deductions(
    status: Optional[str] = Query(None, description="PENDING_REVIEW, APPLIED, IGNORED, or all"),
    deduction_type: Optional[str] = Query(None, description="LATE_ARRIVAL, UNPAID_LEAVE, or all"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    """Retrieve salary deduction reviews (late-arrival and unpaid leave) for HR decision."""
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        now = datetime.now()
        target_year = year or now.year
        target_month = month or now.month

        conditions = ["1=1"]
        params: List[Any] = []

        if deduction_type and deduction_type.strip().upper() != "ALL":
            conditions.append("ad.deduction_type = %s")
            params.append(deduction_type.strip().upper())

        if year:
            conditions.append("ad.year = %s")
            params.append(target_year)
        if month:
            conditions.append("ad.month = %s")
            params.append(target_month)

        if status and status.strip().upper() != "ALL":
            conditions.append("ad.status = %s")
            params.append(status.strip().upper())

        where_clause = " AND ".join(conditions)

        query = f"""
            SELECT ad.id, ad.employee_id, ad.year, ad.month, ad.deduction_type,
                   ad.late_count, ad.half_days_deducted, ad.amount, ad.status,
                   ad.reviewed_by, ad.reviewed_at, ad.review_notes, ad.created_at,
                   COALESCE(u.full_name, e.full_name, ad.employee_id) AS employee_name,
                   COALESCE(e.department, 'General') AS department,
                   e.title AS job_title
            FROM attendance_deductions ad
            LEFT JOIN users u ON u.user_id = ad.employee_id
            LEFT JOIN employees e ON e.employee_code = ad.employee_id
            WHERE {where_clause}
            ORDER BY ad.status = 'PENDING_REVIEW' DESC, ad.id DESC
        """
        cur.execute(query, params)
        rows = cur.fetchall()

        # For each row, get the exact late dates in that month
        for r in rows:
            emp_id = r["employee_id"]
            y = r["year"]
            m = r["month"]
            cur.execute(
                """
                SELECT date, check_in, late_minutes
                FROM attendance
                WHERE employee_id = %s AND YEAR(date) = %s AND MONTH(date) = %s
                  AND beyond_grace = 1
                ORDER BY date ASC
                """,
                (emp_id, y, m),
            )
            late_records = cur.fetchall()
            r["late_dates"] = [
                {
                    "date": str(lr.get("date") or ""),
                    "check_in": str(lr.get("check_in") or ""),
                    "late_minutes": int(lr.get("late_minutes") or 0),
                }
                for lr in late_records
            ]
            r["amount"] = float(r["amount"] or 0.0)
            if r["reviewed_at"]:
                r["reviewed_at"] = r["reviewed_at"].strftime("%Y-%m-%d %H:%M:%S")
            if r["created_at"]:
                r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M:%S")

        cur.close()
        conn.close()

        pending_count = sum(1 for r in rows if r.get("status") == "PENDING_REVIEW")
        return {
            "success": True,
            "deductions": rows,
            "total": len(rows),
            "pending_count": pending_count,
            "year": target_year,
            "month": target_month,
        }
    except Exception as exc:
        log.error("get_late_deductions failed: %s", exc)
        return {"success": False, "message": str(exc), "deductions": [], "total": 0, "pending_count": 0}


@router.post("/api/hr/late-deductions/{deduction_id}/action")
@router.post("/api/hr/salary-deductions/{deduction_id}/action")
def act_on_late_deduction(deduction_id: int, payload: LateDeductionActionRequest, request: Request):
    """
    HR action on salary deduction (late arrival or unpaid leave):
    - APPLY: sets status to 'APPLIED' so deduction is subtracted in payroll.
    - IGNORE: sets status to 'IGNORED' and amount to 0 (no deduction).
    """
    action = (payload.action or "").strip().upper()
    if action not in ("APPLY", "IGNORE"):
        raise HTTPException(status_code=400, detail="Action must be 'APPLY' or 'IGNORE'")

    client_ip = request.client.host if request.client else "127.0.0.1"

    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            """
            SELECT ad.*, 
                   COALESCE(u.full_name, e.full_name, ad.employee_id) AS employee_name
            FROM attendance_deductions ad
            LEFT JOIN users u ON u.user_id = ad.employee_id
            LEFT JOIN employees e ON e.employee_code = ad.employee_id
            WHERE ad.id = %s
            """,
            (deduction_id,),
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Deduction record not found")

        emp_id = row["employee_id"]
        emp_name = row["employee_name"]
        year = row["year"]
        month = row["month"]
        late_count = row["late_count"]
        amount = float(row["amount"] or 0.0)
        ded_type = row.get("deduction_type") or "LATE_ARRIVAL"

        actor_id = payload.actor_id or "hr"
        actor_name = payload.actor_name or "HR Manager"
        notes = (payload.notes or "").strip()

        if action == "APPLY":
            new_status = "APPLIED"
            half_days = 1 if ded_type == "LATE_ARRIVAL" else int(row.get("half_days_deducted") or 0)
            cur.execute(
                """
                UPDATE attendance_deductions
                SET status = 'APPLIED',
                    half_days_deducted = %s,
                    reviewed_by = %s,
                    reviewed_at = NOW(),
                    review_notes = %s
                WHERE id = %s
                """,
                (half_days, actor_name, notes, deduction_id),
            )
            if ded_type == "LATE_ARRIVAL":
                cur.execute(
                    """
                    UPDATE monthly_late_summary
                    SET deduction_triggered = 1
                    WHERE employee_id = %s AND year = %s AND month = %s
                    """,
                    (emp_id, year, month),
                )
                act_type = "LATE_DEDUCTION_APPLIED"
                act_desc = f"Applied half-day salary deduction of ₹{amount:.2f} for {late_count} late arrivals in {month:02d}/{year}. Notes: {notes or 'Standard deduction policy'}"
                notif_title = "Late-Arrival Salary Deduction Applied"
                notif_msg = f"A half-day salary deduction of ₹{amount:.2f} has been applied by HR for {late_count} late arrivals in {month:02d}/{year}."
            else:
                act_type = "LEAVE_DEDUCTION_APPLIED"
                act_desc = f"Approved unpaid leave salary deduction of ₹{amount:.2f} in {month:02d}/{year}. Notes: {notes or 'Approved by HR'}"
                notif_title = "Leave Salary Deduction Approved"
                notif_msg = f"A salary deduction of ₹{amount:.2f} for unpaid leave in {month:02d}/{year} has been approved by HR."

            # Log in HR activity logs
            log_hr_activity(
                performed_by=actor_id,
                performed_name=actor_name,
                action=act_type,
                target_employee_id=emp_id,
                target_employee_name=emp_name,
                details=act_desc,
                ip_address=client_ip,
            )
            # Notify employee
            cur.execute(
                """
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'PAYROLL', 0, NOW())
                """,
                (emp_id, notif_title, notif_msg),
            )
            msg = f"Salary deduction of ₹{amount:.2f} applied for {emp_name}."

        else:  # IGNORE
            new_status = "IGNORED"
            cur.execute(
                """
                UPDATE attendance_deductions
                SET status = 'IGNORED',
                    half_days_deducted = 0,
                    amount = 0.00,
                    reviewed_by = %s,
                    reviewed_at = NOW(),
                    review_notes = %s
                WHERE id = %s
                """,
                (actor_name, notes, deduction_id),
            )
            if ded_type == "LATE_ARRIVAL":
                cur.execute(
                    """
                    UPDATE monthly_late_summary
                    SET deduction_triggered = 0
                    WHERE employee_id = %s AND year = %s AND month = %s
                    """,
                    (emp_id, year, month),
                )
                act_type = "LATE_DEDUCTION_IGNORED"
                act_desc = f"Ignored/waived late-arrival deduction for {late_count} late arrivals in {month:02d}/{year}. Notes: {notes or 'Waived by HR'}"
                notif_title = "Late-Arrival Deduction Waived"
                notif_msg = f"HR has reviewed your late arrivals for {month:02d}/{year} and waived the salary deduction."
            else:
                act_type = "LEAVE_DEDUCTION_IGNORED"
                act_desc = f"Waived/ignored unpaid leave salary deduction of ₹{amount:.2f} in {month:02d}/{year}. Notes: {notes or 'Waived by HR'}"
                notif_title = "Leave Salary Deduction Waived"
                notif_msg = f"HR has reviewed and waived the salary deduction for your unpaid leave in {month:02d}/{year}."

            # Log in HR activity logs
            log_hr_activity(
                performed_by=actor_id,
                performed_name=actor_name,
                action=act_type,
                target_employee_id=emp_id,
                target_employee_name=emp_name,
                details=act_desc,
                ip_address=client_ip,
            )
            # Notify employee
            cur.execute(
                """
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'ATTENDANCE', 0, NOW())
                """,
                (emp_id, notif_title, notif_msg),
            )
            msg = f"Salary deduction waived/ignored for {emp_name}."

        conn.commit()
        cur.close()
        conn.close()

        return {"success": True, "status": new_status, "message": msg}
    except HTTPException:
        raise
    except Exception as exc:
        log.error("act_on_late_deduction error: %s", exc)
        return {"success": False, "message": str(exc)}


@router.get("/api/hr/activity-logs")
def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
):
    """Fetch paginated HR activity logs."""
    return get_hr_activity_logs(
        page=page,
        limit=limit,
        action=action,
        search=search,
        start_date=start_date,
        end_date=end_date,
        role=role,
    )
