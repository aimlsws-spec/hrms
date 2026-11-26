"""
Employee self-service API — /api/employee/* endpoints
"""

from fastapi import APIRouter, Request
from datetime import datetime
import os
import uuid
import re
import mysql.connector

from backend.config import DB_CONFIG

router = APIRouter()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _safe_float(val) -> float:
    
    if val is None:
        return 0.0
    try:
        return float(str(val).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


def _ensure_expense_date_column():
    """Add expense_date column to reimbursements if it does not yet exist."""
    try:
        conn = _db()
        cur = conn.cursor()
        try:
            cur.execute("ALTER TABLE reimbursements ADD COLUMN expense_date DATE NULL")
            conn.commit()
        except Exception:
            pass  # column already exists — ignore
        cur.close()
        conn.close()
    except Exception:
        pass


_ensure_expense_date_column()


# ── GET /api/employee/expenses ─────────────────────────────────────────────

@router.get("/api/employee/expenses")
def get_employee_expenses(employee_id: str = ""):
    """Return only the expense requests that belong to this employee."""
    if not employee_id:
        return []
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                id,
                amount,
                COALESCE(description, category, 'Expense')          AS reason,
                COALESCE(payment_method, 'UPI')                    AS payment_method,
                COALESCE(receipt_path, '')                         AS receipt_path,
                COALESCE(expense_date, DATE(submitted_at))           AS expense_date,
                status,
                DATE_FORMAT(submitted_at, '%d %b %Y')              AS submitted_on,
                COALESCE(reviewed_by, '')                          AS reviewed_by,
                DATE_FORMAT(reviewed_at, '%d %b %Y')               AS reviewed_at,
                COALESCE(comments, '')                             AS comments
            FROM reimbursements
            WHERE employee_id = %s
            ORDER BY submitted_at DESC
        """, (employee_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            raw = (r['status'] or 'pending').lower()
            display = 'Approved' if raw == 'approved' else ('Rejected' if raw == 'rejected' else 'Pending')

            exp_dt = r['expense_date']
            if hasattr(exp_dt, 'strftime'):
                exp_dt = exp_dt.strftime('%d %b %Y')
            else:
                exp_dt = str(exp_dt) if exp_dt else ''

            result.append({
                "id":             r["id"],
                "amount":         _safe_float(r["amount"]),
                "reason":         r["reason"] or "Expense",
                "payment_method": r.get("payment_method") or "UPI",
                "receipt_path":   r.get("receipt_path") or "",
                "expense_date":   exp_dt,
                "submitted_on":   r["submitted_on"] or "",
                "status":         display,
                "reviewed_by":    r.get("reviewed_by") or "",
                "reviewed_at":    r.get("reviewed_at") or "",
                "comments":       r.get("comments") or "",
            })
        return result
    except Exception:
        return []


# ── POST /api/employee/expenses ────────────────────────────────────────────

@router.post("/api/employee/expenses")
async def submit_employee_expense(request: Request):
    """Create a new expense / reimbursement request supporting UPI/Cash and receipt/screenshot uploads."""
    try:
        content_type = request.headers.get("content-type", "")
        file_obj = None

        if "multipart/form-data" in content_type:
            form = await request.form()
            employee_id  = str(form.get("employee_id") or "").strip()
            amount_raw   = form.get("amount")
            reason       = str(form.get("reason") or "").strip()
            expense_date = str(form.get("expense_date") or "").strip()
            payment_method = str(form.get("payment_method") or "UPI").strip()
            file_obj     = form.get("receipt") or form.get("file")
        else:
            data = await request.json()
            employee_id  = str(data.get("employee_id") or "").strip()
            amount_raw   = data.get("amount")
            reason       = str(data.get("reason") or "").strip()
            expense_date = str(data.get("expense_date") or "").strip()
            payment_method = str(data.get("payment_method") or "UPI").strip()

        if not employee_id:
            return {"success": False, "message": "employee_id is required"}

        try:
            amount = float(amount_raw or 0)
        except (ValueError, TypeError):
            return {"success": False, "message": "Invalid amount"}

        if amount <= 0:
            return {"success": False, "message": "Amount must be greater than zero"}
        if not reason:
            return {"success": False, "message": "Reason is required"}

        # Validate / normalise expense_date
        if expense_date:
            try:
                datetime.strptime(expense_date, '%Y-%m-%d')
            except ValueError:
                expense_date = datetime.now().strftime('%Y-%m-%d')
        else:
            expense_date = datetime.now().strftime('%Y-%m-%d')

        # Handle receipt file upload if provided
        receipt_path = ""
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            ext = os.path.splitext(file_obj.filename)[1].lower()
            if ext in ('.png', '.jpg', '.jpeg', '.pdf', '.webp'):
                upload_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                    "uploads",
                    "reimbursements"
                )
                os.makedirs(upload_dir, exist_ok=True)
                clean_name = f"{uuid.uuid4().hex[:12]}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', file_obj.filename)}"
                save_dest = os.path.join(upload_dir, clean_name)
                contents = await file_obj.read()
                with open(save_dest, "wb") as f:
                    f.write(contents)
                receipt_path = f"/uploads/reimbursements/{clean_name}"

        conn = _db()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO reimbursements
                (employee_id, category, amount, description, payment_method, receipt_path, expense_date, status)
            VALUES (%s, 'General', %s, %s, %s, %s, %s, 'pending')
        """, (employee_id, amount, reason, payment_method, receipt_path, expense_date))
        conn.commit()
        new_id = cur.lastrowid

        # Notify HR users
        try:
            cur.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin', 'sub_hr') AND COALESCE(is_active, 1) = 1")
            hr_users = [r[0] for r in cur.fetchall()]
            for uid in hr_users:
                cur.execute("""
                    INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                    VALUES (%s, %s, %s, 'REIMBURSEMENT_SUBMITTED', 0, NOW())
                """, (
                    uid,
                    f"New Reimbursement: ₹{amount:.2f}",
                    f"Employee {employee_id} submitted reimbursement #{new_id} for ₹{amount:.2f} via {payment_method}: '{reason}'."
                ))
            conn.commit()
        except Exception:
            pass

        cur.close()
        conn.close()

        return {"success": True, "id": new_id, "receipt_path": receipt_path}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── GET /api/employee/salary ───────────────────────────────────────────────

@router.get("/api/employee/salary")
def get_employee_salary(employee_id: str = ""):
    """Return the latest active salary breakdown for the given employee."""
    if not employee_id:
        return None
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT es.*
            FROM employee_salaries es
            JOIN (
                SELECT employee_id, MAX(id) AS max_id
                FROM employee_salaries
                WHERE status = 'active'
                GROUP BY employee_id
            ) _lat ON es.id = _lat.max_id
            WHERE es.employee_id = %s
        """, (employee_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return None

        def sf(v):
            return float(v) if v is not None else 0.0

        eff = row.get("effective_from")
        return {
            "employee_id":        row["employee_id"],
            "ctc":                sf(row["ctc"]),
            "basic_salary":       sf(row["basic_salary"]),
            "hra":                sf(row.get("hra") or 0),
            "da":                 sf(row.get("da") or 0),
            "transport":          sf(row.get("transport_allowance") or 0),
            "medical":            sf(row.get("medical_allowance") or 0),
            "special":            sf(row.get("special_allowance") or 0),
            "gross_salary":       sf(row["gross_salary"]),
            "pf_deduction":       sf(row.get("pf_deduction") or 0),
            "esi_deduction":      sf(row.get("esi_deduction") or 0),
            "professional_tax":   sf(row.get("professional_tax") or 0),
            "income_tax":         sf(row.get("income_tax") or 0),
            "total_deductions":   sf(row["total_deductions"]),
            "net_salary":         sf(row["net_salary"]),
            "effective_from":     eff.strftime("%Y-%m-%d") if hasattr(eff, "strftime") else (str(eff) if eff else ""),
        }
    except Exception:
        return None
