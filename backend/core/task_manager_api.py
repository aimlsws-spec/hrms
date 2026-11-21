# Task Manager API with Kanban Board Support
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import mysql.connector

router = APIRouter(prefix="/api/task-manager", tags=["Task Manager"])

from backend.config import DB_CONFIG

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    position: Optional[int] = None

@router.get("/boards")
def get_boards():
    """Get all task boards"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM task_boards ORDER BY created_at DESC")
        boards = cursor.fetchall()
        conn.close()
        return {"success": True, "boards": boards}
    except Exception as e:
        return {"success": False, "boards": [], "message": str(e)}

@router.get("/boards/{board_id}/tasks")
def get_board_tasks(board_id: int):
    """Get all tasks for a board grouped by status"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT t.*, CONCAT(e.first_name, ' ', e.last_name) as assigned_name
            FROM kanban_tasks t
            LEFT JOIN employees e ON t.assigned_to = e.employee_id
            WHERE t.board_id = %s
            ORDER BY t.position
        """, (board_id,))
        tasks = cursor.fetchall()
        conn.close()

        grouped = {"todo": [], "in_progress": [], "review": [], "done": []}
        for task in tasks:
            status = task.get('status', 'todo')
            if status in grouped:
                grouped[status].append(task)

        return {"success": True, "tasks": grouped}
    except Exception as e:
        return {"success": False, "tasks": {}, "message": str(e)}

@router.post("/boards/{board_id}/tasks")
def create_task(board_id: int, task: TaskCreate):
    """Create new task"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO kanban_tasks (board_id, title, description, status, priority, assigned_to, due_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (board_id, task.title, task.description, task.status, task.priority, task.assigned_to, task.due_date))
    conn.commit()
    task_id = cursor.lastrowid
    conn.close()
    return {"success": True, "task_id": task_id}

@router.put("/tasks/{task_id}")
def update_task(task_id: int, task: TaskUpdate):
    """Update task"""
    conn = get_db()
    cursor = conn.cursor()
    
    updates = []
    values = []
    if task.title is not None: updates.append("title=%s"); values.append(task.title)
    if task.description is not None: updates.append("description=%s"); values.append(task.description)
    if task.status is not None: updates.append("status=%s"); values.append(task.status)
    if task.priority is not None: updates.append("priority=%s"); values.append(task.priority)
    if task.assigned_to is not None: updates.append("assigned_to=%s"); values.append(task.assigned_to)
    if task.due_date is not None: updates.append("due_date=%s"); values.append(task.due_date)
    if task.position is not None: updates.append("position=%s"); values.append(task.position)
    
    if not updates:
        return {"success": False, "message": "No fields to update"}
    
    values.append(task_id)
    query = f"UPDATE kanban_tasks SET {', '.join(updates)} WHERE id=%s"
    print(f"Executing query: {query} with values: {values}")
    cursor.execute(query, values)
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    print(f"Rows affected: {affected}")
    return {"success": True, "affected": affected}

@router.post("/tasks/{task_id}/move")
def move_task(task_id: int, new_status: str, new_position: int):
    """Move task to new column/position"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE kanban_tasks SET status=%s, position=%s WHERE id=%s", 
                   (new_status, new_position, task_id))
    conn.commit()
    conn.close()
    return {"success": True}

@router.post("/tasks/{task_id}/mark-incomplete")
def mark_task_incomplete(task_id: int):
    """Mark task as incomplete and flag it"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE kanban_tasks 
        SET status='in_progress', flagged=1, flagged_at=NOW() 
        WHERE id=%s
    """, (task_id,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Task marked as incomplete and flagged"}

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    """Delete task"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM kanban_tasks WHERE id=%s", (task_id,))
    conn.commit()
    conn.close()
    return {"success": True}
