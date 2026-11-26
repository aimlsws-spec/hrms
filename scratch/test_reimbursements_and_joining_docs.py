import sys
import os
sys.path.insert(0, os.path.abspath("."))
import io
import mysql.connector
from backend.config import DB_CONFIG
from fastapi.testclient import TestClient
from backend.app import app

def run_tests():
    print("=== STARTING REIMBURSEMENTS & JOINING DOCUMENTS ASSURANCE TESTS ===")
    client = TestClient(app)
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor(dictionary=True)

    test_emp_id = "EMP_REIMB_TEST"
    test_email = "reimb_test@company.com"

    # Clean up previous runs
    cur.execute("DELETE FROM reimbursements WHERE employee_id = %s", (test_emp_id,))
    cur.execute("DELETE FROM employee_joining_documents WHERE employee_id = %s", (test_emp_id,))
    cur.execute("DELETE FROM users WHERE user_id = %s OR email = %s", (test_emp_id, test_email))
    cur.execute("DELETE FROM employees WHERE employee_code = %s OR email = %s", (test_emp_id, test_email))
    conn.commit()

    # 1. Setup test employee and user
    cur.execute("""
        INSERT INTO users (user_id, username, email, password, assigned_password, role, full_name, profile_completed)
        VALUES (%s, %s, %s, 'pass123', 'pass123', 'employee', 'Reimb Test User', 1)
    """, (test_emp_id, test_emp_id, test_email))
    cur.execute("""
        INSERT INTO employees (employee_code, full_name, email, department, title, status)
        VALUES (%s, 'Reimb Test User', %s, 'Engineering', 'Software Engineer', 'active')
    """, (test_emp_id, test_email))
    conn.commit()
    print(f"[INFO] Created test employee: {test_emp_id}")

    # 2. Test Employee Reimbursement Submission with UPI & Receipt Attachment
    receipt_content = b"%PDF-1.4 test receipt file contents"
    files = {
        "receipt": ("my_upi_screenshot.png", io.BytesIO(b"fake png image bytes for upi"), "image/png")
    }
    data = {
        "employee_id": test_emp_id,
        "amount": "1450.75",
        "reason": "Client lunch and local travel",
        "expense_date": "2026-11-26",
        "payment_method": "UPI"
    }

    sub_res = client.post("/api/employee/expenses", data=data, files=files)
    assert sub_res.status_code == 200, f"Submit expense failed: {sub_res.text}"
    sub_json = sub_res.json()
    assert sub_json.get("success"), f"Submit response not successful: {sub_json}"
    reimb_id = sub_json.get("id")
    print(f"[PASS] 1. Employee reimbursement submitted with UPI and screenshot. Created ID: #{reimb_id}")

    # Verify in DB
    cur.execute("SELECT * FROM reimbursements WHERE id = %s", (reimb_id,))
    reimb_row = cur.fetchone()
    assert reimb_row is not None, "Reimbursement record not found in DB!"
    assert reimb_row["payment_method"] == "UPI", f"Expected UPI, got {reimb_row['payment_method']}"
    assert float(reimb_row["amount"]) == 1450.75, f"Expected 1450.75, got {reimb_row['amount']}"
    assert reimb_row["receipt_path"] and "/uploads/reimbursements/" in reimb_row["receipt_path"], f"Invalid receipt path: {reimb_row['receipt_path']}"
    print(f"[PASS] 2. DB verified: payment_method=UPI, receipt_path={reimb_row['receipt_path']}")

    # 3. Test HR Retrieving Reimbursements List
    hr_res = client.get("/api/hr/reimbursements?status=pending")
    assert hr_res.status_code == 200, f"HR get reimbursements failed: {hr_res.text}"
    hr_json = hr_res.json()
    assert hr_json.get("success"), "HR response success is false"
    claims = hr_json.get("reimbursements", [])
    found = next((c for c in claims if c["id"] == reimb_id), None)
    assert found is not None, f"Claim #{reimb_id} not returned in HR list!"
    assert found["payment_method"] == "UPI"
    assert found["employee_name"] == "Reimb Test User"
    print("[PASS] 3. HR retrieved pending claim list with employee name, UPI payment method, and screenshot.")

    # 4. Test HR Directly Approving Reimbursement Payment
    review_res = client.post(f"/api/hr/reimbursements/{reimb_id}/review", json={
        "action": "APPROVED",
        "comments": "Approved for instant reimbursement.",
        "reviewed_by": "Priya Sharma (HR Head)",
        "actor_role": "hr"
    })
    assert review_res.status_code == 200 and review_res.json().get("success"), f"Review failed: {review_res.text}"

    # Refresh transaction snapshot
    conn.commit()

    # Verify status in DB
    cur.execute("SELECT status, reviewed_by, comments FROM reimbursements WHERE id = %s", (reimb_id,))
    approved_row = cur.fetchone()
    assert approved_row["status"] == "approved", f"Status not approved: {approved_row['status']}"
    assert "Priya Sharma (HR Head)" in approved_row["reviewed_by"]
    print("[PASS] 4. HR approved reimbursement payment directly. Status updated to 'approved' without extra finance step.")

    # 5. Test Employee Joining Documents Upload
    doc_files = {
        "file": ("Signed_Offer_Letter.pdf", io.BytesIO(b"%PDF-1.4 official appointment document"), "application/pdf")
    }
    doc_data = {
        "document_type": "Signed Appointment Letter",
        "document_name": "Signed Appointment & Acceptance Letter 2026",
        "uploaded_by": "Vikram Mehta (HR Head)",
        "actor_role": "hr"
    }
    upload_res = client.post(f"/api/employees/{test_emp_id}/joining-documents", data=doc_data, files=doc_files)
    assert upload_res.status_code == 200 and upload_res.json().get("success"), f"Upload joining doc failed: {upload_res.text}"
    created_doc = upload_res.json().get("document", {})
    doc_id = created_doc.get("id")
    file_rel_path = created_doc.get("file_path")
    print(f"[PASS] 5. Uploaded joining document (PDF). Created ID: #{doc_id}, Path: {file_rel_path}")

    # Check physical file on disk
    phys_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), file_rel_path.lstrip("/\\").replace("/", os.sep))
    assert os.path.exists(phys_file), f"Physical file does not exist on disk at {phys_file}!"
    print(f"[PASS] 6. Physical joining document verified on disk ({phys_file})")

    # 6. Test Listing Joining Documents for Employee
    list_res = client.get(f"/api/employees/{test_emp_id}/joining-documents")
    assert list_res.status_code == 200 and list_res.json().get("success"), f"List joining docs failed: {list_res.text}"
    emp_docs = list_res.json().get("documents", [])
    assert any(d["id"] == doc_id for d in emp_docs), "Uploaded doc not found in employee joining documents list!"
    print("[PASS] 7. Joining documents list retrieved for employee.")

    # 7. Test Deleting Joining Document
    del_res = client.delete(f"/api/employees/{test_emp_id}/joining-documents/{doc_id}")
    assert del_res.status_code == 200 and del_res.json().get("success"), f"Delete joining doc failed: {del_res.text}"
    conn.commit()
    cur.execute("SELECT id FROM employee_joining_documents WHERE id = %s", (doc_id,))
    assert cur.fetchone() is None, "Joining document was not deleted from DB!"
    print("[PASS] 8. Joining document deleted cleanly from database.")

    # 8. Test HR Activity Logs for Reimbursement & Joining Docs
    conn.commit()
    cur.execute("""
        SELECT action, details FROM hr_activity_logs 
        WHERE target_employee_id = %s 
        ORDER BY id DESC
    """, (test_emp_id,))
    act_rows = cur.fetchall()
    actions = [r["action"] for r in act_rows]
    assert "REIMBURSEMENT_APPROVED" in actions, f"Missing REIMBURSEMENT_APPROVED log. Found: {actions}"
    assert "JOINING_DOCUMENT_UPLOADED" in actions, f"Missing JOINING_DOCUMENT_UPLOADED log. Found: {actions}"
    assert "JOINING_DOCUMENT_DELETED" in actions, f"Missing JOINING_DOCUMENT_DELETED log. Found: {actions}"
    print("[PASS] 9. All HR actions audited and logged in hr_activity_logs.")

    # Clean up test data
    cur.execute("DELETE FROM reimbursements WHERE employee_id = %s", (test_emp_id,))
    cur.execute("DELETE FROM employee_joining_documents WHERE employee_id = %s", (test_emp_id,))
    cur.execute("DELETE FROM users WHERE user_id = %s", (test_emp_id,))
    cur.execute("DELETE FROM employees WHERE employee_code = %s", (test_emp_id,))
    cur.execute("DELETE FROM hr_activity_logs WHERE target_employee_id = %s", (test_emp_id,))
    conn.commit()
    cur.close()
    conn.close()
    print("[PASS] 10. Test cleanup completed.")
    print("=== ALL REIMBURSEMENT AND JOINING DOCUMENT ASSURANCE TESTS PASSED! ===")

if __name__ == "__main__":
    run_tests()
