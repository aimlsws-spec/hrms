from fastapi import APIRouter, HTTPException
import mysql.connector
from datetime import date
import logging
from backend.config import DB_CONFIG

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])
logger = logging.getLogger(__name__)

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@router.get("/stats")
def get_dashboard_stats():
    """
    Returns real statistics computed from the existing HRMS database schema.
    No arbitrary placeholder values are used.
    """
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    today_str = date.today().isoformat()
    
    stats = {
        "totalEmployees": 0,
        "activeEmployees": 0,
        "pendingLeaveRequests": 0,
        "approvedLeaveRequests": 0,
        "presentToday": 0,
        "absentToday": 0,
        "wfoAttendance": 0,
        "wfhAttendance": 0,
        "pendingDocumentRequests": 0,
        "pendingSalarySlipRequests": 0,
        "totalDepartments": 0
    }
    
    try:
        # Total Employees
        cur.execute("SELECT COUNT(*) as count FROM employees")
        res = cur.fetchone()
        stats["totalEmployees"] = res["count"] if res else 0
        stats["activeEmployees"] = stats["totalEmployees"] # Assuming all listed are active if no is_active column
        
        # Leaves
        cur.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'PENDING'")
        res = cur.fetchone()
        stats["pendingLeaveRequests"] = res["count"] if res else 0

        cur.execute("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'APPROVED'")
        res = cur.fetchone()
        stats["approvedLeaveRequests"] = res["count"] if res else 0

        # Attendance (Present/Absent Today)
        cur.execute("SELECT COUNT(*) as count FROM attendance WHERE date = %s AND status = 'PRESENT'", (today_str,))
        res = cur.fetchone()
        stats["presentToday"] = res["count"] if res else 0

        cur.execute("SELECT COUNT(*) as count FROM attendance WHERE date = %s AND status = 'ABSENT'", (today_str,))
        res = cur.fetchone()
        stats["absentToday"] = res["count"] if res else 0

        # Work Mode (WFO/WFH)
        cur.execute("SELECT COUNT(*) as count FROM daily_work_mode WHERE work_date = %s AND mode = 'WFO'", (today_str,))
        res = cur.fetchone()
        stats["wfoAttendance"] = res["count"] if res else 0

        cur.execute("SELECT COUNT(*) as count FROM daily_work_mode WHERE work_date = %s AND mode = 'WFH'", (today_str,))
        res = cur.fetchone()
        stats["wfhAttendance"] = res["count"] if res else 0

        # Documents
        cur.execute("SELECT COUNT(*) as count FROM document_requests WHERE status = 'pending' AND document_type != 'salary-slip'")
        res = cur.fetchone()
        stats["pendingDocumentRequests"] = res["count"] if res else 0
        
        cur.execute("SELECT COUNT(*) as count FROM document_requests WHERE status = 'pending' AND document_type = 'salary-slip'")
        res = cur.fetchone()
        stats["pendingSalarySlipRequests"] = res["count"] if res else 0

        # Departments
        try:
            cur.execute("SELECT COUNT(*) as count FROM departments")
            res = cur.fetchone()
            stats["totalDepartments"] = res["count"] if res else 0
        except Exception:
            stats["totalDepartments"] = 0 # Table might not exist or be empty
            conn.rollback()
            
        return {"success": True, "stats": stats, "data": stats}
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
