"""
Document Request API - Employee document request workflow
Supports:
  - Employee: submit, view status
  - HR: review, approve, reject, forward to accountant
  - Accountant: generate salary slips
"""

from datetime import datetime
from typing import List, Dict, Any, Optional

import mysql.connector
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

from backend.config import DB_CONFIG

router = APIRouter()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _ensure_document_requests_table():
    """Ensure document_requests table exists."""
    conn = _db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS document_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            employee_name VARCHAR(100) DEFAULT NULL,
            document_type VARCHAR(50) NOT NULL,
            reason TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            file_url VARCHAR(500) DEFAULT NULL,
            file_html LONGTEXT,
            rejected_reason TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            requested_month VARCHAR(7) DEFAULT NULL,
            hr_approved_by VARCHAR(100) DEFAULT NULL,
            hr_forwarded_at DATETIME DEFAULT NULL
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


class DocumentRequestPayload(BaseModel):
    employee_id: str
    document_type: str
    reason: Optional[str] = None
    requested_month: Optional[str] = None


class DocumentRequestActionResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    request: Optional[dict] = None


# ---------------------------------------------------------------------------
# POST /api/documents/requests
# Employee submits a document request (DISABLED: documents issued directly by HR)
# ---------------------------------------------------------------------------
@router.post("/api/documents/requests")
def create_document_request(payload: DocumentRequestPayload):
    raise HTTPException(
        status_code=403,
        detail="Employee document requests are disabled. Official documents are generated and issued directly by HR."
    )


# ---------------------------------------------------------------------------
# GET /api/documents/requests/my
# Employee views their own requests
# ---------------------------------------------------------------------------
@router.get("/api/documents/requests/my")
def get_my_requests(employee_id: str = ""):
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id is required")

    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("""
            SELECT * FROM document_requests
            WHERE employee_id = %s
            ORDER BY created_at DESC
        """, (employee_id,))
        rows = cur.fetchall()

        # Convert datetime objects to ISO strings for JSON serialization
        for row in rows:
            for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
                if row.get(key) and hasattr(row[key], 'isoformat'):
                    row[key] = row[key].isoformat()

        return {
            "success": True,
            "requests": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load requests: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# GET /api/documents/requests/all
# HR views all pending requests
# ---------------------------------------------------------------------------
@router.get("/api/documents/requests/all")
def get_all_requests():
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("""
            SELECT * FROM document_requests
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()

        for row in rows:
            for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
                if row.get(key) and hasattr(row[key], 'isoformat'):
                    row[key] = row[key].isoformat()

        return {
            "success": True,
            "requests": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load requests: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/documents/requests/{id}/approve
# HR approves a request
# ---------------------------------------------------------------------------
@router.post("/api/documents/requests/{request_id}/approve")
def approve_request(request_id: int, approved_by: str = Header(default="")):
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            "SELECT * FROM document_requests WHERE id = %s",
            (request_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        # Determine new status based on document type
        new_status = 'hr_approved' if row['document_type'] == 'salary-slip' else 'approved'

        cur.execute("""
            UPDATE document_requests
            SET status = %s, hr_approved_by = %s
            WHERE id = %s
        """, (new_status, approved_by, request_id))
        conn.commit()

        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()

        for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
            if row.get(key) and hasattr(row[key], 'isoformat'):
                row[key] = row[key].isoformat()

        return {
            "success": True,
            "message": "Request approved",
            "request": row
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/documents/requests/{id}/reject
# HR rejects a request
# ---------------------------------------------------------------------------
@router.post("/api/documents/requests/{request_id}/reject")
def reject_request(request_id: int, reason: Optional[dict] = None):
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        reject_reason = reason.get("reason", "") if reason else ""

        cur.execute("""
            UPDATE document_requests
            SET status = 'rejected', rejected_reason = %s
            WHERE id = %s
        """, (reject_reason, request_id))
        conn.commit()

        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()

        for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
            if row.get(key) and hasattr(row[key], 'isoformat'):
                row[key] = row[key].isoformat()

        return {
            "success": True,
            "message": "Request rejected",
            "request": row
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/documents/requests/{id}/forward-to-accountant
# HR forwards approved salary slip request to accountant
# ---------------------------------------------------------------------------
@router.post("/api/documents/requests/{request_id}/forward-to-accountant")
def forward_to_accountant(request_id: int, payload: Optional[dict] = None):
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        if row['document_type'] != 'salary-slip':
            raise HTTPException(status_code=400, detail="Only salary-slip requests can be forwarded")

        if row['status'] not in ('pending', 'hr_approved'):
            raise HTTPException(status_code=400, detail="Request must be pending to approve/forward")

        cur.execute("""
            UPDATE document_requests
            SET status = 'hr_approved', hr_forwarded_at = NOW()
            WHERE id = %s
        """, (request_id,))
        conn.commit()

        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()

        for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
            if row.get(key) and hasattr(row[key], 'isoformat'):
                row[key] = row[key].isoformat()

        return {
            "success": True,
            "message": "Forwarded to accountant",
            "request": row
        }
    except HTTPException:
        conn.rollback()
        raise
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to forward: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# GET /api/documents/requests/accountant
# Accountant views hr_approved salary slip requests
# ---------------------------------------------------------------------------
@router.get("/api/documents/requests/accountant")
def get_accountant_requests():
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("""
            SELECT * FROM document_requests
            WHERE document_type = 'salary-slip'
              AND status IN ('hr_approved', 'generated')
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()

        for row in rows:
            for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
                if row.get(key) and hasattr(row[key], 'isoformat'):
                    row[key] = row[key].isoformat()

        return {
            "success": True,
            "requests": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load requests: {e}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# POST /api/documents/requests/{id}/generate
# HR generates a document for a request (non-salary-slip)
# ---------------------------------------------------------------------------
@router.post("/api/documents/requests/{request_id}/generate")
def generate_document_for_request(request_id: int, payload: Optional[dict] = None):
    _ensure_document_requests_table()
    conn = _db()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Request not found")

        # Only generate for approved requests (not salary slips - those go to accountant)
        if row['status'] != 'approved':
            raise HTTPException(status_code=400, detail="Request must be approved before generation")

        if row['document_type'] == 'salary-slip':
            raise HTTPException(status_code=400, detail="Salary slips must be generated by accountant")

        update_fields = ["status = 'generated'"]
        params = []
        if payload:
            if 'file_url' in payload:
                update_fields.append("file_url = %s")
                params.append(payload['file_url'])
            if 'file_html' in payload:
                update_fields.append("file_html = %s")
                params.append(payload['file_html'])

        params.append(request_id)

        # Update status (and url/html if provided)
        cur.execute(f"""
            UPDATE document_requests
            SET {', '.join(update_fields)}
            WHERE id = %s
        """, tuple(params))
        conn.commit()

        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        row = cur.fetchone()

        for key in ['created_at', 'updated_at', 'hr_forwarded_at']:
            if row.get(key) and hasattr(row[key], 'isoformat'):
                row[key] = row[key].isoformat()

        return {
            "success": True,
            "message": "Document marked as generated",
            "request": row
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate: {e}")
    finally:
        cur.close()
        conn.close()





# ---------------------------------------------------------------------------
# GET /api/documents/employee-prefill/{employee_id}
# Get employee details for pre-filling document forms
# ---------------------------------------------------------------------------
@router.get("/api/documents/employee-prefill/{employee_id}")
def get_employee_prefill(employee_id: str):
    """Return pre-fill data for Offer Letter / Experience Letter forms —
    employee identity, address (profile first, city/state fallback), and
    current annual salary (CTC, else gross*12)."""
    try:
        conn = _db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT employee_code,
                   full_name,
                   COALESCE(email, '')       AS email,
                   COALESCE(title, '')       AS title,
                   COALESCE(department, '')  AS department,
                   COALESCE(phone, '')       AS phone,
                   COALESCE(joining_date, date_of_joining) AS joining_date,
                   COALESCE(city, '')        AS city,
                   COALESCE(state, '')       AS state
            FROM employees
            WHERE employee_code = %s OR id = %s
            LIMIT 1
        """, (employee_id, employee_id))
        emp = cursor.fetchone()

        if not emp:
            cursor.close(); conn.close()
            raise HTTPException(status_code=404, detail="Employee not found")

        # Address: profile first, city/state fallback
        address = ""
        try:
            cursor.execute(
                "SELECT current_address FROM employee_profiles WHERE employee_id = %s LIMIT 1",
                (employee_id,)
            )
            prof = cursor.fetchone()
            if prof and prof.get("current_address"):
                address = prof["current_address"]
        except Exception:
            pass
        if not address:
            address = ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""

        # Salary: employee_salaries first
        annual_salary = 0
        try:
            cursor.execute(
                """SELECT ctc, gross_salary FROM employee_salaries
                   WHERE employee_id = %s AND status = 'active'
                   ORDER BY effective_from DESC LIMIT 1""",
                (employee_id,)
            )
            sal = cursor.fetchone()
            if sal:
                ctc   = float(sal.get("ctc") or 0)
                gross = float(sal.get("gross_salary") or 0)
                annual_salary = int(ctc) if ctc > 0 else int(gross * 12)
        except Exception:
            pass

        # Format joining date as YYYY-MM-DD for <input type="date">
        jd = emp.get("joining_date")
        joining_date_str = jd.strftime("%Y-%m-%d") if hasattr(jd, "strftime") else str(jd or "")

        cursor.close(); conn.close()
        return {
            "success": True,
            "data": {
                "employee_code": emp.get("employee_code") or employee_id,
                "full_name":     emp.get("full_name") or "",
                "email":         emp.get("email") or "",
                "position":      emp.get("title") or "",
                "department":    emp.get("department") or "",
                "phone":         emp.get("phone") or "",
                "address":       address,
                "joining_date":  joining_date_str,
                "annual_salary": annual_salary,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee: {e}")


# ---------------------------------------------------------------------------
# GET /api/documents/download/{filename}
# Download a generated document
# ---------------------------------------------------------------------------
@router.get("/api/documents/download/{filename}")
def download_document(
    filename: str,
    employee_id: Optional[str] = None,
    force_download: bool = False,
):
    import os
    import re
    from fastapi.responses import FileResponse

    if not re.match(r'^[\w\-\.]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    def _get_media_type(fname: str) -> str:
        if fname.endswith(".pdf"):
            return "application/pdf"
        elif fname.endswith(".docx"):
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return None

    file_path = None
    possible_paths = [
        os.path.join("generated_docs", filename),
        os.path.join("backend", "generated_docs", filename),
        os.path.join("..", "generated_docs", filename),
        filename
    ]
    
    for p in possible_paths:
        if os.path.exists(p):
            file_path = p
            break
            
    if not file_path:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    if filename.startswith("salary_slip_"):
        if not employee_id:
            raise HTTPException(status_code=403, detail="employee_id is required to download salary slips")
        try:
            conn = _db()
            cur  = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT employee_id FROM document_requests WHERE file_url LIKE %s LIMIT 1",
                (f"%{filename}",),
            )
            rec = cur.fetchone()
            cur.close(); conn.close()
            if not rec or rec["employee_id"] != employee_id:
                raise HTTPException(status_code=403, detail="Access denied")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail="Internal error during access check")

    headers = {}
    if force_download:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    return FileResponse(file_path, filename=os.path.basename(file_path), media_type=_get_media_type(filename), headers=headers)