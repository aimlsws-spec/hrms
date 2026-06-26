from fastapi import APIRouter
from typing import List
import json
import os
import mysql.connector
from datetime import datetime

router = APIRouter()
SETTINGS_FILE = "data/system_settings.json"

from config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

@router.get("/api/settings/system")
async def get_system_settings():
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                settings = json.load(f)
        else:
            settings = {}
        return {"success": True, "settings": settings}
    except Exception as e:
        return {"success": False, "message": str(e), "settings": {}}

@router.post("/api/settings/system")
async def save_system_settings(data: dict):
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        return {"success": True, "message": "Settings saved successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Holiday Management Endpoints
@router.get("/api/settings/holidays")
async def get_holidays():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, holiday_name as name, holiday_date as date, holiday_type as type FROM holidays ORDER BY holiday_date")
        holidays = cursor.fetchall()
        conn.close()
        return {"success": True, "holidays": holidays}
    except Exception as e:
        return {"success": False, "message": str(e), "holidays": []}

@router.post("/api/settings/holidays")
async def add_holiday(data: dict):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO holidays (holiday_name, holiday_date, holiday_type) VALUES (%s, %s, %s)",
            (data['name'], data['date'], data['type'])
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Holiday added successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.put("/api/settings/holidays/{holiday_id}")
async def update_holiday(holiday_id: int, data: dict):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE holidays SET holiday_name=%s, holiday_date=%s, holiday_type=%s WHERE id=%s",
            (data['name'], data['date'], data['type'], holiday_id)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Holiday updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.delete("/api/settings/holidays/{holiday_id}")
async def delete_holiday(holiday_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM holidays WHERE id=%s", (holiday_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Holiday deleted successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Sandwich Leave Policy Check
@router.post("/api/leave/check-sandwich")
async def check_sandwich_leave(data: dict):
    try:
        from sandwich_leave_policy import check_sandwich_leave
        result = check_sandwich_leave(data['start_date'], data['end_date'])
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "message": str(e)}
