#!/usr/bin/env python3
"""
Employee Profile Management System
Handles comprehensive employee information collection and storage
"""

import mysql.connector
import os
import json
from pathlib import Path
from backend.config import DB_CONFIG

class EmployeeProfileSystem:
    def __init__(self):
        self.db_config = DB_CONFIG
        self.employee_data_dir = Path("employee_data")
        self.employee_data_dir.mkdir(exist_ok=True)
        self.setup_database()
    
    def setup_database(self):
        """Create employee_profiles table with all required fields"""
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_profiles (
                employee_id VARCHAR(50) PRIMARY KEY,
                profile_completed BOOLEAN DEFAULT FALSE,
                
                -- Personal Information
                fathers_spouse_name VARCHAR(255),
                date_of_birth DATE,
                gender ENUM('Male', 'Female', 'Other'),
                marital_status ENUM('Single', 'Married', 'Divorced', 'Widowed'),
                nationality VARCHAR(100),
                photograph_path VARCHAR(500),
                
                -- Address Information
                current_address TEXT,
                permanent_address TEXT,
                alternate_mobile VARCHAR(20),
                alternate_phone VARCHAR(20),
                emergency_number VARCHAR(20),
                
                -- Identity Documents
                aadhaar_number VARCHAR(20),
                aadhaar_image_path VARCHAR(500),
                pan_number VARCHAR(20),
                pan_image_path VARCHAR(500),
                uan_number VARCHAR(50),
                
                -- Education
                highest_qualification VARCHAR(255),
                degree_certificates_path VARCHAR(500),
                university_name VARCHAR(255),
                year_of_passing INT,
                
                -- Experience
                is_fresher BOOLEAN,
                experience_letters_path VARCHAR(500),
                relieving_letter_path VARCHAR(500),
                
                -- Banking
                bank_name VARCHAR(255),
                account_holder_name VARCHAR(255),
                account_number VARCHAR(50),
                ifsc_code VARCHAR(20),
                branch_name VARCHAR(255),
                signature_path VARCHAR(500),
                
                -- Documents
                appointment_letter_path VARCHAR(500),
                nda_agreement_path VARCHAR(500),
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
    
    def create_employee_folder(self, employee_id):
        """Create folder structure for employee"""
        emp_folder = self.employee_data_dir / employee_id
        emp_folder.mkdir(exist_ok=True)
        
        # Create subfolders: photographs, documents, certificates, signatures
        subfolders = ['photographs', 'documents', 'certificates', 'signatures']
        for folder in subfolders:
            (emp_folder / folder).mkdir(exist_ok=True)
        
        return emp_folder
    
    def mark_profile_incomplete(self, employee_id):
        """Mark profile as incomplete for newly created users"""
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Insert empty profile record to mark as incomplete
            cursor.execute("""
                INSERT INTO employee_profiles (employee_id, profile_completed) 
                VALUES (%s, FALSE)
                ON DUPLICATE KEY UPDATE profile_completed = FALSE
            """, (employee_id,))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error marking profile incomplete: {e}")
    
    def mark_profile_complete(self, employee_id):
        """Mark profile as completed in both tables"""
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Update employee_profiles table
            cursor.execute("""
                INSERT INTO employee_profiles (employee_id, profile_completed) 
                VALUES (%s, TRUE)
                ON DUPLICATE KEY UPDATE profile_completed = TRUE
            """, (employee_id,))
            
            # Update users table for consistency
            cursor.execute("""
                UPDATE users SET profile_completed = TRUE 
                WHERE user_id = %s
            """, (employee_id,))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error marking profile complete: {e}")
    
    def check_profile_completion(self, employee_id):
        """Check if employee profile is completed - DATABASE IS SINGLE SOURCE OF TRUTH"""
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # First check if user exists in users table and get profile_completed status
            cursor.execute("SELECT profile_completed FROM users WHERE user_id = %s", (employee_id,))
            user_result = cursor.fetchone()
            
            # If user exists and profile_completed is explicitly set to TRUE, check further
            if user_result and user_result[0] is True:
                # Double-check with employee_profiles table
                cursor.execute("SELECT profile_completed FROM employee_profiles WHERE employee_id = %s", (employee_id,))
                profile_result = cursor.fetchone()
                
                if profile_result and profile_result[0] is True:
                    conn.close()
                    return True
            
            # If no explicit TRUE in database, return False
            conn.close()
            return False
            
        except Exception as e:
            print(f"Error checking profile completion: {e}")
            return False
    
    def get_mandatory_fields(self):
        """Return list of mandatory fields"""
        return [
            'date_of_birth', 'gender', 'marital_status', 'nationality',
            'photograph_path', 'current_address', 'permanent_address',
            'emergency_number', 'aadhaar_number', 'aadhaar_image_path',
            'pan_number', 'pan_image_path'
        ]
    
    def get_profile_data(self, employee_id):
        """Get employee profile data"""
        conn = mysql.connector.connect(**self.db_config)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM employee_profiles WHERE employee_id = %s", (employee_id,))
        result = cursor.fetchone()
        
        conn.close()
        return result
    
    def save_profile_data(self, employee_id, data):
        """Save employee profile data and mark as completed"""
        try:
            conn = mysql.connector.connect(**self.db_config)
            cursor = conn.cursor()
            
            # Check if profile exists
            cursor.execute("SELECT employee_id FROM employee_profiles WHERE employee_id = %s", (employee_id,))
            exists = cursor.fetchone()
            
            if exists:
                # Update existing profile
                update_fields = []
                values = []
                for key, value in data.items():
                    if key != 'employee_id':
                        update_fields.append(f"{key} = %s")
                        values.append(value)
                
                if update_fields:
                    # Always mark as completed when saving profile data
                    update_fields.append("profile_completed = TRUE")
                    values.append(employee_id)
                    cursor.execute(f"UPDATE employee_profiles SET {', '.join(update_fields)} WHERE employee_id = %s", values)
            else:
                # Insert new profile - always mark as completed
                data['employee_id'] = employee_id
                data['profile_completed'] = True
                columns = ', '.join(data.keys())
                placeholders = ', '.join(['%s'] * len(data))
                cursor.execute(f"INSERT INTO employee_profiles ({columns}) VALUES ({placeholders})", list(data.values()))
            
            # Also update users table to ensure consistency
            cursor.execute("UPDATE users SET profile_completed = TRUE WHERE user_id = %s", (employee_id,))
            
            conn.commit()
            conn.close()
            return {"success": True, "message": "Profile data saved successfully"}
        except Exception as e:
            return {"success": False, "message": f"Database error: {str(e)}"}
    
    def save_uploaded_file(self, employee_id, file_data, file_type, filename):
        """Save uploaded file to employee folder"""
        import re

        # Safe filename: strip path separators and traversal sequences
        safe_name = Path(filename).name  # strips any directory component
        # Replace any remaining unsafe characters
        safe_name = re.sub(r'[^\w.\-]', '_', safe_name)
        if not safe_name or safe_name.startswith('.'):
            safe_name = f"upload_{file_type}"

        # Allowed extensions per document type
        _ALLOWED_EXTS = {
            'photograph':          {'.jpg', '.jpeg', '.png'},
            'aadhaar':             {'.jpg', '.jpeg', '.png', '.pdf'},
            'pan':                 {'.jpg', '.jpeg', '.png', '.pdf'},
            'certificate':         {'.jpg', '.jpeg', '.png', '.pdf'},
            'experience':          {'.jpg', '.jpeg', '.png', '.pdf'},
            'signature':           {'.jpg', '.jpeg', '.png'},
            'appointment':         {'.pdf'},
            'nda':                 {'.pdf'},
            'degree_certificates': {'.jpg', '.jpeg', '.png', '.pdf'},
            'relieving_letter':    {'.jpg', '.jpeg', '.png', '.pdf'},
        }
        allowed = _ALLOWED_EXTS.get(file_type, {'.jpg', '.jpeg', '.png', '.pdf'})
        ext = Path(safe_name).suffix.lower()
        if ext not in allowed:
            raise ValueError(f"File type '{ext}' not allowed for {file_type}. Allowed: {allowed}")

        emp_folder = self.create_employee_folder(employee_id)

        # Determine subfolder based on file type
        subfolder_map = {
            'photograph': 'photos',
            'aadhaar': 'documents',
            'pan': 'documents',
            'certificate': 'certificates',
            'experience': 'documents',
            'signature': 'signatures',
            'appointment': 'documents',
            'nda': 'documents',
            'degree_certificates': 'certificates',
            'relieving_letter': 'documents'
        }

        subfolder = subfolder_map.get(file_type, 'documents')
        file_path = emp_folder / subfolder / safe_name

        # Resolve and confirm the file stays inside the employee folder
        try:
            file_path.resolve().relative_to(emp_folder.resolve())
        except ValueError:
            raise ValueError("Invalid file path")

        # Save file (assuming file_data is base64 or binary)
        with open(file_path, 'wb') as f:
            if isinstance(file_data, str):
                import base64
                f.write(base64.b64decode(file_data))
            else:
                f.write(file_data)

        return str(file_path)
