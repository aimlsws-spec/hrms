"""
Salary Structure Manager
Handles salary structure changes and automatic document regeneration
"""

import mysql.connector
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import os

class SalaryStructureManager:
    """Manages salary structure changes and document regeneration"""
    
    def __init__(self, db_config: Dict):
        self.db_config = db_config
        self.generated_docs_dir = Path("generated_docs")
    
    def get_db_connection(self):
        return mysql.connector.connect(**self.db_config)
    
    def delete_old_documents(self, employee_id: str):
        """Delete old salary slips and offer letters for employee"""
        try:
            deleted_files = []
            
            # Search for files matching employee_id pattern
            for file in self.generated_docs_dir.glob(f"*{employee_id}*.pdf"):
                filename = file.name.lower()
                # Delete salary slips and offer letters only
                if 'salary_slip' in filename or 'offer_letter' in filename:
                    file.unlink()
                    deleted_files.append(file.name)
                    print(f"Deleted old document: {file.name}")
            
            return {"success": True, "deleted_files": deleted_files}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def create_salary_structure(self, employee_id: str, annual_ctc: float, 
                               template: str = 'standard', created_by: str = 'Accountant'):
        """Create new salary structure and regenerate documents"""
        try:
            from salary_calculator import SalaryCalculator
            
            # Calculate breakdown
            breakdown = SalaryCalculator.calculate_ctc_breakdown(annual_ctc, template)
            annual = breakdown['annual']
            monthly = breakdown['monthly']
            
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Deactivate old structures
            cursor.execute("""
                UPDATE salary_structures 
                SET status = 'inactive' 
                WHERE employee_id = %s AND status = 'active'
            """, (employee_id,))
            
            # Insert new structure
            cursor.execute("""
                INSERT INTO salary_structures 
                (employee_id, annual_ctc, template, basic_salary, hra, 
                 special_allowance, transport_allowance, medical_allowance,
                 pf_employer, pf_employee, professional_tax, 
                 gross_salary, pf_deduction, esic_deduction, tds_deduction, net_salary, 
                 status, created_by, effective_date, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s, CURDATE(), NOW())
            """, (
                employee_id, annual_ctc, template,
                monthly['basic'], monthly['hra'], monthly['special_allowance'],
                monthly['transport_allowance'], monthly['medical_allowance'],
                monthly['pf_employer'], monthly['pf_employee'], monthly['professional_tax'],
                monthly['gross'], monthly['pf_employee'], 0, 0, monthly['net_salary'],
                created_by
            ))
            
            structure_id = cursor.lastrowid
            conn.commit()
            cursor.close()
            conn.close()
            
            # Delete old documents
            self.delete_old_documents(employee_id)
            
            return {
                "success": True,
                "message": "Salary structure created. Old documents deleted.",
                "structure_id": structure_id,
                "breakdown": breakdown
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def approve_and_activate_structure(self, structure_id: int, approved_by: str = 'Accountant'):
        """Approve and activate salary structure, then generate new documents"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Get structure details
            cursor.execute("""
                SELECT ss.*, e.employee_id, 
                       CONCAT(e.first_name, ' ', e.last_name) as employee_name,
                       e.title, e.department,
                       (ss.pf_deduction + ss.esic_deduction + ss.tds_deduction) as total_deductions
                FROM salary_structures ss
                JOIN employees e ON ss.employee_id = e.employee_id
                WHERE ss.id = %s
            """, (structure_id,))
            structure = cursor.fetchone()
            
            if not structure:
                return {"success": False, "message": "Structure not found"}
            
            # Approve and activate
            cursor.execute("""
                UPDATE salary_structures 
                SET status = 'active', approved_by = %s, approved_at = NOW()
                WHERE id = %s
            """, (approved_by, structure_id))
            
            # Update employee salary
            cursor.execute("""
                UPDATE employees 
                SET salary = %s 
                WHERE employee_id = %s
            """, (structure['annual_ctc'], structure['employee_id']))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            # Generate new documents
            documents = self.generate_documents_for_employee(structure)
            
            return {
                "success": True,
                "message": "Salary structure activated and documents generated",
                "documents": documents
            }
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def generate_documents_for_employee(self, structure: Dict):
        """Generate offer letter and salary slip with new structure"""
        try:
            from document_generator import DocumentGenerator
            doc_gen = DocumentGenerator()
            
            generated_docs = []
            
            # Generate Offer Letter
            try:
                offer_data = {
                    'candidate_name': structure['employee_name'],
                    'position': structure.get('title', 'Employee'),
                    'department': structure.get('department', 'General'),
                    'salary': f"Rs. {int(structure['annual_ctc']):,} per annum",
                    'joining_date': datetime.now().strftime('%Y-%m-%d'),
                    'employee_id': structure['employee_id']
                }
                offer_filename = doc_gen.generate_offer_letter(offer_data)
                generated_docs.append({
                    "type": "offer_letter",
                    "filename": offer_filename,
                    "download_url": f"/download/{offer_filename}"
                })
            except Exception as e:
                print(f"Offer letter generation failed: {e}")
            
            # Generate Salary Slip
            try:
                salary_data = {
                    'employee_id': structure['employee_id'],
                    'employee_name': structure['employee_name'],
                    'department': structure.get('department', 'General'),
                    'position': structure.get('title', 'Employee'),
                    'month_year': datetime.now().strftime('%Y-%m'),
                    'basic_salary': float(structure['basic_salary']),
                    'hra': float(structure['hra']),
                    'transport': float(structure.get('transport_allowance', 0)),
                    'medical': float(structure.get('medical_allowance', 0)),
                    'gross_salary': float(structure['gross_salary']),
                    'pf_deduction': float(structure['pf_employee']),
                    'tax_deduction': float(structure['professional_tax']),
                    'total_deductions': float(structure['total_deductions']),
                    'net_salary': float(structure['net_salary'])
                }
                salary_filename = doc_gen.generate_salary_slip(salary_data)
                generated_docs.append({
                    "type": "salary_slip",
                    "filename": salary_filename,
                    "download_url": f"/download/{salary_filename}"
                })
            except Exception as e:
                print(f"Salary slip generation failed: {e}")
            
            return generated_docs
        except Exception as e:
            print(f"Document generation error: {e}")
            return []
    
    def update_salary_structure(self, employee_id: str, annual_ctc: float, 
                               template: str = 'standard', updated_by: str = 'Accountant'):
        """Complete workflow: Create, approve, activate, and generate documents"""
        try:
            # Step 1: Create structure and delete old docs
            result = self.create_salary_structure(employee_id, annual_ctc, template, updated_by)
            if not result['success']:
                return result
            
            structure_id = result['structure_id']
            
            # Step 2: Auto-approve and activate, generate new docs
            final_result = self.approve_and_activate_structure(structure_id, updated_by)
            
            return final_result
        except Exception as e:
            return {"success": False, "message": str(e)}
