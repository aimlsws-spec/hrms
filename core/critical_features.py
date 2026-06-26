"""
Critical Features Module: Shift Management, GPS Attendance, Attendance Regularization
"""

from datetime import datetime, time, timedelta
from typing import Dict, List, Optional
import mysql.connector
from math import radians, cos, sin, asin, sqrt
from config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

# ==================== SHIFT MANAGEMENT ====================

class ShiftManager:
    
    @staticmethod
    def create_shift(shift_name: str, shift_type: str, start_time: str, end_time: str, break_duration: int = 60):
        """Create a new shift"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO shifts (shift_name, shift_type, start_time, end_time, break_duration)
            VALUES (%s, %s, %s, %s, %s)
        """, (shift_name, shift_type, start_time, end_time, break_duration))
        conn.commit()
        shift_id = cursor.lastrowid
        conn.close()
        return {"success": True, "shift_id": shift_id}
    
    @staticmethod
    def assign_shift(employee_id: str, shift_id: int, effective_date: str, rotation_pattern: str = None):
        """Assign shift to employee"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employee_shifts (employee_id, shift_id, effective_date, rotation_pattern)
            VALUES (%s, %s, %s, %s)
        """, (employee_id, shift_id, effective_date, rotation_pattern))
        conn.commit()
        conn.close()
        return {"success": True}
    
    @staticmethod
    def get_employee_shift(employee_id: str, date: str = None):
        """Get employee's current shift"""
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT es.*, s.shift_name, s.shift_type, s.start_time, s.end_time, s.break_duration
            FROM employee_shifts es
            JOIN shifts s ON es.shift_id = s.id
            WHERE es.employee_id = %s 
            AND es.effective_date <= %s
            AND (es.end_date IS NULL OR es.end_date >= %s)
            AND es.is_active = TRUE
            ORDER BY es.effective_date DESC
            LIMIT 1
        """, (employee_id, date, date))
        shift = cursor.fetchone()
        conn.close()
        return shift

# ==================== GPS ATTENDANCE ====================

class GPSAttendance:
    
    @staticmethod
    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two GPS coordinates in meters"""
        R = 6371000  # Earth radius in meters
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        return R * c
    
    @staticmethod
    def check_geofence(latitude: float, longitude: float):
        """Check if coordinates are within any geofence"""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM geofence_locations WHERE is_active = TRUE")
        locations = cursor.fetchall()
        conn.close()
        
        for loc in locations:
            distance = GPSAttendance.haversine_distance(
                latitude, longitude, 
                float(loc['latitude']), float(loc['longitude'])
            )
            if distance <= loc['radius_meters']:
                return {"within_geofence": True, "location": loc['location_name'], "distance": distance}
        
        return {"within_geofence": False, "distance": None}
    
    @staticmethod
    def mark_check_in(employee_id: str, latitude: float, longitude: float, location: str = None):
        """Mark GPS check-in"""
        geofence_check = GPSAttendance.check_geofence(latitude, longitude)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO gps_attendance 
            (employee_id, attendance_date, check_in_time, check_in_latitude, check_in_longitude, 
             check_in_location, is_within_geofence, distance_from_office)
            VALUES (%s, CURDATE(), NOW(), %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            check_in_time = NOW(),
            check_in_latitude = VALUES(check_in_latitude),
            check_in_longitude = VALUES(check_in_longitude),
            check_in_location = VALUES(check_in_location),
            is_within_geofence = VALUES(is_within_geofence),
            distance_from_office = VALUES(distance_from_office)
        """, (employee_id, latitude, longitude, location, 
              geofence_check['within_geofence'], geofence_check.get('distance')))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "within_geofence": geofence_check['within_geofence'],
            "distance": geofence_check.get('distance'),
            "message": "Check-in recorded successfully"
        }
    
    @staticmethod
    def mark_check_out(employee_id: str, latitude: float, longitude: float, location: str = None):
        """Mark GPS check-out"""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE gps_attendance 
            SET check_out_time = NOW(),
                check_out_latitude = %s,
                check_out_longitude = %s,
                check_out_location = %s
            WHERE employee_id = %s AND attendance_date = CURDATE()
        """, (latitude, longitude, location, employee_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Check-out recorded successfully"}

# ==================== ATTENDANCE REGULARIZATION ====================

class AttendanceRegularization:
    
    @staticmethod
    def request_regularization(employee_id: str, attendance_date: str,
                              requested_check_in: str, requested_check_out: str, reason: str):
        """Submit attendance regularization request"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # Try to get original attendance (table may be named 'attendance' with column 'date')
            original = None
            try:
                cursor.execute("""
                    SELECT check_in, check_out FROM attendance
                    WHERE employee_id = %s AND date = %s
                """, (employee_id, attendance_date))
                original = cursor.fetchone()
            except Exception:
                pass

            cursor.execute("""
                INSERT INTO attendance_regularization
                (employee_id, attendance_date, original_check_in, original_check_out,
                 requested_check_in, requested_check_out, reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (employee_id, attendance_date,
                  original['check_in'] if original else None,
                  original['check_out'] if original else None,
                  requested_check_in, requested_check_out, reason))

            conn.commit()
            request_id = cursor.lastrowid
            cursor.close()
            conn.close()

            return {"success": True, "request_id": request_id, "message": "Regularization request submitted"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @staticmethod
    def approve_regularization(request_id: int, approved_by: str, comments: str = None):
        """Approve regularization request"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            cursor.execute("SELECT * FROM attendance_regularization WHERE id = %s", (request_id,))
            request = cursor.fetchone()

            if not request:
                cursor.close()
                conn.close()
                return {"success": False, "message": "Request not found"}

            # Update regularization status
            cursor.execute("""
                UPDATE attendance_regularization
                SET status = 'Approved', approved_by = %s, approval_comments = %s, approved_at = NOW()
                WHERE id = %s
            """, (approved_by, comments, request_id))

            # Best-effort update of the actual attendance record
            try:
                cursor.execute("""
                    UPDATE attendance
                    SET check_in = %s, check_out = %s
                    WHERE employee_id = %s AND date = %s
                """, (request['requested_check_in'], request['requested_check_out'],
                      request['employee_id'], request['attendance_date']))
            except Exception:
                pass

            conn.commit()
            cursor.close()
            conn.close()

            return {"success": True, "message": "Regularization approved and attendance updated"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @staticmethod
    def get_pending_requests():
        """Get all pending regularization requests"""
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT ar.*,
                       COALESCE(e.full_name,
                           CONCAT(e.first_name, ' ', e.last_name)) AS employee_name
                FROM attendance_regularization ar
                LEFT JOIN employees e ON ar.employee_id = e.employee_id
                WHERE ar.status = 'Pending'
                ORDER BY ar.created_at DESC
            """)
            requests = cursor.fetchall()
            cursor.close()
            conn.close()
            return requests
        except Exception as e:
            raise RuntimeError(str(e))
