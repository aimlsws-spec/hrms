"""
Performance Management API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector

from backend.config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

router = APIRouter()

class PerformanceReview(BaseModel):
    employee_id: str
    review_period: str
    review_date: str
    reviewer_id: str
    technical_skills: int
    communication: int
    teamwork: int
    productivity: int
    leadership: int
    strengths: str
    areas_improvement: str
    goals: str
    comments: Optional[str] = None

class Goal(BaseModel):
    employee_id: str
    goal_title: str
    description: str
    target_date: str
    created_by: str

@router.post("/api/performance/review")
async def create_review(review: PerformanceReview):
    """Create performance review"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        overall = (review.technical_skills + review.communication + review.teamwork + 
                  review.productivity + review.leadership) / 5
        
        cursor.execute("""
            INSERT INTO performance_reviews 
            (employee_id, review_period, review_date, reviewer_id, technical_skills, 
             communication, teamwork, productivity, leadership, overall_rating, 
             strengths, areas_improvement, goals, comments, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'COMPLETED')
        """, (review.employee_id, review.review_period, review.review_date, review.reviewer_id,
              review.technical_skills, review.communication, review.teamwork, review.productivity,
              review.leadership, overall, review.strengths, review.areas_improvement, 
              review.goals, review.comments))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Review submitted", "overall_rating": overall}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/performance/reviews/{employee_id}")
async def get_reviews(employee_id: str):
    """Get performance reviews"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT pr.*, e.name as reviewer_name 
            FROM performance_reviews pr
            LEFT JOIN employees e ON pr.reviewer_id=e.employee_id
            WHERE pr.employee_id=%s
            ORDER BY pr.review_date DESC
        """, (employee_id,))
        
        reviews = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return {"success": True, "data": reviews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/performance/goal")
async def create_goal(goal: Goal):
    """Create goal"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO goals 
            (employee_id, goal_title, description, target_date, created_by, status)
            VALUES (%s, %s, %s, %s, %s, 'IN_PROGRESS')
        """, (goal.employee_id, goal.goal_title, goal.description, goal.target_date, goal.created_by))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Goal created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/performance/goals/{employee_id}")
async def get_goals(employee_id: str):
    """Get goals"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT * FROM goals 
            WHERE employee_id=%s
            ORDER BY created_at DESC
        """, (employee_id,))
        
        goals = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return {"success": True, "data": goals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/performance/goal/{goal_id}")
async def update_goal(goal_id: int, progress: int, status: str):
    """Update goal progress"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if status == "COMPLETED":
            cursor.execute("""
                UPDATE goals SET progress=%s, status=%s, completed_at=NOW()
                WHERE id=%s
            """, (progress, status, goal_id))
        else:
            cursor.execute("""
                UPDATE goals SET progress=%s, status=%s WHERE id=%s
            """, (progress, status, goal_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Goal updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Task Manager - HR can only see their own task performance
@router.get("/api/performance/my-tasks/{employee_id}")
async def get_my_task_performance(employee_id: str):
    """Get task performance for specific employee (their own tasks only)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee name for matching
        cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as full_name FROM employees WHERE employee_id = %s", (employee_id,))
        employee_result = cursor.fetchone()
        employee_name = employee_result['full_name'] if employee_result else None
        
        # Get tasks assigned to this employee (by ID or name)
        if employee_name:
            cursor.execute("""
                SELECT task_id, title, description, priority, status, category,
                       due_date, target_start_date, target_end_date, 
                       actual_start_date, actual_end_date, custom_weightage,
                       assigned_by, created_at, updated_at
                FROM tasks 
                WHERE assigned_to = %s OR assigned_to = %s
                ORDER BY created_at DESC
            """, (employee_id, employee_name))
        else:
            cursor.execute("""
                SELECT task_id, title, description, priority, status, category,
                       due_date, target_start_date, target_end_date, 
                       actual_start_date, actual_end_date, custom_weightage,
                       assigned_by, created_at, updated_at
                FROM tasks 
                WHERE assigned_to = %s
                ORDER BY created_at DESC
            """, (employee_id,))
        
        tasks = cursor.fetchall()
        
        # Calculate performance metrics
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t['status'] == 'Completed'])
        in_progress_tasks = len([t for t in tasks if t['status'] == 'In Progress'])
        pending_tasks = len([t for t in tasks if t['status'] in ['Pending', 'To Do']])
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        # Calculate average completion time for completed tasks
        completed_with_dates = [t for t in tasks if t['status'] == 'Completed' and t['actual_start_date'] and t['actual_end_date']]
        avg_completion_days = 0
        if completed_with_dates:
            total_days = sum([(t['actual_end_date'] - t['actual_start_date']).days for t in completed_with_dates])
            avg_completion_days = total_days / len(completed_with_dates)
        
        cursor.close()
        conn.close()
        
        return {
            "success": True, 
            "data": {
                "tasks": tasks,
                "metrics": {
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "in_progress_tasks": in_progress_tasks,
                    "pending_tasks": pending_tasks,
                    "completion_rate": round(completion_rate, 2),
                    "avg_completion_days": round(avg_completion_days, 1)
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Performance Reports - HR can see all employee performance including tasks
@router.get("/api/performance/reports/all")
async def get_all_performance_reports():
    """Get comprehensive performance reports for all employees"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get all employees with their task performance
        cursor.execute("""
            SELECT e.employee_id, e.name, e.department, e.title,
                   COUNT(t.id) as total_tasks,
                   SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
                   SUM(CASE WHEN t.status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_tasks,
                   SUM(CASE WHEN t.status IN ('Pending', 'To Do') THEN 1 ELSE 0 END) as pending_tasks,
                   AVG(CASE WHEN t.status = 'Completed' AND t.actual_start_date AND t.actual_end_date 
                       THEN DATEDIFF(t.actual_end_date, t.actual_start_date) ELSE NULL END) as avg_completion_days
            FROM employees e
            LEFT JOIN tasks t ON e.employee_id = t.assigned_to
            GROUP BY e.employee_id, e.name, e.department, e.title
            ORDER BY e.name
        """, ())
        
        employee_reports = cursor.fetchall()
        
        # Get performance reviews for each employee
        for employee in employee_reports:
            cursor.execute("""
                SELECT pr.overall_rating, pr.review_period, pr.status, pr.completed_at
                FROM performance_reviews pr
                WHERE pr.employee_id = %s
                ORDER BY pr.completed_at DESC
                LIMIT 3
            """, (employee['employee_id'],))
            
            reviews = cursor.fetchall()
            employee['recent_reviews'] = reviews
            
            # Calculate completion rate
            total = employee['total_tasks'] or 0
            completed = employee['completed_tasks'] or 0
            employee['completion_rate'] = round((completed / total * 100) if total > 0 else 0, 2)
            
            # Get latest performance rating
            employee['latest_rating'] = reviews[0]['overall_rating'] if reviews else None
        
        cursor.close()
        conn.close()
        
        return {"success": True, "data": employee_reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/performance/reports/employee/{employee_id}")
async def get_employee_performance_report(employee_id: str):
    """Get detailed performance report for specific employee"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee basic info
        cursor.execute("""
            SELECT employee_id, name, department, title, email
            FROM employees WHERE employee_id = %s
        """, (employee_id,))
        
        employee = cursor.fetchone()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Get task performance
        cursor.execute("""
            SELECT task_id, title, description, priority, status, category,
                   due_date, target_start_date, target_end_date, 
                   actual_start_date, actual_end_date, custom_weightage,
                   assigned_by, created_at, updated_at
            FROM tasks 
            WHERE assigned_to = %s
            ORDER BY created_at DESC
        """, (employee_id,))
        
        tasks = cursor.fetchall()
        
        # Get performance reviews
        cursor.execute("""
            SELECT pr.*, e.name as reviewer_name 
            FROM performance_reviews pr
            LEFT JOIN employees e ON pr.reviewer_id = e.employee_id
            WHERE pr.employee_id = %s
            ORDER BY pr.completed_at DESC
        """, (employee_id,))
        
        reviews = cursor.fetchall()
        
        # Get goals
        cursor.execute("""
            SELECT * FROM goals 
            WHERE employee_id = %s
            ORDER BY created_at DESC
        """, (employee_id,))
        
        goals = cursor.fetchall()
        
        # Calculate metrics
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t['status'] == 'Completed'])
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        cursor.close()
        conn.close()
        
        return {
            "success": True, 
            "data": {
                "employee": employee,
                "tasks": tasks,
                "reviews": reviews,
                "goals": goals,
                "metrics": {
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "completion_rate": round(completion_rate, 2),
                    "latest_rating": reviews[0]['overall_rating'] if reviews else None
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/performance/reports/department/{department}")
async def get_department_performance_report(department: str):
    """Get performance report for specific department"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get department performance summary
        cursor.execute("""
            SELECT e.employee_id, e.name, e.title,
                   COUNT(t.id) as total_tasks,
                   SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completed_tasks,
                   AVG(pr.overall_rating) as avg_rating
            FROM employees e
            LEFT JOIN tasks t ON e.employee_id = t.assigned_to
            LEFT JOIN performance_reviews pr ON e.employee_id = pr.employee_id
            WHERE e.department = %s
            GROUP BY e.employee_id, e.name, e.title
            ORDER BY e.name
        """, (department,))
        
        department_data = cursor.fetchall()
        
        # Calculate department metrics
        total_employees = len(department_data)
        total_dept_tasks = sum([emp['total_tasks'] or 0 for emp in department_data])
        total_completed = sum([emp['completed_tasks'] or 0 for emp in department_data])
        dept_completion_rate = (total_completed / total_dept_tasks * 100) if total_dept_tasks > 0 else 0
        
        # Calculate completion rate for each employee
        for emp in department_data:
            total = emp['total_tasks'] or 0
            completed = emp['completed_tasks'] or 0
            emp['completion_rate'] = round((completed / total * 100) if total > 0 else 0, 2)
        
        cursor.close()
        conn.close()
        
        return {
            "success": True, 
            "data": {
                "department": department,
                "employees": department_data,
                "summary": {
                    "total_employees": total_employees,
                    "total_tasks": total_dept_tasks,
                    "completed_tasks": total_completed,
                    "department_completion_rate": round(dept_completion_rate, 2)
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
