#!/usr/bin/env python3
"""
Enhanced AI Assistant for HRMS Portal
Provides natural language processing with HRMS-specific knowledge and general conversation
"""

import re
import json
import mysql.connector
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import random

class EnhancedHRMSAssistant:
    def __init__(self):
        self.conversation_context = {}
        self.db_config = {
            'host': 'localhost',
            'user': 'root',
            'password': 'Root@12345',
            'database': 'hrms_complete'
        }
        
        # Import comprehensive patterns
        from conversation_patterns import HRMS_PATTERNS, CONVERSATION_STARTERS, CONTEXTUAL_RESPONSES, SMART_SUGGESTIONS, FALLBACK_RESPONSES, MULTILINGUAL_PATTERNS
        
        self.hrms_patterns = HRMS_PATTERNS
        self.conversation_starters = CONVERSATION_STARTERS
        self.contextual_responses = CONTEXTUAL_RESPONSES
        self.smart_suggestions = SMART_SUGGESTIONS
        self.fallback_responses = FALLBACK_RESPONSES
        self.multilingual_patterns = MULTILINGUAL_PATTERNS
        
        # Legacy keyword mapping for backward compatibility
        self.hrms_keywords = {
            'employee': HRMS_PATTERNS['employee_management']['keywords'],
            'attendance': HRMS_PATTERNS['attendance_tracking']['keywords'],
            'leave': HRMS_PATTERNS['leave_management']['keywords'],
            'payroll': HRMS_PATTERNS['payroll_salary']['keywords'],
            'performance': HRMS_PATTERNS['performance_review']['keywords'],
            'training': HRMS_PATTERNS['training_development']['keywords'],
            'document': HRMS_PATTERNS['document_generation']['keywords'],
            'report': HRMS_PATTERNS['reports_analytics']['keywords'],
            'user_management': ['user', 'users', 'user management', 'manage users', 'user list', 'users list', 'show users', 'all users', 'accounts', 'user accounts'],
            'system': ['system', 'portal', 'dashboard', 'hrms', 'features', 'platform', 'application', 'interface', 'modules', 'sections']
        }
        
        # Response templates with enhanced variety
        self.responses = {
            'greeting': [
                "Hello! I'm your intelligent HRMS assistant. How can I help you today?",
                "Hi there! What can I assist you with in the HRMS portal?",
                "Good day! I'm here to help with any HR-related questions.",
                "Welcome! Ready to tackle some HR tasks together?",
                "Hey! Your HRMS assistant is here. What do you need help with?"
            ],
            'farewell': [
                "Goodbye! Feel free to ask if you need any help with HRMS.",
                "Take care! I'm always here for your HR assistance needs.",
                "See you later! Don't hesitate to reach out for HRMS support.",
                "Until next time! Happy to help whenever you need HR assistance.",
                "Bye for now! Your HRMS assistant is just a message away."
            ],
            'unknown': FALLBACK_RESPONSES
        }
    
    def get_db_connection(self):
        """Get database connection"""
        return mysql.connector.connect(**self.db_config)
    
    def classify_intent(self, message: str) -> Tuple[str, float]:
        """Enhanced intent classification with pattern matching"""
        message_lower = message.lower()
        
        # Check for greetings
        if any(greeting in message_lower for greeting in self.conversation_starters['greetings']):
            return 'greeting', 0.95
        
        # Check for farewells
        if any(farewell in message_lower for farewell in self.conversation_starters['farewells']):
            return 'farewell', 0.95
        
        # Check for help requests
        if any(help_word in message_lower for help_word in self.conversation_starters['help_requests']):
            return 'help', 0.9
        
        # Priority check for employee creation/addition
        if any(phrase in message_lower for phrase in ['create new employee', 'add new employee', 'create employee', 'add employee', 'new employee', 'register employee']):
            return 'employee_creation', 0.95
        
        # Priority check for payroll/salary slip generation
        if any(phrase in message_lower for phrase in ['generate salary slip', 'generate payslip', 'create salary slip', 'salary slip for']):
            return 'payroll', 0.95
        
        # Enhanced HRMS intent detection
        intent_scores = {}
        
        for category, patterns in self.hrms_patterns.items():
            score = 0
            total_weight = 0
            
            # Check exact phrase matches (highest weight)
            for phrase in patterns['phrases']:
                if phrase.lower() in message_lower:
                    score += 1.0
                    total_weight += 1.0
            
            # Check keyword matches (medium weight)
            for keyword in patterns['keywords']:
                if keyword.lower() in message_lower:
                    score += 0.6
                    total_weight += 0.6
            
            if total_weight > 0:
                intent_scores[category] = score / max(total_weight, 1)
        
        # Map categories to simple intents
        category_mapping = {
            'employee_management': 'employee',
            'attendance_tracking': 'attendance',
            'leave_management': 'leave',
            'payroll_salary': 'payroll',
            'performance_review': 'performance',
            'training_development': 'training',
            'document_generation': 'document',
            'reports_analytics': 'report',
            'user_management': 'user_management',
            'system_portal': 'system'
        }
        
        if intent_scores:
            best_category = max(intent_scores, key=intent_scores.get)
            best_intent = category_mapping.get(best_category, best_category)
            return best_intent, intent_scores[best_category]
        
        return 'unknown', 0.0
    
    def extract_entities(self, message: str) -> Dict:
        """Extract entities from message"""
        entities = {}
        
        # Extract employee ID patterns
        emp_pattern = r'\b(EMP\d+|emp\d+)\b'
        emp_matches = re.findall(emp_pattern, message, re.IGNORECASE)
        if emp_matches:
            entities['employee_id'] = emp_matches[0].upper()
        
        # Extract dates
        date_patterns = [
            r'\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b',
            r'\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b',
            r'\b(today|yesterday|tomorrow)\b'
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, message, re.IGNORECASE)
            if matches:
                entities['date'] = matches[0]
                break
        
        # Extract numbers
        number_pattern = r'\b(\d+)\b'
        numbers = re.findall(number_pattern, message)
        if numbers:
            entities['numbers'] = [int(n) for n in numbers]
        
        return entities
    
    def handle_employee_creation_query(self, message: str, entities: Dict, user_role: str, user_id: str) -> str:
        """Handle employee creation/addition queries"""
        if user_role not in ['admin', 'hr']:
            return "❌ **Access Denied**\n\n• Only HR and Admin users can create new employees\n• Please contact HR department for assistance"
        
        # Initialize employee creation context
        if user_id not in self.conversation_context:
            self.conversation_context[user_id] = {}
        
        self.conversation_context[user_id]['creating_employee'] = True
        self.conversation_context[user_id]['employee_data'] = {}
        self.conversation_context[user_id]['current_step'] = 'first_name'
        
        return "👥 **Let's Add a New Employee!**\n\n" \
               "I'll guide you through the process step by step.\n\n" \
               "📝 **Step 1 of 6**\n" \
               "What is the employee's **first name**?"
    
    def handle_employee_creation_step(self, message: str, user_id: str, user_role: str) -> str:
        """Handle step-by-step employee creation"""
        context = self.conversation_context[user_id]
        current_step = context['current_step']
        employee_data = context['employee_data']
        
        # Handle cancel
        if message.lower() in ['cancel', 'stop', 'exit', 'quit']:
            context['creating_employee'] = False
            return "❌ **Employee Creation Cancelled**\n\nYou can start again anytime by saying 'add new employee'"
        
        # Process current step
        if current_step == 'first_name':
            employee_data['first_name'] = message.strip().title()
            context['current_step'] = 'last_name'
            return f"✅ First Name: **{employee_data['first_name']}**\n\n📝 **Step 2 of 6**\nWhat is the employee's **last name**?"
        
        elif current_step == 'last_name':
            employee_data['last_name'] = message.strip().title()
            context['current_step'] = 'email'
            return f"✅ Last Name: **{employee_data['last_name']}**\n\n📝 **Step 3 of 6**\nWhat is the employee's **email address**?\n\n*Example: john.smith@company.com*"
        
        elif current_step == 'email':
            email = message.strip().lower()
            if '@' not in email or '.' not in email:
                return "❌ **Invalid Email**\n\nPlease provide a valid email address (e.g., john@company.com)"
            employee_data['email'] = email
            context['current_step'] = 'phone'
            return f"✅ Email: **{employee_data['email']}**\n\n📝 **Step 4 of 6**\nWhat is the employee's **phone number**?\n\n*Example: 9876543210*"
        
        elif current_step == 'phone':
            phone = re.sub(r'[^0-9]', '', message.strip())
            if len(phone) < 10:
                return "❌ **Invalid Phone Number**\n\nPlease provide a valid 10-digit phone number"
            employee_data['phone'] = phone
            context['current_step'] = 'department'
            return f"✅ Phone: **{employee_data['phone']}**\n\n📝 **Step 5 of 6**\nWhich **department** will the employee join?\n\n**Available Departments:**\n• Information Technology\n• Human Resources\n• Finance\n• Sales\n• Marketing\n• Operations"
        
        elif current_step == 'department':
            department = message.strip().title()
            employee_data['department'] = department
            context['current_step'] = 'title'
            return f"✅ Department: **{employee_data['department']}**\n\n📝 **Step 6 of 6**\nWhat is the employee's **job title/position**?\n\n*Example: Software Developer, HR Manager, etc.*"
        
        elif current_step == 'title':
            employee_data['title'] = message.strip().title()
            
            # Save to database
            result = self.save_employee_to_database(employee_data, user_id)
            
            # Clear context
            context['creating_employee'] = False
            context['employee_data'] = {}
            context['current_step'] = None
            
            return result
        
        return "Something went wrong. Please try again."
    
    def save_employee_to_database(self, employee_data: Dict, created_by: str) -> str:
        """Save new employee to database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Generate employee ID
            cursor.execute("SELECT employee_id FROM employees ORDER BY employee_id DESC LIMIT 1")
            last_emp = cursor.fetchone()
            
            if last_emp and last_emp['employee_id']:
                last_id = int(re.sub(r'[^0-9]', '', last_emp['employee_id']))
                new_id = f"EMP{str(last_id + 1).zfill(3)}"
            else:
                new_id = "EMP001"
            
            # Insert employee
            cursor.execute("""
                INSERT INTO employees 
                (employee_id, first_name, last_name, email, phone, department, title, status, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'Active', NOW())
            """, (
                new_id,
                employee_data['first_name'],
                employee_data['last_name'],
                employee_data['email'],
                employee_data['phone'],
                employee_data['department'],
                employee_data['title']
            ))
            
            # Create user account
            username = employee_data['email']
            default_password = 'Welcome@123'
            
            cursor.execute("""
                INSERT INTO users 
                (user_id, username, password, full_name, email, role, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, 'employee', 1, NOW())
            """, (
                new_id,
                username,
                default_password,
                f"{employee_data['first_name']} {employee_data['last_name']}",
                employee_data['email']
            ))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return f"✅ **Employee Created Successfully!**\n\n" \
                   f"• **Employee ID:** {new_id}\n" \
                   f"• **Name:** {employee_data['first_name']} {employee_data['last_name']}\n" \
                   f"• **Email:** {employee_data['email']}\n" \
                   f"• **Phone:** {employee_data['phone']}\n" \
                   f"• **Department:** {employee_data['department']}\n" \
                   f"• **Title:** {employee_data['title']}\n" \
                   f"• **Status:** Active\n\n" \
                   f"🔐 **Login Credentials:**\n" \
                   f"• **Username:** {username}\n" \
                   f"• **Password:** {default_password}\n\n" \
                   f"📧 Please share these credentials with the new employee securely!"
            
        except Exception as e:
            return f"❌ **Error Creating Employee**\n\n• Error: {str(e)}\n• Please try again or contact system administrator"
    
    def handle_employee_query(self, message: str, entities: Dict, user_role: str) -> str:
        """Handle employee-related queries"""
        conn = self.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Specific employee query
            if 'employee_id' in entities:
                emp_id = entities['employee_id']
                cursor.execute("""
                    SELECT e.*, ed.position, ed.current_salary, d.department_name
                    FROM employees e
                    LEFT JOIN employment_details ed ON e.employee_id = ed.employee_id
                    LEFT JOIN departments d ON e.department = d.department_id
                    WHERE LOWER(e.employee_id) = LOWER(%s)
                """, (emp_id,))
                
                employee = cursor.fetchone()
                if employee:
                    return f"👤 **Employee Details - {employee['employee_id']}**\n\n" \
                           f"• **Name:** {employee['first_name']} {employee['last_name']}\n" \
                           f"• **Department:** {employee.get('department', 'N/A')}\n" \
                           f"• **Position:** {employee.get('title', 'N/A')}\n" \
                           f"• **Email:** {employee.get('email', 'N/A')}\n" \
                           f"• **Phone:** {employee.get('phone', 'N/A')}\n" \
                           f"• **Status:** {employee.get('status', 'N/A')}\n" \
                           f"• **Joined:** {employee.get('created_at', 'N/A')}"
                else:
                    return f"❌ **Employee Not Found**\n\n• Employee ID {emp_id} does not exist in the system\n• Please check the ID and try again"
            
            # General employee queries
            elif any(word in message.lower() for word in ['count', 'total', 'how many']):
                cursor.execute("SELECT COUNT(*) as count FROM employees WHERE status = 'Active'")
                result = cursor.fetchone()
                return f"📊 **Employee Statistics**\n\n• **Total Active Employees:** {result['count']}\n• **Status:** Currently employed\n• **Database:** HRMS Complete"
            
            elif 'new' in message.lower() or 'recent' in message.lower():
                cursor.execute("""
                    SELECT employee_id, first_name, last_name, created_at
                    FROM employees 
                    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    ORDER BY created_at DESC LIMIT 5
                """)
                recent = cursor.fetchall()
                
                if recent:
                    response = "👥 **Recent Hires (Last 30 Days)**\n\n"
                    for emp in recent:
                        response += f"• **{emp['employee_id']}:** {emp['first_name']} {emp['last_name']} - Joined {emp['created_at']}\n"
                    return response
                else:
                    return "📋 **No Recent Hires**\n\n• No new employees hired in the last 30 days\n• Check with HR for upcoming recruitment plans"
            
            elif any(word in message.lower() for word in ['show', 'list', 'all', 'another', 'more', 'next', 'other', 'remaining']) and 'employee' in message.lower():
                # Check for specific range request like "show employees 11-20"
                range_pattern = r'employees?\s+(\d+)\s*-\s*(\d+)'
                range_match = re.search(range_pattern, message.lower())
                
                if range_match:
                    start_num = int(range_match.group(1))
                    end_num = int(range_match.group(2))
                    offset = start_num - 1  # Convert to 0-based offset
                    limit = end_num - start_num + 1
                    
                    cursor.execute(f"SELECT employee_id, first_name, last_name, department, email FROM employees WHERE status = 'Active' ORDER BY employee_id LIMIT {limit} OFFSET {offset}")
                    employees = cursor.fetchall()
                    
                    if employees:
                        response = f"👥 **Employees {start_num}-{min(start_num + len(employees) - 1, end_num)}**\n\n"
                        for emp in employees:
                            response += f"• **{emp['employee_id']}:** {emp['first_name']} {emp['last_name']} - {emp['department']}\n  📧 {emp['email']}\n"
                        
                        # Check if there are more employees
                        cursor.execute("SELECT COUNT(*) as total FROM employees WHERE status = 'Active'")
                        total = cursor.fetchone()['total']
                        
                        if end_num < total:
                            next_start = end_num + 1
                            next_end = min(end_num + 10, total)
                            response += f"\n**More Available:**\n• Say 'show employees {next_start}-{next_end}' for next batch\n• Total employees: {total}"
                        
                        return response
                    else:
                        return f"❌ **No Employees Found in Range {start_num}-{end_num}**\n\n• Range may be beyond available employees\n• Try 'show all employees' to see the full list"
                else:
                    # Default pagination - show first 10
                    cursor.execute("SELECT employee_id, first_name, last_name, department, email FROM employees WHERE status = 'Active' ORDER BY employee_id LIMIT 10")
                    employees = cursor.fetchall()
                    
                    if employees:
                        response = "👥 **All Employees (First 10)**\n\n"
                        for emp in employees:
                            response += f"• **{emp['employee_id']}:** {emp['first_name']} {emp['last_name']} - {emp['department']}\n  📧 {emp['email']}\n"
                        response += "\n**Need More?**\n• Say 'show employees 11-20' for next batch\n• Try 'list IT department employees' for specific department"
                        return response
                    else:
                        return "❌ **No Employees Found**\n\n• No active employees in the system\n• Contact administrator to add employees"
            
            elif 'department' in message.lower():
                cursor.execute("SELECT department, COUNT(*) as count FROM employees WHERE status = 'Active' GROUP BY department ORDER BY count DESC")
                departments = cursor.fetchall()
                
                if departments:
                    response = "🏢 **Employees by Department**\n\n"
                    for dept in departments:
                        response += f"• **{dept['department']}:** {dept['count']} employees\n"
                    return response
                else:
                    return "❌ **No Department Data**\n\n• No department information available\n• Please contact HR to update employee departments"
            
            elif any(word in message.lower() for word in ['employee', 'employees', 'staff', 'worker', 'personnel']):
                # If it's a general employee query, show all employees
                cursor.execute("SELECT employee_id, first_name, last_name, department, email FROM employees WHERE status = 'Active' ORDER BY employee_id LIMIT 10")
                employees = cursor.fetchall()
                
                if employees:
                    response = "👥 **All Employees (First 10)**\n\n"
                    for emp in employees:
                        response += f"• **{emp['employee_id']}:** {emp['first_name']} {emp['last_name']} - {emp['department']}\n  📧 {emp['email']}\n"
                    response += "\n**Need More?**\n• Say 'show employees 11-20' for next batch\n• Try 'list IT department employees' for specific department"
                    return response
                else:
                    return "❌ **No Employees Found**\n\n• No active employees in the system\n• Contact administrator to add employees"
            
            else:
                return "👥 **Employee Information Help**\n\n**Available Commands:**\n• **'Show all employees'** - View employee list\n• **'How many employees do we have?'** - Get employee count\n• **'Show recent hires'** - View new employees\n• **'List employees by department'** - Department-wise view\n• **'Employee EMP001'** - Specific employee details\n\n**Need Help?**\n• Just ask naturally about employees\n• I understand various question formats"
        
        finally:
            cursor.close()
            conn.close()
    
    def handle_attendance_query(self, message: str, entities: Dict, user_role: str) -> str:
        """Handle attendance-related queries"""
        conn = self.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Today's attendance
            if 'today' in message.lower():
                cursor.execute("""
                    SELECT COUNT(*) as present_count
                    FROM attendance 
                    WHERE DATE(check_in_time) = CURDATE() AND status = 'Present'
                """)
                present = cursor.fetchone()
                
                cursor.execute("SELECT COUNT(*) as total FROM employees WHERE status = 'Active'")
                total = cursor.fetchone()
                
                return f"📅 Today's Attendance:\n" \
                       f"Present: {present['present_count']}\n" \
                       f"Total Employees: {total['total']}\n" \
                       f"Attendance Rate: {(present['present_count']/total['total']*100):.1f}%"
            
            # Specific employee attendance
            elif 'employee_id' in entities:
                emp_id = entities['employee_id']
                cursor.execute("""
                    SELECT DATE(check_in_time) as date, check_in_time, check_out_time, status
                    FROM attendance 
                    WHERE employee_id = %s 
                    ORDER BY date DESC LIMIT 7
                """, (emp_id,))
                
                records = cursor.fetchall()
                if records:
                    response = f"📊 Recent attendance for {emp_id}:\n"
                    for record in records:
                        check_out = record['check_out_time'].strftime('%H:%M') if record['check_out_time'] else 'Not checked out'
                        response += f"• {record['date']}: {record['check_in_time'].strftime('%H:%M')} - {check_out} ({record['status']})\n"
                    return response
                else:
                    return f"📋 No attendance records found for {emp_id}."
            
            else:
                return "⏰ I can help with attendance queries. Try asking:\n" \
                       "• 'Show today's attendance'\n" \
                       "• 'Attendance for EMP001'\n" \
                       "• 'Who is late today?'\n" \
                       "• 'Monthly attendance report'"
        
        finally:
            cursor.close()
            conn.close()
    
    def handle_document_query(self, message: str, entities: Dict, user_role: str, user_id: str) -> str:
        """Handle document generation queries"""
        message_lower = message.lower()
        
        # Generate offer letter
        if any(phrase in message_lower for phrase in ['offer letter', 'appointment letter', 'job offer', 'generate offer']):
            if user_role not in ['hr', 'admin']:
                return "❌ **Access Denied**\n\n• Only HR and Admin users can generate offer letters\n• Please contact HR department for assistance"
            
            # Extract employee name from message
            employee_name = None
            if 'for' in message_lower:
                parts = message_lower.split('for', 1)
                if len(parts) > 1:
                    employee_name = parts[1].strip().title()
            elif 'harshit' in message_lower:
                employee_name = 'Harshit'
            
            if not employee_name:
                return "📄 **Generate Offer Letter**\n\n**Please specify employee name:**\n\n**Example:** 'Generate offer letter for Harshit'\n\n**Available Employees:**\n• Harshit Joshi\n• Rajesh Kumar\n• Priya Sharma\n• Amit Shah\n• Sneha Patel"
            
            try:
                from document_generator import DocumentGenerator
                from datetime import datetime, timedelta
                import random
                
                doc_gen = DocumentGenerator()
                
                # Generate unique employee ID for new hire
                new_id = f"NEW{random.randint(100, 999)}"
                
                offer_data = {
                    'candidate_name': employee_name,
                    'position': 'HR Executive',
                    'department': 'Human Resources',
                    'salary': '₹4,50,000 per annum',
                    'joining_date': (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d'),
                    'employee_id': new_id
                }
                
                filename = doc_gen.generate_offer_letter(offer_data)
                
                return f"✅ **Offer Letter Generated Successfully!**\n\n" \
                       f"• **Candidate:** {offer_data['candidate_name']}\n" \
                       f"• **Position:** {offer_data['position']}\n" \
                       f"• **Department:** {offer_data['department']}\n" \
                       f"• **Salary:** {offer_data['salary']}\n" \
                       f"• **Joining Date:** {offer_data['joining_date']}\n" \
                       f"• **Document:** {filename}\n\n" \
                       f"📄 **Download:** [Click here to download]({filename})\n" \
                       f"🔗 **Direct Link:** http://localhost:8002/files/{filename}"
                
            except Exception as e:
                return f"❌ **Error Generating Offer Letter**\n\n• Error: {str(e)}\n• Please try again or contact system administrator"
        
        # Generate experience certificate
        elif any(phrase in message_lower for phrase in ['experience certificate', 'experience letter', 'service certificate']):
            if user_role not in ['hr', 'admin']:
                return "❌ **Access Denied**\n\n• Only HR and Admin users can generate experience certificates\n• Please contact HR department for assistance"
            
            # Extract employee name from message
            employee_name = None
            if 'for' in message_lower:
                parts = message_lower.split('for', 1)
                if len(parts) > 1:
                    employee_name = parts[1].strip().title()
            elif 'harshit' in message_lower:
                employee_name = 'Harshit Joshi'
            
            if not employee_name:
                return "📄 **Generate Experience Certificate**\n\n**Please specify employee name:**\n\n**Example:** 'Experience certificate for Harshit'\n\n**Available Employees:**\n• Harshit Joshi\n• Rajesh Kumar\n• Priya Sharma\n• Amit Shah\n• Sneha Patel"
            
            try:
                from document_generator import DocumentGenerator
                doc_gen = DocumentGenerator()
                
                # Find employee in database
                conn = self.get_db_connection()
                cursor = conn.cursor(dictionary=True)
                try:
                    cursor.execute("SELECT * FROM employees WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE %s LIMIT 1", 
                                 (f"%{employee_name.lower()}%",))
                    employee = cursor.fetchone()
                    conn.close()
                    
                    if employee:
                        emp_data = {
                            'employee_name': f"{employee['first_name']} {employee['last_name']}".strip(),
                            'employee_id': employee['employee_id'],
                            'position': employee.get('title', 'Employee'),
                            'department': employee.get('department', 'General'),
                            'join_date': employee.get('created_at', '2023-01-01'),
                            'end_date': 'Present'
                        }
                    else:
                        # Use provided name with defaults
                        emp_data = {
                            'employee_name': employee_name,
                            'employee_id': 'EMP001',
                            'position': 'HR Executive',
                            'department': 'Human Resources',
                            'join_date': '2022-01-15',
                            'end_date': 'Present'
                        }
                except Exception as e:
                    conn.close()
                    # Use defaults if database query fails
                    emp_data = {
                        'employee_name': employee_name,
                        'employee_id': 'EMP001',
                        'position': 'HR Executive',
                        'department': 'Human Resources',
                        'join_date': '2022-01-15',
                        'end_date': 'Present'
                    }
                
                filename = doc_gen.generate_experience_certificate(emp_data)
                
                return f"✅ **Experience Certificate Generated Successfully!**\n\n" \
                       f"• **Employee:** {emp_data['employee_name']} ({emp_data['employee_id']})\n" \
                       f"• **Position:** {emp_data['position']}\n" \
                       f"• **Department:** {emp_data['department']}\n" \
                       f"• **Service Period:** {emp_data['join_date']} to {emp_data['end_date']}\n" \
                       f"• **Document:** {filename}\n\n" \
                       f"📄 **Download:** [Click here to download]({filename})\n" \
                       f"🔗 **Direct Link:** http://localhost:8002/files/{filename}"
                
            except Exception as e:
                return f"❌ **Error Generating Certificate**\n\n• Error: {str(e)}\n• Please try again or contact system administrator"
        
        # General document help
        else:
            if user_role in ['hr', 'admin']:
                return "📄 **Document Generation Services:**\n\n" \
                       "• **Offer Letters** - Generate job offer letters\n" \
                       "• **Experience Certificates** - Create service certificates\n" \
                       "• **Salary Certificates** - Generate salary verification\n" \
                       "• **Employment Letters** - Various HR documents\n\n" \
                       "**Try asking:**\n" \
                       "• 'Generate offer letter for Harshit'\n" \
                       "• 'Create experience certificate for Rajesh'\n" \
                       "• 'Generate salary certificate for Priya'\n\n" \
                       "**All documents are automatically saved and can be downloaded immediately!**"
            else:
                return "📄 **Document Services Available:**\n\n" \
                       "• **Salary Slips** - Generate your pay slips\n" \
                       "• **Tax Documents** - Download tax certificates\n" \
                       "• **Personal Certificates** - Request from HR\n\n" \
                       "**For HR Documents:**\n" \
                       "• Contact HR department for offer letters\n" \
                       "• Request experience certificates from HR"
    
    def handle_payroll_query(self, message: str, entities: Dict, user_role: str, user_id: str) -> str:
        """Handle payroll and salary related queries"""
        message_lower = message.lower()
        
        # Role-based payroll handling
        if user_role == 'employee':
            # Employees can only download their own salary slips
            if any(phrase in message_lower for phrase in ['salary slip', 'pay slip', 'payslip', 'download salary', 'my salary']):
                try:
                    from complete_hrms_operations import complete_hrms_db
                    from datetime import datetime
                    import os
                    
                    # Get employee details
                    employees = complete_hrms_db.get_all_employees()
                    employee = None
                    for emp in employees:
                        if emp.get('employee_id') == user_id:
                            employee = emp
                            break
                    
                    if not employee:
                        return "❌ **Employee Not Found**\n\n• Unable to find your employee record\n• Please contact HR for assistance"
                    
                    # Create salary slip document
                    from document_generator import DocumentGenerator
                    doc_gen = DocumentGenerator()
                    
                    salary_data = {
                        'employee_name': employee.get('full_name', 'N/A'),
                        'employee_id': user_id,
                        'department': employee.get('department', 'General'),
                        'position': employee.get('position', 'Employee'),
                        'month_year': datetime.now().strftime('%B %Y'),
                        'basic_salary': 50000,
                        'hra': 15000,
                        'transport': 5000,
                        'medical': 3000,
                        'gross_salary': 73000,
                        'pf_deduction': 6000,
                        'tax_deduction': 7300,
                        'total_deductions': 13300,
                        'net_salary': 59700
                    }
                    
                    filename = doc_gen.generate_salary_slip(salary_data)
                    
                    return f"✅ **Salary Slip Downloaded Successfully!**\n\n" \
                           f"• **Employee:** {salary_data['employee_name']} ({user_id})\n" \
                           f"• **Period:** {salary_data['month_year']}\n" \
                           f"• **Gross Salary:** ₹{salary_data['gross_salary']:,}\n" \
                           f"• **Net Salary:** ₹{salary_data['net_salary']:,}\n" \
                           f"• **Document:** {filename}\n\n" \
                           f"📄 **Download Link:** <a href='http://localhost:8002/files/{filename}' target='_blank'>Download Salary Slip</a>"
                    
                except Exception as e:
                    return f"❌ **Error Downloading Salary Slip**\n\n• Error: {str(e)}\n• Please try again or contact HR"
            
            else:
                return "💰 **Employee Payroll Services:**\n\n" \
                       "• **Download Salary Slip** - Get your monthly pay slip\n" \
                       "• **View Salary Details** - Check your compensation breakdown\n" \
                       "• **Tax Information** - View deductions and TDS\n" \
                       "• **Bonus Information** - Annual and performance bonuses\n\n" \
                       "**Try asking:**\n" \
                       "• 'Download my salary slip'\n" \
                       "• 'Show my salary details'\n" \
                       "• 'What are my deductions?'"
        
        elif user_role == 'hr':
            # HR can generate salary slips for employees
            if any(phrase in message_lower for phrase in ['generate salary slip', 'create salary slip', 'salary slip', 'payslip', 'pay slip']):
                # Check for bulk generation
                if any(phrase in message_lower for phrase in ['all employees', 'multiple slips', 'bulk', 'everyone']):
                    return self.generate_bulk_payslips(user_role)
                
                # Check if specific employee mentioned
                elif any(word in message_lower for word in ['for', 'emp']):
                    # Extract employee info from message
                    import re
                    emp_pattern = r'\b(emp\d+)\b'
                    emp_match = re.search(emp_pattern, message_lower)
                    
                    if emp_match:
                        emp_id = emp_match.group(1).upper()
                        return self.generate_payslip_for_employee(emp_id, user_role)
                    else:
                        # Ask for employee ID with actual employee examples
                        return "💰 **HR Payslip Generation**\n\n" \
                               "• **Which employee** do you want to generate a payslip for?\n" \
                               "• **Format:** EMP001, EMP002, etc.\n" \
                               "• **Example:** 'Generate salary slip for EMP001'\n\n" \
                               "**Available Employees:**\n" \
                               "• EMP001 - Harshit\n" \
                               "• EMP002 - Rajesh Kumar\n" \
                               "• EMP003 - Priya Sharma\n" \
                               "• EMP004 - Amit Shah\n" \
                               "• EMP005 - Sneha Patel"
                else:
                    return "💰 **HR Payroll Generation**\n\n" \
                           "• **Generate Employee Salary Slips** - Create pay slips for any employee\n" \
                           "• **Bulk Salary Processing** - Generate multiple slips\n" \
                           "• **Salary Adjustments** - Modify employee compensation\n" \
                           "• **Tax Calculations** - Handle TDS and deductions\n\n" \
                           "**Try asking:**\n" \
                           "• 'Generate salary slip for EMP001'\n" \
                           "• 'Generate salary slip for all employees'\n" \
                           "• 'Process monthly payroll'"
            
            else:
                return "💰 **HR Payroll Management:**\n\n" \
                       "• **Generate Salary Slips** - Create pay slips for employees\n" \
                       "• **Payroll Processing** - Handle monthly salary processing\n" \
                       "• **Salary Reports** - Generate compensation reports\n" \
                       "• **Tax Management** - Handle deductions and compliance\n\n" \
                       "**Available Commands:**\n" \
                       "• 'Generate salary slip for [employee]'\n" \
                       "• 'Generate salary slip for all employees'\n" \
                       "• 'Create salary report'"
        
        elif user_role == 'admin':
            # Admin can download all user data and manage payroll
            if any(phrase in message_lower for phrase in ['download user data', 'export user data', 'all user data']):
                return "👑 **Admin Data Export**\n\n" \
                       "• **All User Data** - Export complete user database\n" \
                       "• **Employee Records** - Download all employee information\n" \
                       "• **Payroll Data** - Export salary and compensation data\n" \
                       "• **System Reports** - Generate comprehensive reports\n\n" \
                       "**Available Exports:**\n" \
                       "• 'Export all employee data'\n" \
                       "• 'Download payroll database'\n" \
                       "• 'Generate system report'"
            
            else:
                return "👑 **Admin Payroll Control:**\n\n" \
                       "• **System-wide Payroll** - Manage all employee compensation\n" \
                       "• **Data Export** - Download complete user and payroll data\n" \
                       "• **Bulk Operations** - Process multiple employees at once\n" \
                       "• **Compliance Reports** - Generate regulatory reports\n\n" \
                       "**Admin Commands:**\n" \
                       "• 'Download all user data'\n" \
                       "• 'Export payroll database'\n" \
                       "• 'Generate compliance report'"
        
        else:
            return "❌ **Access Denied**\n\n• Invalid user role\n• Please contact system administrator"
    
    def generate_payslip_for_employee(self, emp_id: str, user_role: str) -> str:
        """Generate payslip for specific employee (HR/Admin only)"""
        try:
            # Get employee from MySQL
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as full_name, 
                       e.department, e.title, ed.current_salary
                FROM employees e
                LEFT JOIN employment_details ed ON e.employee_id = ed.employee_id
                WHERE LOWER(e.employee_id) = LOWER(%s)
            """, (emp_id,))
            employee = cursor.fetchone()
            conn.close()
            
            if not employee:
                return f"❌ **Employee Not Found**\n\n• Employee ID {emp_id} does not exist\n• Please check the ID and try again\n• Use format: EMP001, EMP002, etc."
            
            from datetime import datetime
            # Create salary slip document
            from document_generator import DocumentGenerator
            doc_gen = DocumentGenerator()
            
            # Calculate CTC-based salary
            ctc = employee.get('salary', 750000) or 750000
            basic_salary = int(ctc * 0.4)  # 40% of CTC
            hra = int(ctc * 0.2)  # 20% of CTC
            transport = int(ctc * 0.1)  # 10% of CTC
            medical = int(ctc * 0.05)  # 5% of CTC
            gross_salary = basic_salary + hra + transport + medical
            
            pf_deduction = int(basic_salary * 0.12)  # 12% of basic
            tax_deduction = int(ctc * 0.1)  # 10% tax
            total_deductions = pf_deduction + tax_deduction
            net_salary = gross_salary - total_deductions
            
            salary_data = {
                'employee_name': employee.get('full_name', 'N/A'),
                'employee_id': employee.get('employee_id', emp_id),
                'department': employee.get('department', 'General'),
                'position': employee.get('title', 'Employee'),
                'month_year': datetime.now().strftime('%B %Y'),
                'basic_salary': basic_salary,
                'hra': hra,
                'transport': transport,
                'medical': medical,
                'gross_salary': gross_salary,
                'pf_deduction': pf_deduction,
                'tax_deduction': tax_deduction,
                'total_deductions': total_deductions,
                'net_salary': net_salary
            }
            
            filename = doc_gen.generate_salary_slip(salary_data)
            
            return f"✅ **Salary Slip Generated Successfully!**\n\n" \
                   f"• **Employee:** {salary_data['employee_name']} ({employee.get('employee_id', emp_id)})\n" \
                   f"• **Period:** {salary_data['month_year']}\n" \
                   f"• **CTC:** ₹{ctc:,} per annum\n" \
                   f"• **Gross Salary:** ₹{salary_data['gross_salary']:,}\n" \
                   f"• **Net Salary:** ₹{salary_data['net_salary']:,}\n" \
                   f"• **Document:** {filename}\n\n" \
                   f"📄 **Download Link:** <a href='http://localhost:8002/files/{filename}' target='_blank'>Download Salary Slip</a>"
            
        except Exception as e:
            return f"❌ **Error Generating Salary Slip**\n\n• Error: {str(e)}\n• Please try again or contact system administrator"
    
    def generate_bulk_payslips(self, user_role: str) -> str:
        """Generate payslips for all employees (HR/Admin only)"""
        try:
            from complete_hrms_operations import complete_hrms_db
            from datetime import datetime
            import zipfile
            import os
            from pathlib import Path
            
            # Get all employees
            employees = complete_hrms_db.get_all_employees()
            
            if not employees:
                return "❌ **No Employees Found**\n\n• No employees in the system\n• Add employees first before generating payslips"
            
            # Create bulk payslips
            from document_generator import DocumentGenerator
            doc_gen = DocumentGenerator()
            
            generated_files = []
            success_count = 0
            
            for employee in employees:  # Generate for ALL employees
                try:
                    emp_id = employee.get('employee_id')
                    ctc = employee.get('salary', 750000)
                    
                    # Calculate CTC-based salary
                    basic_salary = int(ctc * 0.4)
                    hra = int(ctc * 0.2)
                    transport = int(ctc * 0.1)
                    medical = int(ctc * 0.05)
                    gross_salary = basic_salary + hra + transport + medical
                    
                    pf_deduction = int(basic_salary * 0.12)
                    tax_deduction = int(ctc * 0.1)
                    total_deductions = pf_deduction + tax_deduction
                    net_salary = gross_salary - total_deductions
                    
                    salary_data = {
                        'employee_name': employee.get('full_name', 'N/A'),
                        'employee_id': emp_id,
                        'department': employee.get('department', 'General'),
                        'position': employee.get('position', 'Employee'),
                        'month_year': datetime.now().strftime('%B %Y'),
                        'basic_salary': basic_salary,
                        'hra': hra,
                        'transport': transport,
                        'medical': medical,
                        'gross_salary': gross_salary,
                        'pf_deduction': pf_deduction,
                        'tax_deduction': tax_deduction,
                        'total_deductions': total_deductions,
                        'net_salary': net_salary
                    }
                    
                    filename = doc_gen.generate_salary_slip(salary_data)
                    generated_files.append(filename)
                    success_count += 1
                    
                except Exception as e:
                    print(f"Error generating payslip for {emp_id}: {e}")
                    continue
            
            # Create ZIP file with all payslips
            zip_filename = f"bulk_payslips_{datetime.now().strftime('%Y%m')}.zip"
            zip_path = Path("generated_docs") / zip_filename
            
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for filename in generated_files:
                    file_path = Path("generated_docs") / filename
                    if file_path.exists():
                        zipf.write(file_path, filename)
            
            return f"✅ **Bulk Payslips Generated Successfully!**\n\n" \
                   f"• **Total Employees:** {len(employees)}\n" \
                   f"• **Payslips Generated:** {success_count}\n" \
                   f"• **Period:** {datetime.now().strftime('%B %Y')}\n" \
                   f"• **ZIP File:** {zip_filename}\n\n" \
                   f"📄 **Download All:** <a href='http://localhost:8002/files/{zip_filename}' target='_blank'>Download ZIP File</a>\n\n" \
                   f"**Individual Files:**\n" + "\n".join([f"• <a href='http://localhost:8002/files/{f}' target='_blank'>{f}</a>" for f in generated_files[:5]]) + \
                   (f"\n• ... and {len(generated_files)-5} more files" if len(generated_files) > 5 else "")
            
        except Exception as e:
            return f"❌ **Error Generating Bulk Payslips**\n\n• Error: {str(e)}\n• Please try again or contact system administrator"
    
    def handle_leave_status_query(self, user_id: str, user_role: str) -> str:
        """Handle leave status checking queries"""
        conn = self.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # For HR/Admin, show all leave requests
            if user_role in ['hr', 'admin']:
                cursor.execute("""
                    SELECT lr.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
                    FROM leave_requests lr
                    LEFT JOIN employees e ON lr.employee_id = e.employee_id
                    ORDER BY lr.created_at DESC
                    LIMIT 50
                """)
            else:
                # For employees, show only their requests
                cursor.execute("""
                    SELECT lr.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
                    FROM leave_requests lr
                    LEFT JOIN employees e ON lr.employee_id = e.employee_id
                    WHERE UPPER(lr.employee_id) = UPPER(%s)
                    ORDER BY lr.created_at DESC
                    LIMIT 10
                """, (user_id,))
            
            leave_requests = cursor.fetchall()
            
            if not leave_requests:
                if user_role in ['hr', 'admin']:
                    return "📋 **No Leave Applications Found**\n\n• No leave requests in the system\n• Employees can apply for leave through the portal\n• All requests will appear here for approval"
                else:
                    return "📋 **No Leave Applications Found**\n\n• You haven't applied for any leave yet\n• Say 'apply for leave' to submit a new request\n• Contact HR if you need assistance"
            
            if user_role in ['hr', 'admin']:
                response = f"🏖️ **Leave Applications Status**\n\n"
            else:
                response = f"🏖️ **Your Leave Applications Status**\n\n"
            
            for leave in leave_requests:
                status_icon = {
                    'Pending': '⏳',
                    'Approved': '✅', 
                    'Rejected': '❌'
                }.get(leave['status'], '❓')
                
                leave_type = leave.get('leave_type') or 'Pending Classification'
                emp_name = leave.get('employee_name') or leave.get('employee_id')
                
                response += f"{status_icon} **{leave_type}** - {leave['status']}\n"
                if user_role in ['hr', 'admin']:
                    response += f"   👤 Employee: {emp_name}\n"
                response += f"   📅 {leave['start_date']} to {leave['end_date']}\n"
                response += f"   📝 {leave['reason']}\n"
                
                if leave['status'] == 'Approved' and leave.get('approved_by'):
                    response += f"   ✓ Approved by: {leave['approved_by']}\n"
                elif leave['status'] == 'Rejected' and leave.get('approved_by'):
                    response += f"   ✗ Rejected by: {leave['approved_by']}\n"
                
                if leave.get('approval_comments'):
                    response += f"   💬 Comments: {leave['approval_comments']}\n"
                
                response += "\n"
            
            # Add summary
            pending_count = sum(1 for leave in leave_requests if leave['status'] == 'Pending')
            approved_count = sum(1 for leave in leave_requests if leave['status'] == 'Approved')
            rejected_count = sum(1 for leave in leave_requests if leave['status'] == 'Rejected')
            
            response += f"📊 **Summary:**\n"
            response += f"• Pending: {pending_count} | Approved: {approved_count} | Rejected: {rejected_count}\n\n"
            
            if user_role in ['hr', 'admin']:
                response += f"**Actions:**\n• Click on any request to approve/reject\n• Use the Leave Management panel for bulk actions"
            else:
                response += f"**Need Help?**\n• Say 'apply for leave' for new request\n• Contact HR for leave policy questions"
            
            return response
            
        except Exception as e:
            return f"❌ **Error Retrieving Leave Status**\n\n• Error: {str(e)}\n• Please try again or contact HR"
        
        finally:
            cursor.close()
            conn.close()
    
    def handle_leave_query(self, message: str, entities: Dict, user_role: str) -> str:
        """Handle leave-related queries"""
        # Check for leave application requests
        if any(phrase in message.lower() for phrase in ['apply for leave', 'apply leave', 'request leave', 'leave application']):
            return "LEAVE_APPLICATION_TRIGGER"  # Special signal for main chat handler
        
        # Check for leave approval/rejection (HR/Admin only)
        if user_role in ['hr', 'admin']:
            # Approve leave pattern: "approve leave id 5 as sick leave"
            approve_pattern = r'approve\s+leave\s+id\s+(\d+)\s+as\s+(.+?)(?:\s|$)'
            approve_match = re.search(approve_pattern, message.lower())
            if approve_match:
                leave_id = approve_match.group(1)
                leave_type = approve_match.group(2).title()
                return self.approve_leave_request(leave_id, leave_type, 'Approved', user_id)
            
            # Reject leave pattern: "reject leave id 5"
            reject_pattern = r'reject\s+leave\s+id\s+(\d+)'
            reject_match = re.search(reject_pattern, message.lower())
            if reject_match:
                leave_id = reject_match.group(1)
                return self.approve_leave_request(leave_id, '', 'Rejected', user_id)
        
        conn = self.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Pending leave requests based on user role
            if 'pending' in message.lower():
                if user_role == 'admin':
                    # Admin sees HR leave requests
                    cursor.execute("""
                        SELECT lr.*, e.first_name, e.last_name, u.role
                        FROM leave_requests lr
                        JOIN employees e ON lr.employee_id = e.employee_id
                        JOIN users u ON lr.employee_id = u.user_id
                        WHERE lr.status = 'Pending' AND u.role = 'hr'
                        ORDER BY lr.created_at ASC
                    """)
                elif user_role == 'hr':
                    # HR sees employee leave requests
                    cursor.execute("""
                        SELECT lr.*, e.first_name, e.last_name, u.role
                        FROM leave_requests lr
                        JOIN employees e ON lr.employee_id = e.employee_id
                        JOIN users u ON lr.employee_id = u.user_id
                        WHERE lr.status = 'Pending' AND u.role = 'employee'
                        ORDER BY lr.created_at ASC
                    """)
                else:
                    # Employees see their own requests
                    cursor.execute("""
                        SELECT lr.*, e.first_name, e.last_name
                        FROM leave_requests lr
                        JOIN employees e ON lr.employee_id = e.employee_id
                        WHERE lr.status = 'Pending' AND lr.employee_id = %s
                        ORDER BY lr.created_at DESC
                    """, (user_id,))
                
                pending = cursor.fetchall()
                if pending:
                    response = f"📋 Pending leave requests for {user_role}:\n"
                    for leave in pending:
                        leave_type_display = f" - {leave.get('leave_type', 'Pending Classification')}" if leave.get('leave_type') else " - Pending Classification"
                        response += f"• ID {leave['id']}: {leave['first_name']} {leave['last_name']}{leave_type_display} ({leave['start_date']} to {leave['end_date']})\n"
                        response += f"  Reason: {leave['reason']}\n"
                    
                    if user_role in ['hr', 'admin']:
                        response += "\nTo approve: 'Approve leave ID [number] as [leave type]'\n"
                        response += "To reject: 'Reject leave ID [number]'"
                    return response
                else:
                    return "✅ No pending leave requests."
            
            # Employee specific leave
            elif 'employee_id' in entities:
                emp_id = entities['employee_id']
                cursor.execute("""
                    SELECT start_date, end_date, status, reason, leave_type
                    FROM leave_requests 
                    WHERE employee_id = %s 
                    ORDER BY start_date DESC LIMIT 5
                """, (emp_id,))
                
                leaves = cursor.fetchall()
                if leaves:
                    response = f"🏖️ Recent leave requests for {emp_id}:\n"
                    for leave in leaves:
                        leave_type_display = leave.get('leave_type') or 'Pending Classification'
                        response += f"• {leave_type_display}: {leave['start_date']} to {leave['end_date']} ({leave['status']})\n"
                    return response
                else:
                    return f"📋 No leave records found for {emp_id}."
            
            else:
                help_text = "🏖️ I can help with leave management. Try asking:\n" \
                           "• 'Apply for leave'\n" \
                           "• 'Show pending leave requests'\n" \
                           "• 'Leave history for EMP001'\n" \
                           "• 'Who is on leave today?'"
                
                if user_role in ['hr', 'admin']:
                    help_text += "\n• 'Approve leave ID [number] as [leave type]'\n" \
                                "• 'Reject leave ID [number]'"
                
                return help_text
        
        finally:
            cursor.close()
            conn.close()
    
    def approve_leave_request(self, leave_id: str, leave_type: str, status: str, approver_id: str) -> str:
        """Approve or reject leave request"""
        conn = self.get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # First get the leave request details
            cursor.execute("""
                SELECT lr.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
                FROM leave_requests lr
                JOIN employees e ON lr.employee_id = e.employee_id
                WHERE lr.id = %s
            """, (leave_id,))
            
            leave_request = cursor.fetchone()
            if not leave_request:
                return f"❌ Leave request ID {leave_id} not found."
            
            if leave_request['status'] != 'Pending':
                return f"❌ Leave request ID {leave_id} has already been {leave_request['status'].lower()}."
            
            # Update the leave request
            cursor.execute("""
                UPDATE leave_requests 
                SET leave_type = %s, status = %s, approved_by = %s, approval_date = NOW()
                WHERE id = %s
            """, (leave_type if status == 'Approved' else None, status, approver_id, leave_id))
            
            conn.commit()
            
            if status == 'Approved':
                return f"✅ **Leave Request Approved!**\n\n" \
                       f"• **Employee:** {leave_request['employee_name']}\n" \
                       f"• **Leave Type:** {leave_type}\n" \
                       f"• **Period:** {leave_request['start_date']} to {leave_request['end_date']}\n" \
                       f"• **Reason:** {leave_request['reason']}\n" \
                       f"• **Approved by:** {approver_id}"
            else:
                return f"❌ **Leave Request Rejected**\n\n" \
                       f"• **Employee:** {leave_request['employee_name']}\n" \
                       f"• **Period:** {leave_request['start_date']} to {leave_request['end_date']}\n" \
                       f"• **Reason:** {leave_request['reason']}\n" \
                       f"• **Rejected by:** {approver_id}"
        
        except Exception as e:
            return f"❌ Error processing leave request: {str(e)}"
        
        finally:
            cursor.close()
            conn.close()
    
    def handle_general_conversation(self, message: str) -> str:
        """Enhanced general conversation with contextual responses"""
        message_lower = message.lower()
        
        # Weather or time queries
        if any(word in message_lower for word in ['weather', 'time', 'date']):
            current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            return f"🕐 Current date and time: {current_time}\n" \
                   "For weather information, please check your local weather service. ☀️"
        
        # Enhanced help queries
        elif any(word in message_lower for word in ['help', 'what can you do', 'features', 'capabilities']):
            return "🤖 **I'm your intelligent HRMS Assistant!** Here's what I can help you with:\n\n" \
                   "👥 **Employee Management**\n" \
                   "   • View/search employee profiles\n" \
                   "   • Add new employees (HR/Admin)\n" \
                   "   • Update employee details\n" \
                   "   • Employee directory and contacts\n\n" \
                   "⏰ **Attendance & Time Tracking**\n" \
                   "   • Check daily attendance\n" \
                   "   • View attendance reports\n" \
                   "   • Track late arrivals/early departures\n" \
                   "   • Biometric integration support\n\n" \
                   "🏖️ **Leave Management**\n" \
                   "   • Apply for various types of leave\n" \
                   "   • Check leave balances\n" \
                   "   • Approve/reject leave requests\n" \
                   "   • View leave history and policies\n\n" \
                   "💰 **Payroll & Compensation**\n" \
                   "   • View salary details\n" \
                   "   • Generate pay slips\n" \
                   "   • Tax calculations and deductions\n" \
                   "   • Bonus and incentive tracking\n\n" \
                   "📊 **Performance & Analytics**\n" \
                   "   • Performance reviews and ratings\n" \
                   "   • Goal setting and tracking\n" \
                   "   • Department-wise analytics\n" \
                   "   • Trend analysis and insights\n\n" \
                   "📄 **Document Generation**\n" \
                   "   • Experience certificates\n" \
                   "   • Salary certificates\n" \
                   "   • Employment letters\n" \
                   "   • Custom HR documents\n\n" \
                   "💬 **Natural Language Support**\n" \
                   "Just ask me naturally! Try phrases like:\n" \
                   "• 'Show today's attendance'\n" \
                   "• 'How many employees are in IT?'\n" \
                   "• 'Generate monthly report'\n" \
                   "• 'Apply for sick leave'\n"
        
        # Compliments or thanks with variety
        elif any(word in message_lower for word in ['thank', 'thanks', 'good', 'great', 'awesome', 'excellent', 'amazing']):
            responses = [
                "You're absolutely welcome! Happy to help with your HRMS needs! 😊✨",
                "Glad I could assist! I'm always here for your HR questions. 🤝",
                "Thank you for the kind words! Ready to help with anything else? 🚀",
                "Awesome! I love helping with HRMS tasks. What's next? 💼",
                "You're too kind! Let me know if you need more HR assistance. 🌟"
            ]
            return random.choice(responses)
        
        # Enhanced problem handling
        elif any(word in message_lower for word in ['problem', 'issue', 'error', 'not working', 'broken', 'bug']):
            return "😔 I'm sorry you're experiencing issues! Let me help troubleshoot:\n\n" \
                   "🔍 **Common Solutions:**\n" \
                   "• Try refreshing the page\n" \
                   "• Check your internet connection\n" \
                   "• Clear browser cache\n" \
                   "• Verify your login credentials\n\n" \
                   "📝 **For specific issues, tell me:**\n" \
                   "• What were you trying to do?\n" \
                   "• What error message did you see?\n" \
                   "• Which section of HRMS?\n\n" \
                   "I'll guide you to the right solution! 🛠️"
        
        # Personal questions with personality
        elif any(phrase in message_lower for phrase in ['who are you', 'what are you', 'your name', 'about you']):
            return "🤖 **Hi! I'm your intelligent HRMS Assistant!** \n\n" \
                   "🧠 **What makes me special:**\n" \
                   "• I understand natural language (talk to me normally!)\n" \
                   "• I have deep knowledge of HR processes\n" \
                   "• I can access real-time employee data\n" \
                   "• I learn from our conversations\n" \
                   "• I support multiple languages\n\n" \
                   "💼 **My mission:** Make HR management effortless and efficient for everyone!\n" \
                   "🎯 **My goal:** Be your trusted HR companion, available 24/7!\n\n" \
                   "What would you like to explore in the HRMS system? 🚀"
        
        # Casual conversation
        elif any(word in message_lower for word in ['how are you', 'how do you do', 'whats up']):
            return "I'm doing great, thank you for asking! 😊 Ready to help with all your HRMS needs. " \
                   "How are you doing today? Anything I can assist you with?"
        
        # Multilingual detection
        elif any(word in message_lower for word in ['namaste', 'namaskar', 'kem cho']):
            return "🙏 Namaste! I can help you in English, Hindi, and Gujarati. " \
                   "HRMS સિસ્ટમ માં તમને કેવી મદદ જોઈએ? (How can I help you with the HRMS system?)"
        
        else:
            return random.choice(self.fallback_responses)
    
    def process_message(self, message: str, user_role: str = 'employee', user_id: str = '') -> str:
        """Main message processing function"""
        if not message.strip():
            return "Please ask me something! I'm here to help with HRMS tasks."
        
        # Check for leave application first (not for admin users)
        message_lower = message.lower().strip()
        if any(phrase in message_lower for phrase in ['apply for leave', 'apply leave', 'request leave', 'leave application']):
            if user_role == 'admin':
                return "❌ **Access Restricted**\n\n• Administrators cannot apply for leave\n• Only HR and Employee users can submit leave requests\n• Use the admin panel to manage leave requests"
            return "LEAVE_APPLICATION_TRIGGER"
        
        # Check for leave status queries (more specific patterns first)
        if ('show' in message_lower and 'leave' in message_lower and ('my' in message_lower or 'request' in message_lower)) or \
           any(phrase in message_lower for phrase in ['my leave', 'leave status', 'check leave', 'leave requests', 'my applications', 'leave history']):
            return self.handle_leave_status_query(user_id, user_role)
        
        # Store conversation context
        if user_id not in self.conversation_context:
            self.conversation_context[user_id] = {'last_intent': None, 'last_query': None}
        
        # Check for contextual follow-ups
        if any(word in message.lower() for word in ['next', 'more', 'another', 'other', 'continue']) and len(message.split()) <= 3:
            last_intent = self.conversation_context[user_id].get('last_intent')
            if last_intent == 'employee':
                return self.handle_employee_query('show all employees', {}, user_role)
        
        # Classify intent and extract entities
        intent, confidence = self.classify_intent(message)
        entities = self.extract_entities(message)
        
        # Update context
        self.conversation_context[user_id]['last_intent'] = intent
        self.conversation_context[user_id]['last_query'] = message
        
        # Handle based on intent
        if intent == 'greeting':
            return random.choice(self.responses['greeting'])
        
        elif intent == 'farewell':
            return random.choice(self.responses['farewell'])
        
        elif intent == 'employee_creation':
            return self.handle_employee_creation_query(message, entities, user_role, user_id)
        
        # Check if user is in employee creation flow
        if user_id in self.conversation_context and self.conversation_context[user_id].get('creating_employee'):
            return self.handle_employee_creation_step(message, user_id, user_role)
        
        elif intent == 'employee':
            return self.handle_employee_query(message, entities, user_role)
        
        elif intent == 'attendance':
            return self.handle_attendance_query(message, entities, user_role)
        
        elif intent == 'leave':
            return self.handle_leave_query(message, entities, user_role)
        
        elif intent == 'payroll':
            return self.handle_payroll_query(message, entities, user_role, user_id)
        
        elif intent == 'performance':
            return "📊 Performance management features available in the Performance section of your dashboard."
        
        elif intent == 'report':
            return "📋 Various reports are available in the Reports & Analytics section. What specific report do you need?"
        
        elif intent == 'document':
            return self.handle_document_query(message, entities, user_role, user_id)
        
        elif intent == 'user_management':
            return self.handle_user_management_query(message, user_role)
        
        elif intent == 'system':
            return self.handle_system_query(message, user_role)
        
        # Handle direct keyword matches for common queries
        if 'another employees' in message.lower() or 'next employees' in message.lower() or 'more employees' in message.lower():
            return self.handle_employee_query('show all employees', {}, user_role)
        
        if 'active users' in message.lower() or 'inactive users' in message.lower():
            return self.handle_user_management_query(message, user_role, offset=0)
        
        if 'another users' in message.lower() or 'next users' in message.lower() or 'more users' in message.lower():
            # Track user context for pagination
            if user_id not in self.conversation_context:
                self.conversation_context[user_id] = {'user_offset': 0}
            
            # Increment offset for next batch
            current_offset = self.conversation_context[user_id].get('user_offset', 0)
            new_offset = current_offset + 10
            self.conversation_context[user_id]['user_offset'] = new_offset
            
            return self.handle_user_management_query('show users', user_role, offset=new_offset)
        
        user_mgmt_keywords = ['user management', 'manage users', 'user list', 'users list', 'user accounts', 'accounts list', 'login accounts', 'system users', 'portal users', 'user directory', 'user database', 'account management', 'user admin', 'credentials', 'login list', 'system accounts']
        
        system_keywords = ['system', 'portal', 'hrms', 'dashboard', 'platform', 'application', 'interface', 'menu', 'navigation', 'sections', 'modules', 'features', 'capabilities', 'overview', 'main page', 'home page', 'admin panel', 'control panel', 'enterprise portal', 'hr portal', 'management system', 'software', 'web application', 'online system', 'digital platform', 'hr software', 'human resources system', 'employee portal', 'staff portal', 'what is hrms', 'portal features', 'system capabilities', 'how to use', 'system guide', 'portal guide', 'feature list', 'what can i do', 'available features', 'system modules', 'portal sections']
        
        if ('show users' in message.lower() or 'list users' in message.lower() or 'all users' in message.lower() or 'view users' in message.lower() or 'active users' in message.lower() or 'inactive users' in message.lower()) and not any(word in message.lower() for word in ['employee', 'staff', 'worker']):
            # Reset offset for new user query
            if user_id not in self.conversation_context:
                self.conversation_context[user_id] = {}
            self.conversation_context[user_id]['user_offset'] = 0
            return self.handle_user_management_query(message, user_role, offset=0)
        elif any(keyword in message.lower() for keyword in user_mgmt_keywords) and not any(word in message.lower() for word in ['employee', 'staff', 'worker']):
            return self.handle_user_management_query(message, user_role)
        
        elif any(keyword in message.lower() for keyword in system_keywords):
            return self.handle_system_query(message, user_role)
        
        else:
            # Enhanced fallback with context awareness
            return self.handle_general_conversation(message)
    
    def handle_user_management_query(self, message: str, user_role: str, offset: int = 0) -> str:
        """Handle user management related queries"""
        if user_role not in ['admin', 'hr']:
            return "User management features are available for HR and Admin users only. You can view your own profile in the Employee section."
        
        # If asking to show/list users, get actual data
        if any(word in message.lower() for word in ['show', 'list', 'all', 'view', 'another', 'more', 'next']) and any(word in message.lower() for word in ['user', 'users']):
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            try:
                # Check for active/inactive filter
                status_filter = ""
                if 'active users' in message.lower():
                    status_filter = " WHERE is_active = 1"
                elif 'inactive users' in message.lower():
                    status_filter = " WHERE is_active = 0"
                
                # Get total count first
                cursor.execute(f"SELECT COUNT(*) as total FROM users{status_filter}")
                total_users = cursor.fetchone()['total']
                
                # Get users with offset
                cursor.execute(f"SELECT user_id, username, full_name, role, email, is_active FROM users{status_filter} ORDER BY user_id LIMIT 10 OFFSET %s", (offset,))
                users = cursor.fetchall()
                
                if users:
                    start_num = offset + 1
                    end_num = min(offset + len(users), total_users)
                    filter_desc = "All"
                    if 'active users' in message.lower():
                        filter_desc = "Active"
                    elif 'inactive users' in message.lower():
                        filter_desc = "Inactive"
                    
                    response = f"👥 **{filter_desc} System Users ({start_num}-{end_num} of {total_users})**\n\n"
                    for user in users:
                        status = "✅ Active" if user.get('is_active', True) else "❌ Inactive"
                        response += f"• **{user['user_id']}:** {user['full_name']}\n  📧 {user['username']} | 👤 {user['role'].title()} | {status}\n"
                    
                    if end_num < total_users:
                        response += f"\n**More Available:**\n• Say 'more users' to see users {end_num + 1}-{min(end_num + 10, total_users)}\n• Total remaining: {total_users - end_num} users"
                    return response
                else:
                    return "❌ **No More Users**\n\n• No additional users found\n• You've reached the end of the user list\n• Try different filters or start over"
            finally:
                cursor.close()
                conn.close()
        
        return "**User Management Section** allows you to:\n\n" \
               "**View Users List:**\n" \
               "• See all system users with their roles\n" \
               "• View employee details and contact information\n" \
               "• Check user status (active/inactive)\n\n" \
               "**Manage User Accounts:**\n" \
               "• Edit user profiles and details\n" \
               "• Update user roles (Admin, HR, Employee)\n" \
               "• Reset passwords and manage access\n" \
               "• Activate or deactivate user accounts\n\n" \
               "**User Credentials:**\n" \
               "• View login credentials for all users\n" \
               "• Generate new passwords\n" \
               "• Manage user permissions\n\n" \
               "**Department Management:**\n" \
               "• Assign users to departments\n" \
               "• Update department information\n" \
               "• View department-wise user distribution\n\n" \
               "Try asking: 'Show all users', 'Add new user', or 'Update user role'"
    
    def handle_system_query(self, message: str, user_role: str) -> str:
        """Handle system and portal related queries"""
        return "**HRMS Portal Features:**\n\n" \
               "**Dashboard:**\n" \
               "• Overview of key metrics and statistics\n" \
               "• Quick access to common tasks\n" \
               "• Real-time notifications and updates\n\n" \
               "**Main Sections:**\n" \
               "• Employee Management - Add, view, edit employee data\n" \
               "• Attendance Tracking - Monitor daily attendance\n" \
               "• Leave Management - Handle leave requests\n" \
               "• Payroll System - Manage salaries and payments\n" \
               "• Performance Reviews - Track employee performance\n" \
               "• Reports & Analytics - Generate various reports\n" \
               "• Document Generation - Create certificates and letters\n\n" \
               "**User Roles:**\n" \
               "• Admin - Full system access and user management\n" \
               "• HR - Employee management and document generation\n" \
               "• Employee - Limited access to personal data\n\n" \
               "**AI Assistant Features:**\n" \
               "• Natural language queries\n" \
               "• Voice commands (when enabled)\n" \
               "• Multi-language support\n" \
               "• Step-by-step guidance\n\n" \
               "What specific feature would you like to know more about?"
    
    def get_quick_suggestions(self, user_role: str) -> List[str]:
        """Enhanced contextual suggestions based on role and time"""
        current_hour = datetime.now().hour
        
        # Role-based suggestions
        if user_role == 'admin':
            base_suggestions = [
                "Show all employees",
                "Add new employee", 
                "Generate monthly report",
                "Show pending leave requests",
                "Download all user data",
                "View department analytics",
                "Export payroll database",
                "Show system users"
            ]
        elif user_role == 'hr':
            base_suggestions = [
                "Show all employees",
                "Add new employee",
                "Generate salary slip for employee", 
                "Show pending leave requests",
                "Create experience certificate",
                "Process monthly payroll",
                "View department report",
                "Apply for leave"
            ]
        else:  # employee
            base_suggestions = [
                "Download my salary slip",
                "Apply for leave",
                "Check my leave status", 
                "Show today's attendance",
                "What can you help me with?",
                "Show employee directory",
                "View my profile",
                "Check leave balance"
            ]
        
        # Time-based suggestions
        if 6 <= current_hour <= 11:  # Morning
            if user_role in ['admin', 'hr']:
                base_suggestions.extend(["Who's absent today?", "Morning attendance summary"])
            else:
                base_suggestions.extend(["Mark my attendance", "Check today's schedule"])
        elif 17 <= current_hour <= 23:  # Evening
            if user_role in ['admin', 'hr']:
                base_suggestions.extend(["Today's attendance report", "Check overtime hours"])
            else:
                base_suggestions.extend(["Download timesheet", "Check my hours"])
        
        return list(set(base_suggestions))[:8]  # Return unique suggestions, max 8

