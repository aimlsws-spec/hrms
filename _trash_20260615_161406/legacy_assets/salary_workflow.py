"""
Salary Workflow Manager
Handles complete salary lifecycle from creation to payroll processing
"""
from datetime import datetime
from salary_calculator import SalaryCalculator
import mysql.connector

class SalaryWorkflowManager:
    def __init__(self, db_config):
        self.db_config = db_config
    
    def get_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    def create_salary_structure(self, employee_id, annual_ctc, template='standard', created_by='HR'):
        """Step 1-3: Create and calculate salary structure"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Calculate breakdown
        breakdown = SalaryCalculator.calculate_ctc_breakdown(annual_ctc, template)
        annual = breakdown['annual']
        
        cursor.execute("""
            INSERT INTO salary_structures 
            (employee_id, annual_ctc, template, basic_salary, hra, special_allowance,
             transport_allowance, medical_allowance, pf_employer, pf_employee,
             professional_tax, gross_salary, total_deductions, net_salary, 
             status, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
        """, (employee_id, annual_ctc, template, annual['basic'], annual['hra'],
              annual['special_allowance'], annual['transport_allowance'], 
              annual['medical_allowance'], annual['pf_employer'], annual['pf_employee'],
              annual['professional_tax'], annual['gross'], annual['total_deductions'],
              annual['net_salary'], created_by))
        
        structure_id = cursor.lastrowid
        
        # Update employee salary in employees table
        cursor.execute(
            "UPDATE employees SET salary = %s WHERE employee_id = %s",
            (annual_ctc, employee_id)
        )
        
        conn.commit()
        conn.close()
        
        return {"success": True, "structure_id": structure_id, "breakdown": breakdown}
    
    def approve_salary_structure(self, structure_id, approved_by='Accountant'):
        """Step 4: Approve salary structure"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE salary_structures 
            SET status='approved', approved_by=%s, approved_at=NOW()
            WHERE id=%s AND status='pending'
        """, (approved_by, structure_id))
        
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        return {"success": affected > 0, "message": "Approved" if affected > 0 else "Not found or already approved"}
    
    def activate_salary(self, employee_id, effective_from=None):
        """Step 6: Activate salary when employee joins"""
        if not effective_from:
            effective_from = datetime.now().date()
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Deactivate old structures
        cursor.execute("UPDATE salary_structures SET status='inactive' WHERE employee_id=%s AND status='active'", (employee_id,))
        
        # Activate latest approved structure
        cursor.execute("""
            UPDATE salary_structures 
            SET status='active', effective_from=%s
            WHERE employee_id=%s AND status='approved'
            ORDER BY created_at DESC LIMIT 1
        """, (effective_from, employee_id))
        
        affected = cursor.rowcount
        conn.commit()
        conn.close()
        
        return {"success": affected > 0, "message": "Salary activated"}
    
    def get_active_salary(self, employee_id):
        """Get active salary structure for employee"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT * FROM salary_structures 
            WHERE employee_id=%s AND status='active'
            ORDER BY effective_from DESC LIMIT 1
        """, (employee_id,))
        
        structure = cursor.fetchone()
        conn.close()
        
        return structure
    
    def create_payroll_run(self, month_year, processed_by='Accountant'):
        """Step 7: Create monthly payroll run"""
        run_id = f"PR_{month_year.replace('-', '')}_{datetime.now().strftime('%H%M%S')}"
        
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Count active employees
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures WHERE status='active'")
        total = cursor.fetchone()['count']
        
        cursor.execute("""
            INSERT INTO payroll_runs (run_id, month_year, total_employees, processed_by, status, started_at)
            VALUES (%s, %s, %s, %s, 'processing', NOW())
        """, (run_id, month_year, total, processed_by))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "run_id": run_id, "total_employees": total}
    
    def process_payroll(self, run_id):
        """Process payroll for all active employees"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get run details
        cursor.execute("SELECT * FROM payroll_runs WHERE run_id=%s", (run_id,))
        run = cursor.fetchone()
        
        if not run:
            conn.close()
            return {"success": False, "message": "Run not found"}
        
        # Get all active salary structures
        cursor.execute("SELECT * FROM salary_structures WHERE status='active'")
        structures = cursor.fetchall()
        
        processed = 0
        total_amount = 0
        
        for structure in structures:
            # Create transaction
            cursor.execute("""
                INSERT INTO payroll_transactions 
                (run_id, employee_id, month_year, salary_structure_id, 
                 gross_salary, total_deductions, net_salary)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (run_id, structure['employee_id'], run['month_year'],
                  structure['id'], structure['gross_salary'],
                  structure['total_deductions'], structure['net_salary']))
            
            processed += 1
            total_amount += float(structure['net_salary'])
        
        # Update run status
        cursor.execute("""
            UPDATE payroll_runs 
            SET processed_count=%s, total_amount=%s, status='completed', completed_at=NOW()
            WHERE run_id=%s
        """, (processed, total_amount, run_id))
        
        conn.commit()
        conn.close()
        
        return {"success": True, "processed": processed, "total_amount": total_amount}
    
    def generate_offer_letter_data(self, employee_id):
        """Step 5: Get salary data for offer letter"""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT s.*, e.first_name, e.last_name, e.title, e.department
            FROM salary_structures s
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE s.employee_id=%s AND s.status='approved'
            ORDER BY s.created_at DESC LIMIT 1
        """, (employee_id,))
        
        data = cursor.fetchone()
        conn.close()
        
        if data:
            return {
                "candidate_name": f"{data['first_name']} {data['last_name']}",
                "position": data['title'],
                "department": data['department'],
                "annual_ctc": data['annual_ctc'],
                "basic_salary": data['basic_salary'],
                "hra": data['hra'],
                "gross_salary": data['gross_salary'],
                "net_salary": data['net_salary']
            }
        return None
