"""
Test Automated Payroll Processing and Overtime Calculation
"""

from payroll_automation import PayrollAutomation
from datetime import datetime

def test_payroll_automation():
    """Test the automated payroll system"""
    
    payroll = PayrollAutomation()
    
    print("=" * 60)
    print("AUTOMATED PAYROLL PROCESSING & OVERTIME CALCULATION TEST")
    print("=" * 60)
    
    # Test 1: Calculate overtime for a specific employee
    print("\n1. Testing Overtime Calculation for Employee EMP001...")
    print("-" * 60)
    
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    overtime_result = payroll.calculate_overtime('EMP001', current_month, current_year)
    
    print(f"Employee: EMP001")
    print(f"Month/Year: {current_month}/{current_year}")
    print(f"Total Hours Worked: {overtime_result.get('total_hours', 0)}")
    print(f"Overtime Hours: {overtime_result.get('overtime_hours', 0)}")
    print(f"Overtime Amount: Rs. {overtime_result.get('overtime_amount', 0):,.2f}")
    print(f"Hourly Rate: Rs. {overtime_result.get('hourly_rate', 0):,.2f}")
    
    # Test 2: Process monthly payroll for all employees
    print("\n2. Testing Monthly Payroll Processing...")
    print("-" * 60)
    
    payroll_result = payroll.process_monthly_payroll(current_month, current_year)
    
    if payroll_result['success']:
        print(f"Month/Year: {payroll_result['month']}/{payroll_result['year']}")
        print(f"Employees Processed: {payroll_result['employees_processed']}")
        print(f"Total Payroll: Rs. {payroll_result['total_payroll']:,.2f}")
        
        print("\nEmployee Details:")
        for emp in payroll_result['details'][:5]:  # Show first 5 employees
            print(f"  - {emp['employee_name']} ({emp['employee_id']})")
            print(f"    Gross: Rs. {emp['gross_salary']:,.2f}")
            print(f"    Overtime: {emp['overtime_hours']} hrs = Rs. {emp['overtime_amount']:,.2f}")
            print(f"    Bonus: Rs. {emp['bonus_amount']:,.2f}")
            print(f"    Net Salary: Rs. {emp['net_salary']:,.2f}")
    else:
        print(f"Error: {payroll_result.get('message', 'Unknown error')}")
    
    # Test 3: Get payroll summary
    print("\n3. Testing Payroll Summary...")
    print("-" * 60)
    
    summary_result = payroll.get_payroll_summary(current_month, current_year)
    
    if summary_result['success']:
        summary = summary_result['summary']
        print(f"Total Employees: {summary['total_employees']}")
        print(f"Total Gross Salary: Rs. {summary['total_gross']:,.2f}")
        print(f"Total Overtime: Rs. {summary['total_overtime']:,.2f}")
        print(f"Total Bonus: Rs. {summary['total_bonus']:,.2f}")
        print(f"Total Earnings: Rs. {summary['total_earnings']:,.2f}")
        print(f"Total Deductions: Rs. {summary['total_deductions']:,.2f}")
        print(f"Total Net Salary: Rs. {summary['total_net']:,.2f}")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETED SUCCESSFULLY")
    print("=" * 60)
    
    print("\nAPI Endpoints Available:")
    print("  GET  /api/payroll/overtime/{employee_id}?month=X&year=Y")
    print("  POST /api/payroll/process-monthly")
    print("  GET  /api/payroll/summary/{month}/{year}")

if __name__ == "__main__":
    test_payroll_automation()
