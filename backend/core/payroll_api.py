"""
Payroll Management API Endpoints
Handles salary structure, bonuses, settlements, and payroll reports
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import mysql.connector

from backend.config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

router = APIRouter()

class SalaryStructure(BaseModel):
    employee_id: str
    basic_salary: float
    hra_percent: float
    special_allowance: float
    pf_percent: float
    esic_percent: float
    tds_percent: float
    effective_date: str

class BonusRecord(BaseModel):
    employee_id: str
    bonus_type: str
    amount: float
    month: str
    reason: str
    created_by: str

class FinalSettlement(BaseModel):
    employee_id: str
    resignation_date: str
    last_working_day: str
    notice_period_days: int
    earned_leave_days: int
    advance_recovery: float = 0
    other_deductions: float = 0
    processed_by: str

@router.post("/api/payroll/create")
async def create_salary_structure(salary: SalaryStructure):
    """Create or update employee salary structure"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate components
        hra = (salary.basic_salary * salary.hra_percent) / 100
        gross = salary.basic_salary + hra + salary.special_allowance
        pf = (salary.basic_salary * salary.pf_percent) / 100
        esic = (gross * salary.esic_percent) / 100
        tds = (gross * salary.tds_percent) / 100
        net = gross - (pf + esic + tds)
        
        annual_ctc = gross * 12
        
        # Insert salary structure with all required fields
        query = """
        INSERT INTO salary_structures 
        (employee_id, annual_ctc, basic_salary, hra, special_allowance, 
         transport_allowance, medical_allowance, pf_employee, professional_tax, 
         gross_salary, pf_deduction, esic_deduction, tds_deduction, net_salary, 
         status, effective_date, created_at)
        VALUES (%s, %s, %s, %s, %s, 0, 0, %s, 0, %s, %s, %s, %s, %s, 'active', %s, NOW())
        """
        
        cursor.execute(query, (
            salary.employee_id, annual_ctc, salary.basic_salary, hra, 
            salary.special_allowance, pf, gross, pf, esic, tds, net, 
            salary.effective_date
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Salary structure created successfully",
            "data": {
                "employee_id": salary.employee_id,
                "gross_salary": gross,
                "net_salary": net
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/payroll/history/{employee_id}")
async def get_salary_history(employee_id: str):
    """Get salary revision history for an employee"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
        SELECT employee_id, basic_salary, gross_salary, net_salary, 
               effective_date, created_at
        FROM salary_structures
        WHERE employee_id = %s
        ORDER BY effective_date DESC
        """
        
        cursor.execute(query, (employee_id,))
        history = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "employee_id": employee_id,
            "history": history
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/payroll/bonus")
async def add_bonus(bonus: BonusRecord):
    """Add bonus or incentive to employee"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Map bonus_type to valid ENUM values
        valid_types = ['Performance', 'Festival', 'Referral', 'Project', 'Other']
        bonus_type = bonus.bonus_type if bonus.bonus_type in valid_types else 'Other'
        
        query = """
        INSERT INTO bonuses 
        (employee_id, bonus_type, amount, bonus_month, reason, approved_by, status)
        VALUES (%s, %s, %s, %s, %s, %s, 'Approved')
        """
        
        cursor.execute(query, (
            bonus.employee_id, bonus_type, bonus.amount,
            bonus.month, bonus.reason, bonus.created_by
        ))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": f"Bonus of ₹{bonus.amount} added successfully",
            "data": {
                "employee_id": bonus.employee_id,
                "amount": bonus.amount,
                "type": bonus_type
            }
        }
        
    except Exception as e:
        import traceback
        print(f"Bonus error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/payroll/fnf/calculate")
async def calculate_fnf(settlement: FinalSettlement):
    """Calculate Final Settlement (F&F) for an employee"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get latest salary structure
        cursor.execute("""
            SELECT basic_salary, gross_salary, net_salary 
            FROM salary_structures 
            WHERE employee_id = %s 
            ORDER BY effective_date DESC LIMIT 1
        """, (settlement.employee_id,))
        salary = cursor.fetchone()
        
        if not salary:
            raise HTTPException(status_code=404, detail="Salary structure not found")
        
        # Calculate pending salary (pro-rata for last month)
        lwday = datetime.strptime(settlement.last_working_day, "%Y-%m-%d")
        days_worked = lwday.day
        days_in_month = 30
        pending_salary = (salary['net_salary'] / days_in_month) * days_worked
        
        # Calculate earned leave encashment
        daily_salary = salary['net_salary'] / days_in_month
        leave_amount = settlement.earned_leave_days * daily_salary
        
        # Get pending bonuses
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) as total_bonus 
            FROM bonuses 
            WHERE employee_id = %s AND bonus_month >= DATE_FORMAT(%s, '%%Y-%%m')
        """, (settlement.employee_id, settlement.last_working_day))
        bonus_data = cursor.fetchone()
        bonus_amount = bonus_data['total_bonus'] if bonus_data else 0
        
        # Calculate notice recovery
        company_notice_period = 30
        notice_shortfall = max(0, company_notice_period - settlement.notice_period_days)
        notice_recovery = (notice_shortfall * daily_salary) if notice_shortfall > 0 else 0
        
        # Calculate totals
        gross_amount = pending_salary + leave_amount + bonus_amount
        total_deductions = notice_recovery + settlement.advance_recovery + settlement.other_deductions
        net_settlement = gross_amount - total_deductions
        
        # Insert settlement record
        cursor.execute("""
            INSERT INTO final_settlements 
            (employee_id, resignation_date, last_working_day, notice_period_days, 
             notice_shortfall_days, pending_salary, earned_leave_days, earned_leave_amount, 
             bonus_amount, notice_recovery, advance_recovery, other_deductions, 
             gross_amount, total_deductions, net_settlement, status, processed_by, processed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'CALCULATED', %s, NOW())
        """, (
            settlement.employee_id, settlement.resignation_date, settlement.last_working_day,
            settlement.notice_period_days, notice_shortfall, pending_salary,
            settlement.earned_leave_days, leave_amount, bonus_amount,
            notice_recovery, settlement.advance_recovery, settlement.other_deductions,
            gross_amount, total_deductions, net_settlement, settlement.processed_by
        ))
        
        settlement_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": "F&F settlement calculated successfully",
            "data": {
                "settlement_id": settlement_id,
                "employee_id": settlement.employee_id,
                "pending_salary": round(pending_salary, 2),
                "leave_encashment": round(leave_amount, 2),
                "bonus_amount": round(bonus_amount, 2),
                "gross_amount": round(gross_amount, 2),
                "notice_recovery": round(notice_recovery, 2),
                "advance_recovery": settlement.advance_recovery,
                "other_deductions": settlement.other_deductions,
                "total_deductions": round(total_deductions, 2),
                "net_settlement": round(net_settlement, 2)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/payroll/fnf/all")
async def get_all_settlements():
    """Get all F&F settlements"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT fs.*, e.name as employee_name, e.department 
            FROM final_settlements fs
            LEFT JOIN employees e ON fs.employee_id = e.employee_id
            ORDER BY fs.created_at DESC
        """)
        
        settlements = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "data": settlements
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/payroll/fnf/{employee_id}")
async def get_fnf_settlement(employee_id: str):
    """Get F&F settlement details for an employee"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT * FROM final_settlements 
            WHERE employee_id = %s 
            ORDER BY created_at DESC LIMIT 1
        """, (employee_id,))
        
        settlement = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not settlement:
            raise HTTPException(status_code=404, detail="No settlement found")
        
        return {
            "success": True,
            "data": settlement
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

