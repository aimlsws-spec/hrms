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
def get_late_deductions(
    status: Optional[str] = Query(None, description="PENDING_REVIEW, APPLIED, IGNORED, or all"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
):
    """Retrieve late-arrival deduction reviews for HR decision."""
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        now = datetime.now()
        target_year = year or now.year
        target_month = month or now.month

        conditions = ["ad.deduction_type = 'LATE_ARRIVAL'"]
        params: List[Any] = []

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
def act_on_late_deduction(deduction_id: int, payload: LateDeductionActionRequest, request: Request):
    """
    HR action on late deduction:
    - APPLY: sets status to 'APPLIED' so half-day salary is deducted in payroll.
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

        actor_id = payload.actor_id or "hr"
        actor_name = payload.actor_name or "HR Manager"
        notes = (payload.notes or "").strip()

        if action == "APPLY":
            new_status = "APPLIED"
            cur.execute(
                """
                UPDATE attendance_deductions
                SET status = 'APPLIED',
                    half_days_deducted = 1,
                    reviewed_by = %s,
                    reviewed_at = NOW(),
                    review_notes = %s
                WHERE id = %s
                """,
                (actor_name, notes, deduction_id),
            )
            # Update monthly late summary
            cur.execute(
                """
                UPDATE monthly_late_summary
                SET deduction_triggered = 1
                WHERE employee_id = %s AND year = %s AND month = %s
                """,
                (emp_id, year, month),
            )
            # Log in HR activity logs
            log_hr_activity(
                performed_by=actor_id,
                performed_name=actor_name,
                action="LATE_DEDUCTION_APPLIED",
                target_employee_id=emp_id,
                target_employee_name=emp_name,
                details=f"Applied half-day salary deduction of ₹{amount:.2f} for {late_count} late arrivals in {month:02d}/{year}. Notes: {notes or 'Standard deduction policy'}",
                ip_address=client_ip,
            )
            # Notify employee
            cur.execute(
                """
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'PAYROLL', 0, NOW())
                """,
                (
                    emp_id,
                    "Late-Arrival Salary Deduction Applied",
                    f"A half-day salary deduction of ₹{amount:.2f} has been applied by HR for {late_count} late arrivals in {month:02d}/{year}.",
                ),
            )
            msg = f"Half-day deduction of ₹{amount:.2f} applied for {emp_name}."

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
            # Update monthly late summary
            cur.execute(
                """
                UPDATE monthly_late_summary
                SET deduction_triggered = 0
                WHERE employee_id = %s AND year = %s AND month = %s
                """,
                (emp_id, year, month),
            )
            # Log in HR activity logs
            log_hr_activity(
                performed_by=actor_id,
                performed_name=actor_name,
                action="LATE_DEDUCTION_IGNORED",
                target_employee_id=emp_id,
                target_employee_name=emp_name,
                details=f"Ignored/waived late-arrival deduction for {late_count} late arrivals in {month:02d}/{year}. Notes: {notes or 'Waived by HR'}",
                ip_address=client_ip,
            )
            # Notify employee
            cur.execute(
                """
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'ATTENDANCE', 0, NOW())
                """,
                (
                    emp_id,
                    "Late-Arrival Deduction Waived",
                    f"HR has reviewed your late arrivals for {month:02d}/{year} and waived the salary deduction.",
                ),
            )
            msg = f"Late-arrival deduction waived/ignored for {emp_name}."

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
):
    """Fetch paginated HR activity logs."""
    return get_hr_activity_logs(
        page=page,
        limit=limit,
        action=action,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )
