"""
HR Reimbursements and Joining Documents Management Router.
Provides endpoints for:
- HR review & approval/rejection of employee reimbursement claims
- HR upload, listing, and deletion of employee joining documents (PDF, JPG, PNG)
"""

import os
import uuid
import re
import logging
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Request, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, FileResponse
import mysql.connector

from backend.config import DB_CONFIG
from backend.core.hr_activity_logger import log_hr_activity

logger = logging.getLogger(__name__)

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
JOINING_DOCS_DIR = os.path.join(UPLOADS_DIR, "joining_documents")
REIMBURSEMENTS_DIR = os.path.join(UPLOADS_DIR, "reimbursements")

os.makedirs(JOINING_DOCS_DIR, exist_ok=True)
os.makedirs(REIMBURSEMENTS_DIR, exist_ok=True)


def _get_db():
    return mysql.connector.connect(**DB_CONFIG)


# ==============================================================================
# HR REIMBURSEMENT MANAGEMENT
# ==============================================================================

@router.get("/api/hr/reimbursements")
def get_hr_reimbursements(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """
    Fetch reimbursement requests for HR review with employee metadata,
    receipt screenshot paths, payment methods, and current status.
    """
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        conditions = ["1=1"]
        params = []

        if status and status.strip() and status.strip().upper() != "ALL":
            conditions.append("LOWER(r.status) = %s")
            params.append(status.strip().lower())

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append("(r.employee_id LIKE %s OR e.name LIKE %s OR r.description LIKE %s)")
            params.extend([term, term, term])

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT
                r.id,
                r.employee_id,
                COALESCE(e.name, r.employee_id) AS employee_name,
                COALESCE(e.department, '—') AS department,
                COALESCE(e.title, '—') AS title,
                r.amount,
                COALESCE(r.description, r.category, 'Expense') AS reason,
                COALESCE(r.payment_method, 'UPI') AS payment_method,
                COALESCE(r.receipt_path, '') AS receipt_path,
                COALESCE(r.expense_date, DATE(r.submitted_at)) AS expense_date,
                r.status,
                DATE_FORMAT(r.submitted_at, '%d %b %Y %H:%i') AS submitted_at,
                COALESCE(r.reviewed_by, '') AS reviewed_by,
                DATE_FORMAT(r.reviewed_at, '%d %b %Y %H:%i') AS reviewed_at,
                COALESCE(r.comments, '') AS comments
            FROM reimbursements r
            LEFT JOIN employees e ON (r.employee_id = e.employee_code OR r.employee_id = e.employee_id)
            WHERE {where_clause}
            ORDER BY r.submitted_at DESC, r.id DESC
        """

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        # Compute summary counts
        cur.execute("""
            SELECT
                COUNT(*) AS total_count,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN amount ELSE 0 END) AS pending_amount,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN amount ELSE 0 END) AS approved_amount
            FROM reimbursements
        """)
        stats_row = cur.fetchone() or {}

        reimbursements = []
        for r in rows:
            raw_status = (r['status'] or 'pending').lower()
            if raw_status == 'approved':
                display_status = 'Approved'
            elif raw_status == 'rejected':
                display_status = 'Rejected'
            else:
                display_status = 'Pending'

            exp_dt = r['expense_date']
            if hasattr(exp_dt, 'strftime'):
                exp_dt_str = exp_dt.strftime('%d %b %Y')
            else:
                exp_dt_str = str(exp_dt) if exp_dt else ''

            reimbursements.append({
                "id": r["id"],
                "employee_id": r["employee_id"],
                "employee_name": r["employee_name"],
                "department": r["department"],
                "title": r["title"],
                "amount": float(r["amount"] or 0),
                "reason": r["reason"],
                "payment_method": r["payment_method"],
                "receipt_path": r["receipt_path"],
                "expense_date": exp_dt_str,
                "status": display_status,
                "submitted_at": r["submitted_at"] or "",
                "reviewed_by": r["reviewed_by"] or "",
                "reviewed_at": r["reviewed_at"] or "",
                "comments": r["comments"] or "",
            })

        cur.close()
        conn.close()

        return {
            "success": True,
            "reimbursements": reimbursements,
            "stats": {
                "total": int(stats_row.get("total_count") or 0),
                "pending": int(stats_row.get("pending_count") or 0),
                "approved": int(stats_row.get("approved_count") or 0),
                "rejected": int(stats_row.get("rejected_count") or 0),
                "pending_amount": float(stats_row.get("pending_amount") or 0),
                "approved_amount": float(stats_row.get("approved_amount") or 0),
            }
        }
    except Exception as exc:
        logger.exception("get_hr_reimbursements failed")
        return {"success": False, "message": str(exc), "reimbursements": [], "stats": {}}


@router.post("/api/hr/reimbursements/{reimbursement_id}/review")
async def review_hr_reimbursement(reimbursement_id: int, request: Request):
    """
    HR reviews and directly approves or rejects reimbursement request.
    HR approval is the approval of the reimbursement payment (no secondary finance step).
    Immediately updates status, notes, notifies employee, and logs HR activity.
    """
    try:
        data = await request.json()
        action = str(data.get("action") or "").strip().upper()
        comments = str(data.get("comments") or "").strip()
        reviewed_by = str(data.get("reviewed_by") or "HR Admin").strip()
        actor_role = str(data.get("actor_role") or "hr").strip()

        if action not in ("APPROVED", "REJECTED"):
            return {"success": False, "message": "Action must be APPROVED or REJECTED"}

        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT id, employee_id, amount, description, payment_method, status
            FROM reimbursements
            WHERE id = %s
        """, (reimbursement_id,))
        item = cur.fetchone()

        if not item:
            cur.close()
            conn.close()
            return {"success": False, "message": f"Reimbursement request #{reimbursement_id} not found."}

        new_status = 'approved' if action == 'APPROVED' else 'rejected'
        emp_id = item['employee_id']
        amount = float(item['amount'] or 0)
        reason = item['description'] or 'Expense'
        method = item.get('payment_method') or 'UPI'

        cur.execute("""
            UPDATE reimbursements
            SET status = %s,
                reviewed_by = %s,
                reviewed_at = NOW(),
                comments = %s
            WHERE id = %s
        """, (new_status, reviewed_by, comments, reimbursement_id))
        conn.commit()

        # Send notification to employee
        try:
            status_word = "approved" if action == "APPROVED" else "rejected"
            notif_title = f"Reimbursement {status_word.title()}: ₹{amount:.2f}"
            notif_msg = (
                f"Your reimbursement request #{reimbursement_id} of ₹{amount:.2f} via {method} "
                f"has been {status_word} by {reviewed_by}."
            )
            if comments:
                notif_msg += f" Note: {comments}"

            cur.execute("""
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'REIMBURSEMENT_REVIEW', 0, NOW())
            """, (emp_id, notif_title, notif_msg))
            conn.commit()
        except Exception as n_err:
            logger.warning("Could not send employee notification: %s", n_err)

        cur.close()
        conn.close()

        # Log HR Activity
        act_name = "REIMBURSEMENT_APPROVED" if action == "APPROVED" else "REIMBURSEMENT_REJECTED"
        log_hr_activity(
            performed_by=reviewed_by,
            performed_name=reviewed_by,
            action=act_name,
            details=f"{action.title()} reimbursement #{reimbursement_id} for ₹{amount:.2f} ({method}) for {emp_id}. Notes: {comments or 'None'}",
            target_employee_id=emp_id,
            role=actor_role
        )

        return {
            "success": True,
            "message": f"Reimbursement has been {new_status} successfully.",
            "status": new_status.title(),
            "reviewed_by": reviewed_by
        }
    except Exception as exc:
        logger.exception("review_hr_reimbursement failed")
        return {"success": False, "message": str(exc)}


# ==============================================================================
# EMPLOYEE JOINING-DOCUMENT STORAGE
# ==============================================================================

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

@router.get("/api/employees/{employee_id}/joining-documents")
def get_employee_joining_documents(employee_id: str):
    """Retrieve all uploaded joining documents for an employee."""
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                id,
                employee_id,
                document_type,
                document_name,
                file_path,
                file_type,
                file_size,
                COALESCE(uploaded_by, 'HR') AS uploaded_by,
                DATE_FORMAT(uploaded_at, '%d %b %Y %H:%i') AS uploaded_at
            FROM employee_joining_documents
            WHERE employee_id = %s
            ORDER BY id DESC
        """, (employee_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        docs = []
        for r in rows:
            docs.append({
                "id": r["id"],
                "employee_id": r["employee_id"],
                "document_type": r["document_type"],
                "document_name": r["document_name"],
                "file_path": r["file_path"],
                "file_type": r["file_type"] or "application/pdf",
                "file_size": r["file_size"] or 0,
                "uploaded_by": r["uploaded_by"],
                "uploaded_at": r["uploaded_at"] or "",
            })

        return {"success": True, "documents": docs}
    except Exception as exc:
        logger.exception("get_employee_joining_documents failed")
        return {"success": False, "message": str(exc), "documents": []}


@router.post("/api/employees/{employee_id}/joining-documents")
async def upload_employee_joining_document(
    employee_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("General Joining Document"),
    document_name: Optional[str] = Form(None),
    uploaded_by: Optional[str] = Form("HR Admin"),
    actor_role: Optional[str] = Form("hr")
):
    """
    Upload and attach a joining document (PDF, PNG, JPG) to an employee record.
    Saves file in uploads/joining_documents/{employee_id}/ and creates metadata record.
    """
    try:
        if not file or not file.filename:
            return {"success": False, "message": "No file uploaded."}

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
            return {
                "success": False,
                "message": f"Unsupported file type '{ext}'. Allowed formats: PDF, PNG, JPG, JPEG."
            }

        # Create target employee directory
        emp_dir = os.path.join(JOINING_DOCS_DIR, str(employee_id).strip())
        os.makedirs(emp_dir, exist_ok=True)

        clean_original = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
        safe_name = f"{uuid.uuid4().hex[:10]}_{clean_original}"
        save_path = os.path.join(emp_dir, safe_name)

        contents = await file.read()
        file_size = len(contents)
        with open(save_path, "wb") as f:
            f.write(contents)

        relative_path = f"/uploads/joining_documents/{employee_id}/{safe_name}"
        doc_title = document_name.strip() if document_name and document_name.strip() else clean_original
        content_type = file.content_type or ("application/pdf" if ext == ".pdf" else "image/jpeg")

        conn = _get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO employee_joining_documents
                (employee_id, document_type, document_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (
            employee_id,
            document_type.strip(),
            doc_title,
            relative_path,
            content_type,
            file_size,
            uploaded_by.strip()
        ))
        conn.commit()
        new_doc_id = cur.lastrowid
        cur.close()
        conn.close()

        # Log HR Activity
        log_hr_activity(
            performed_by=uploaded_by,
            performed_name=uploaded_by,
            action="JOINING_DOCUMENT_UPLOADED",
            details=f"Uploaded {document_type} ('{doc_title}') for employee {employee_id}.",
            target_employee_id=employee_id,
            role=actor_role
        )

        return {
            "success": True,
            "message": "Joining document uploaded successfully.",
            "document": {
                "id": new_doc_id,
                "employee_id": employee_id,
                "document_type": document_type,
                "document_name": doc_title,
                "file_path": relative_path,
                "file_type": content_type,
                "file_size": file_size,
                "uploaded_by": uploaded_by,
                "uploaded_at": datetime.now().strftime('%d %b %Y %H:%M')
            }
        }
    except Exception as exc:
        logger.exception("upload_employee_joining_document failed")
        return {"success": False, "message": str(exc)}


@router.delete("/api/employees/{employee_id}/joining-documents/{document_id}")
def delete_employee_joining_document(
    employee_id: str,
    document_id: int,
    deleted_by: Optional[str] = "HR Admin",
    actor_role: Optional[str] = "hr"
):
    """Delete a joining document from an employee record and remove file from disk."""
    try:
        conn = _get_db()
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT id, employee_id, document_type, document_name, file_path
            FROM employee_joining_documents
            WHERE id = %s AND employee_id = %s
        """, (document_id, employee_id))
        doc = cur.fetchone()

        if not doc:
            cur.close()
            conn.close()
            return {"success": False, "message": "Document not found."}

        # Remove physical file if present
        rel_path = doc.get("file_path") or ""
        if rel_path.startswith("/uploads/"):
            phys_path = os.path.join(BASE_DIR, rel_path.lstrip("/\\").replace("/", os.sep))
            if os.path.exists(phys_path):
                try:
                    os.remove(phys_path)
                except Exception as del_err:
                    logger.warning("Could not remove physical file %s: %s", phys_path, del_err)

        cur.execute("DELETE FROM employee_joining_documents WHERE id = %s", (document_id,))
        conn.commit()
        cur.close()
        conn.close()

        # Log HR Activity
        log_hr_activity(
            performed_by=deleted_by,
            performed_name=deleted_by,
            action="JOINING_DOCUMENT_DELETED",
            details=f"Deleted {doc.get('document_type')} ('{doc.get('document_name')}') for employee {employee_id}.",
            target_employee_id=employee_id,
            role=actor_role
        )

        return {"success": True, "message": "Document deleted successfully."}
    except Exception as exc:
        logger.exception("delete_employee_joining_document failed")
        return {"success": False, "message": str(exc)}
