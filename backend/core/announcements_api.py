from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import mysql.connector
from datetime import datetime
from backend.config import DB_CONFIG
import logging

router = APIRouter(prefix="/api/announcements", tags=["Announcements"])
logger = logging.getLogger(__name__)

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

class AnnouncementPayload(BaseModel):
    title: str
    content: str
    created_by: str
    created_by_name: str
    target_role: Optional[str] = 'all'

@router.get("")
@router.get("/")
def get_all_announcements():
    """Fetch all active announcements."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC")
        rows = cur.fetchall()
        
        # Serialize datetime
        for r in rows:
            if isinstance(r.get('created_at'), datetime):
                r['created_at'] = r['created_at'].isoformat()
                
        return {"success": True, "announcements": rows, "results": rows}
    except Exception as e:
        logger.error(f"Failed to fetch announcements: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@router.post("/create")
def create_announcement(data: AnnouncementPayload):
    """Create a new announcement."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO announcements 
               (title, content, created_by, created_by_name, target_role) 
               VALUES (%s, %s, %s, %s, %s)""",
            (data.title, data.content, data.created_by, data.created_by_name, data.target_role)
        )
        conn.commit()
        return {"success": True, "message": "Announcement created successfully"}
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        logger.error(f"Failed to create announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()
