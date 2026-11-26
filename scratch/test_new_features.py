import sys
import os
sys.path.insert(0, os.path.abspath("."))
import mysql.connector
from backend.config import DB_CONFIG
from backend.core.admin_features_backend import edit_employee, update_employee_credentials
from backend.core.hr_activity_logger import log_hr_activity, get_hr_activity_logs

def run_tests():
    print("=== STARTING AUTOMATED ASSURANCE TESTS ===")
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor(dictionary=True)

    # 1. Test public signup is blocked
    from fastapi.testclient import TestClient
    from backend.app import app
    client = TestClient(app)

    signup_res = client.post("/api/auth/signup", json={
        "full_name": "Self Register User",
        "username": "selfreg",
        "email": "selfreg@test.com",
        "password": "password123"
    })
    assert signup_res.status_code == 200 and not signup_res.json().get("success"), f"Signup block test failed: {signup_res.text}"
    assert "Self-registration is disabled" in signup_res.json().get("message", ""), f"Unexpected error message: {signup_res.text}"
    print("[PASS] 1. Self-service employee signup is disabled. Only HR creation allowed.")

    # 2. Test employee credential update & cascade
    # Create a test employee if not exists
    test_emp_id = "EMP_TEST_99"
    test_new_id = "EMP_TEST_100"
    test_email = "test_user_cascade@company.com"

    # Clean up previous test runs
    cur.execute("DELETE FROM users WHERE user_id IN (%s, %s) OR email = %s", (test_emp_id, test_new_id, test_email))
    cur.execute("DELETE FROM employees WHERE employee_id IN (%s, %s) OR email = %s", (test_emp_id, test_new_id, test_email))
    cur.execute("DELETE FROM employee_profiles WHERE employee_id IN (%s, %s)", (test_emp_id, test_new_id))
    cur.execute("DELETE FROM attendance WHERE employee_id IN (%s, %s)", (test_emp_id, test_new_id))
    conn.commit()

    # Insert test user and employee
    cur.execute("""
        INSERT INTO users (user_id, username, email, password, assigned_password, role, full_name, profile_completed)
        VALUES (%s, %s, %s, %s, %s, 'employee', 'Test Cascade User', 0)
    """, (test_emp_id, test_emp_id, test_email, 'initialPass123', 'initialPass123'))
    cur.execute("""
        INSERT INTO employees (employee_code, full_name, email, department, title, status)
        VALUES (%s, 'Test Cascade User', %s, 'IT', 'Developer', 'probation')
    """, (test_emp_id, test_email))
    cur.execute("""
        INSERT INTO employee_profiles (employee_id, profile_completed)
        VALUES (%s, 0)
    """, (test_emp_id,))
    cur.execute("""
        INSERT INTO attendance (employee_id, date, status)
        VALUES (%s, '2026-11-26', 'PRESENT')
    """, (test_emp_id,))
    conn.commit()
    print("[INFO] Created test employee EMP_TEST_99")

    # Update credentials via edit_employee (cascade ID to EMP_TEST_100, change password to 'NewSecret456')
    edit_res = edit_employee(
        employee_id=test_emp_id,
        data={
            "new_employee_id": test_new_id,
            "password": "NewSecret456"
        },
        actor="Priya Sharma (HR Head)"
    )
    assert edit_res.get("success"), f"edit_employee cascade failed: {edit_res}"
    print(f"[PASS] 2a. HR edited employee ID from {test_emp_id} to {test_new_id} and updated password.")

    # Verify cascading across tables
    cur.execute("SELECT user_id, assigned_password FROM users WHERE email = %s", (test_email,))
    user_row = cur.fetchone()
    assert user_row["user_id"] == test_new_id, f"User user_id did not cascade! Got {user_row}"
    assert user_row["assigned_password"] == "NewSecret456", f"Assigned password did not update! Got {user_row}"

    cur.execute("SELECT employee_id, employee_code FROM employees WHERE email = %s", (test_email,))
    emp_row = cur.fetchone()
    assert emp_row["employee_id"] == test_new_id and emp_row["employee_code"] == test_new_id, f"Employee code did not cascade! Got {emp_row}"

    cur.execute("SELECT employee_id FROM attendance WHERE employee_id = %s", (test_new_id,))
    att_row = cur.fetchone()
    assert att_row is not None, "Attendance record employee_id did not cascade!"

    cur.execute("SELECT employee_id FROM employee_profiles WHERE employee_id = %s", (test_new_id,))
    prof_row = cur.fetchone()
    assert prof_row is not None, "Employee profile employee_id did not cascade!"
    print("[PASS] 2b. Cascade verified across users, employees, attendance, and employee_profiles.")

    # 3. Test employee first-login setup endpoint
    setup_payload = {
        "employee_id": test_new_id,
        "email": test_email,
        "date_of_birth": "1998-05-15",
        "aadhaar_number": "123456789012",
        "pan_number": "ABCDE1234F",
        "current_address": "Flat 402, Green Heights, Pune, Maharashtra",
        "emergency_contact_name": "Ramesh Kumar",
        "emergency_contact_relation": "Father",
        "emergency_number": "9876543210"
    }
    setup_res = client.post("/api/employee/first-login-setup", json=setup_payload)
    assert setup_res.status_code == 200 and setup_res.json().get("success"), f"First login setup failed: {setup_res.text}"
    print("[PASS] 3a. First-login setup endpoint succeeded.")

    # Refresh transaction to read committed changes
    conn.commit()

    # Verify database was updated and profile_completed = 1
    cur.execute("SELECT profile_completed FROM users WHERE user_id = %s", (test_new_id,))
    user_check = cur.fetchone()
    assert user_check["profile_completed"] == 1, "users.profile_completed was not set to 1!"

    cur.execute("SELECT aadhaar_number, pan_number, emergency_contact_name, emergency_contact_relation FROM employees WHERE employee_id = %s", (test_new_id,))
    emp_kyc = cur.fetchone()
    assert emp_kyc["aadhaar_number"] == "123456789012", "Aadhaar number not persisted in employees!"
    assert emp_kyc["pan_number"] == "ABCDE1234F", "PAN number not persisted in employees!"
    assert emp_kyc["emergency_contact_name"] == "Ramesh Kumar", "Emergency contact not persisted!"

    cur.execute("SELECT current_address, emergency_number, profile_completed FROM employee_profiles WHERE employee_id = %s", (test_new_id,))
    prof_kyc = cur.fetchone()
    assert prof_kyc["profile_completed"] == 1, "employee_profiles.profile_completed was not set to 1!"
    assert "Green Heights" in prof_kyc["current_address"], "Address not persisted!"
    print("[PASS] 3b. First-login data verified in DB: Aadhaar, PAN, Address, Emergency Contact, and profile_completed = 1.")

    # 4. Test Sub-HR and HR Head activity log filtering & attribution
    log_hr_activity(
        performed_by="SUB_HR_01",
        performed_name="Pooja Patel",
        action="LEAVE_APPROVED",
        details="Approved sick leave for EMP0003",
        target_employee_id="EMP0003",
        target_employee_name="Bhoomi",
        role="sub_hr"
    )
    log_hr_activity(
        performed_by="HR_HEAD_01",
        performed_name="Vikram Mehta",
        action="STATUS_CHANGED",
        details="Changed status from probation to active",
        target_employee_id="EMP0003",
        target_employee_name="Bhoomi",
        role="hr"
    )

    # Audit filtering by role
    sub_hr_logs = get_hr_activity_logs(role="sub_hr")
    assert sub_hr_logs["success"] and len(sub_hr_logs["logs"]) > 0, "Failed to retrieve Sub-HR logs"
    assert any(l["performed_role"] == "sub_hr" for l in sub_hr_logs["logs"]), "Sub-HR role filtering failed!"

    hr_head_logs = get_hr_activity_logs(role="hr")
    assert hr_head_logs["success"] and len(hr_head_logs["logs"]) > 0, "Failed to retrieve HR Head logs"
    assert any(l["performed_role"] == "hr" for l in hr_head_logs["logs"]), "HR role filtering failed!"
    print("[PASS] 4. Sub-HR and HR Head activity logging and role filtering verified.")

    # Clean up test rows
    cur.execute("DELETE FROM users WHERE user_id = %s", (test_new_id,))
    cur.execute("DELETE FROM employees WHERE employee_id = %s", (test_new_id,))
    cur.execute("DELETE FROM employee_profiles WHERE employee_id = %s", (test_new_id,))
    cur.execute("DELETE FROM attendance WHERE employee_id = %s", (test_new_id,))
    conn.commit()
    cur.close()
    conn.close()
    print("[PASS] 5. Test cleanup completed.")
    print("=== ALL ASSURANCE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
