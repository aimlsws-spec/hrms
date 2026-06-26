"""
Automated Payroll Processing and Overtime Calculation
Handles monthly payroll runs with automatic overtime calculations
"""

from datetime import datetime, timedelta
from decimal import Decimal
import mysql.connector
from typing import Dict, List, Optional
import os

# Use the same DB config as app.py
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@123',
    'database': 'hrms'
}

def get_db_connection():
    
    return mysql.connector.connect(**DB_CONFIG)

class PayrollAutomation:
    
    def __init__(self):
        self.standard_hours_per_day = 8
        self.working_days_per_month = 22
        self.overtime_multiplier = 1.5
    
    def calculate_overtime(self, employee_id: str, month: str, year: int) -> Dict:
        """Calculate overtime hours and amount for an employee"""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get attendance records for the month
        cursor.execute("""
            SELECT SUM(work_hours) as total_hours, 
                   SUM(overtime_hours) as recorded_overtime,
                   COUNT(*) as days_present
            FROM attendance_records
            WHERE employee_id = %s 
            AND MONTH(attendance_date) = %s 
            AND YEAR(attendance_date) = %s
        """, (employee_id, month, year))
        
        attendance = cursor.fetchone()
        
        if not attendance or not attendance['total_hours']:
            conn.close()
            return {"overtime_hours": 0, "overtime_amount": 0, "total_hours": 0}
        
        # Get salary structure
        cursor.execute("""
            SELECT basic_salary, gross_salary 
            FROM salary_structures 
            WHERE employee_id = %s 
            ORDER BY effective_date DESC LIMIT 1
        """, (employee_id,))
        
        salary = cursor.fetchone()
        conn.close()
        
        if not salary:
            return {"overtime_hours": 0, "overtime_amount": 0, "total_hours": attendance['total_hours']}
        
        # Calculate overtime
        total_hours = float(attendance['total_hours'] or 0)
        standard_hours = self.standard_hours_per_day * self.working_days_per_month
        overtime_hours = max(0, total_hours - standard_hours)
        
        # Calculate hourly rate and overtime amount
        hourly_rate = float(salary['basic_salary']) / (self.working_days_per_month * self.standard_hours_per_day)
        overtime_amount = overtime_hours * hourly_rate * self.overtime_multiplier
        
        return {
            "overtime_hours": round(overtime_hours, 2),
            "overtime_amount": round(overtime_amount, 2),
            "total_hours": round(total_hours, 2),
            "hourly_rate": round(hourly_rate, 2),
            "days_present": attendance['days_present']
        }
    
    def process_monthly_payroll(self, month: int, year: int) -> Dict:
        """Process payroll for all employees for a given month"""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get all active employees
        cursor.execute("SELECT user_id, full_name FROM users WHERE is_active = 1")
        employees = cursor.fetchall()
        
        results = []
        total_payroll = 0
        
        for emp in employees:
            employee_id = emp['user_id']
            
            # Get salary structure
            cursor.execute("""
                SELECT * FROM salary_structures 
                WHERE employee_id = %s 
                ORDER BY effective_date DESC LIMIT 1
            """, (employee_id,))
            
            salary = cursor.fetchone()
            
            if not salary:
                continue
            
            # Calculate overtime
            overtime_data = self.calculate_overtime(employee_id, month, year)
            
            # Get bonuses for the month
            cursor.execute("""
                SELECT SUM(amount) as total_bonus 
                FROM bonuses 
                WHERE employee_id = %s 
                AND bonus_month = %s
            """, (employee_id, f"{year}-{month:02d}"))
            
            bonus_result = cursor.fetchone()
            bonus_amount = float(bonus_result['total_bonus'] or 0)
            
            # Calculate final salary
            gross_salary = float(salary['gross_salary'])
            overtime_amount = overtime_data['overtime_amount']
            total_earnings = gross_salary + overtime_amount + bonus_amount
            
            total_deductions = float(salary['pf_deduction'] or 0) + \
                             float(salary['esic_deduction'] or 0) + \
                             float(salary['tds_deduction'] or 0)
            
            net_salary = total_earnings - total_deductions
            
            # Store payroll record
            cursor.execute("""
                INSERT INTO payroll_records 
                (employee_id, month, year, basic_salary, gross_salary, 
                 overtime_hours, overtime_amount, bonus_amount, 
                 total_earnings, total_deductions, net_salary, 
                 processed_date, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), 'PROCESSED')
                ON DUPLICATE KEY UPDATE
                overtime_hours = VALUES(overtime_hours),
                overtime_amount = VALUES(overtime_amount),
                bonus_amount = VALUES(bonus_amount),
                total_earnings = VALUES(total_earnings),
                net_salary = VALUES(net_salary),
                processed_date = NOW()
            """, (employee_id, month, year, salary['basic_salary'], gross_salary,
                  overtime_data['overtime_hours'], overtime_amount, bonus_amount,
                  total_earnings, total_deductions, net_salary))
            
            results.append({
                "employee_id": employee_id,
                "employee_name": emp['full_name'],
                "gross_salary": gross_salary,
                "overtime_hours": overtime_data['overtime_hours'],
                "overtime_amount": overtime_amount,
                "bonus_amount": bonus_amount,
                "net_salary": net_salary
            })
            
            total_payroll += net_salary
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "month": month,
            "year": year,
            "employees_processed": len(results),
            "total_payroll": round(total_payroll, 2),
            "details": results
        }
    
    def get_payroll_summary(self, month: int, year: int) -> Dict:
        """Get payroll summary for a month"""
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_employees,
                SUM(gross_salary) as total_gross,
                SUM(overtime_amount) as total_overtime,
                SUM(bonus_amount) as total_bonus,
                SUM(total_earnings) as total_earnings,
                SUM(total_deductions) as total_deductions,
                SUM(net_salary) as total_net
            FROM payroll_records
            WHERE month = %s AND year = %s
        """, (month, year))
        
        summary = cursor.fetchone()
        conn.close()
        
        return {
            "success": True,
            "month": month,
            "year": year,
            "summary": summary
        }
