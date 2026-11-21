"""
Support Ticket Management System
Handles ticket creation, assignment, comments, and resolution
"""
import mysql.connector
from datetime import datetime
from typing import Optional, List, Dict

class TicketSystem:
    def __init__(self, db_config):
        self.db_config = db_config
    
    def get_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    def generate_ticket_id(self) -> str:
        """Generate unique ticket ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM support_tickets")
        count = cursor.fetchone()[0]
        conn.close()
        return f"TKT{str(count + 1).zfill(4)}"
    
    def create_ticket(self, title: str, description: str, category: str, 
                     priority: str, created_by: str, created_by_name: str, 
                     created_by_role: str) -> Dict:
        """Create new support ticket"""
        try:
            ticket_id = self.generate_ticket_id()
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO support_tickets 
                (ticket_id, title, description, category, priority, created_by, 
                 created_by_name, created_by_role)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (ticket_id, title, description, category, priority, created_by, 
                  created_by_name, created_by_role))
            
            conn.commit()
            conn.close()
            
            return {
                "success": True, 
                "message": "Ticket created successfully",
                "ticket_id": ticket_id
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def get_tickets(self, user_id: str, user_role: str, filters: Dict = None) -> List[Dict]:
        """Get tickets based on user role"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_role == 'employee':
            query = "SELECT * FROM support_tickets WHERE created_by = %s ORDER BY created_at DESC"
            cursor.execute(query, (user_id,))
        elif user_role == 'support':
            query = """SELECT * FROM support_tickets 
                      WHERE assigned_to = %s OR assigned_to IS NULL 
                      ORDER BY priority DESC, created_at DESC"""
            cursor.execute(query, (user_id,))
        else:  # admin, hr
            query = "SELECT * FROM support_tickets ORDER BY created_at DESC"
            cursor.execute(query)
        
        tickets = cursor.fetchall()
        conn.close()
        return tickets
    
    def get_ticket_by_id(self, ticket_id: str, user_id: str, user_role: str) -> Optional[Dict]:
        """Get ticket details with access control"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM support_tickets WHERE ticket_id = %s", (ticket_id,))
        ticket = cursor.fetchone()
        conn.close()
        
        if not ticket:
            return None
        
        # Access control
        if user_role == 'employee' and ticket['created_by'] != user_id:
            return None
        
        return ticket
    
    def assign_ticket(self, ticket_id: str, assigned_to: str, 
                     assigned_to_name: str, assigned_by_role: str) -> Dict:
        """Assign ticket to support staff"""
        if assigned_by_role not in ['admin', 'support']:
            return {"success": False, "message": "Only admin and support can assign tickets"}
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE support_tickets 
                SET assigned_to = %s, assigned_to_name = %s, 
                    status = 'In Progress', updated_at = NOW()
                WHERE ticket_id = %s
            """, (assigned_to, assigned_to_name, ticket_id))
            
            conn.commit()
            conn.close()
            
            return {"success": True, "message": "Ticket assigned successfully"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def update_status(self, ticket_id: str, new_status: str, 
                     user_id: str, user_role: str, 
                     resolution_notes: str = None) -> Dict:
        """Update ticket status"""
        if user_role not in ['admin', 'support']:
            return {"success": False, "message": "Only admin and support can update status"}
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            if new_status == 'Resolved':
                cursor.execute("""
                    UPDATE support_tickets 
                    SET status = %s, resolved_at = NOW(), resolution_notes = %s, updated_at = NOW()
                    WHERE ticket_id = %s
                """, (new_status, resolution_notes, ticket_id))
            else:
                cursor.execute("""
                    UPDATE support_tickets 
                    SET status = %s, updated_at = NOW()
                    WHERE ticket_id = %s
                """, (new_status, ticket_id))
            
            conn.commit()
            conn.close()
            
            return {"success": True, "message": "Status updated successfully"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def add_comment(self, ticket_id: str, user_id: str, user_name: str, 
                   user_role: str, comment_text: str, is_internal: bool = False) -> Dict:
        """Add comment to ticket"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO ticket_comments 
                (ticket_id, user_id, user_name, user_role, comment_text, is_internal)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (ticket_id, user_id, user_name, user_role, comment_text, is_internal))
            
            # Update ticket timestamp
            cursor.execute("""
                UPDATE support_tickets SET updated_at = NOW() WHERE ticket_id = %s
            """, (ticket_id,))
            
            conn.commit()
            conn.close()
            
            return {"success": True, "message": "Comment added successfully"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def get_comments(self, ticket_id: str, user_role: str) -> List[Dict]:
        """Get ticket comments"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_role in ['admin', 'support']:
            cursor.execute("""
                SELECT * FROM ticket_comments 
                WHERE ticket_id = %s 
                ORDER BY created_at ASC
            """, (ticket_id,))
        else:
            cursor.execute("""
                SELECT * FROM ticket_comments 
                WHERE ticket_id = %s AND is_internal = FALSE 
                ORDER BY created_at ASC
            """, (ticket_id,))
        
        comments = cursor.fetchall()
        conn.close()
        return comments
    
    def get_employee_context(self, employee_id: str, requester_role: str) -> Optional[Dict]:
        """Get limited employee info for support (no sensitive data)"""
        if requester_role not in ['admin', 'support', 'hr']:
            return None
        
        try:
            from hrms_agent.db import get_employee_by_id
            employee = get_employee_by_id(employee_id)
            
            if not employee:
                return None
            
            # Return only non-sensitive data
            context = {
                "employee_id": employee.get('employee_id'),
                "name": employee.get('name'),
                "email": employee.get('email'),
                "department": employee.get('department'),
                "title": employee.get('title'),
                "status": employee.get('status', 'active'),
                "phone": employee.get('phone')
            }
            
            # Support cannot see salary
            if requester_role in ['admin', 'hr']:
                context['salary'] = employee.get('salary')
            
            return context
        except Exception as e:
            return None
    
    def get_ticket_stats(self, user_id: str, user_role: str) -> Dict:
        """Get ticket statistics"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_role == 'employee':
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
                FROM support_tickets WHERE created_by = %s
            """, (user_id,))
        elif user_role == 'support':
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
                    SUM(CASE WHEN assigned_to = %s THEN 1 ELSE 0 END) as assigned_to_me
                FROM support_tickets
            """, (user_id,))
        else:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
                    SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
                FROM support_tickets
            """)
        
        stats = cursor.fetchone()
        conn.close()
        return stats or {}
