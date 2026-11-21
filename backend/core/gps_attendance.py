from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import mysql.connector
import os
from math import radians, sin, cos, sqrt, atan2

router = APIRouter(prefix="/api/gps-attendance", tags=["GPS Attendance"])

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'hrms_complete')
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters using Haversine formula"""
    R = 6371000  # Earth radius in meters
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c

class LocationModel(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    radius_meters: int = 100

class PunchModel(BaseModel):
    employee_id: str
    punch_type: str  # "IN" or "OUT"
    latitude: float
    longitude: float
    device_info: str = ""

@router.post("/locations")
def add_location(location: LocationModel):
    """Add a new geo-fenced location"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO geo_locations (location_name, latitude, longitude, radius_meters) VALUES (%s, %s, %s, %s)",
            (location.location_name, location.latitude, location.longitude, location.radius_meters)
        )
        conn.commit()
        location_id = cursor.lastrowid
        conn.close()
        return {"success": True, "message": "Location added", "location_id": location_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/locations")
def get_locations():
    """Get all active geo-fenced locations"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM geo_locations WHERE is_active = TRUE")
        locations = cursor.fetchall()
        conn.close()
        return {"success": True, "locations": locations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/punch")
def record_punch(punch: PunchModel):
    """Record attendance punch with GPS validation"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get all active locations
        cursor.execute("SELECT * FROM geo_locations WHERE is_active = TRUE")
        locations = cursor.fetchall()
        
        # Find nearest valid location
        nearest_location = None
        min_distance = float('inf')
        
        for loc in locations:
            distance = calculate_distance(
                punch.latitude, punch.longitude,
                float(loc['latitude']), float(loc['longitude'])
            )
            if distance < min_distance:
                min_distance = distance
                nearest_location = loc
        
        # Check if within geofence
        is_valid = nearest_location and min_distance <= nearest_location['radius_meters']
        
        # Record punch
        cursor.execute(
            """INSERT INTO gps_attendance 
            (employee_id, punch_type, punch_time, latitude, longitude, location_id, distance_meters, is_valid, device_info)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (punch.employee_id, punch.punch_type, datetime.now(), punch.latitude, punch.longitude,
             nearest_location['id'] if nearest_location else None, min_distance, is_valid, punch.device_info)
        )
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "is_valid": is_valid,
            "distance_meters": round(min_distance, 2),
            "location_name": nearest_location['location_name'] if nearest_location else "Unknown",
            "message": "Punch recorded successfully" if is_valid else "Outside geofence area"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{employee_id}")
def get_attendance_history(employee_id: str):
    """Get GPS attendance history for an employee"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT ga.*, gl.location_name 
            FROM gps_attendance ga
            LEFT JOIN geo_locations gl ON ga.location_id = gl.id
            WHERE ga.employee_id = %s
            ORDER BY ga.punch_time DESC""",
            (employee_id,)
        )
        records = cursor.fetchall()
        conn.close()
        return {"success": True, "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
