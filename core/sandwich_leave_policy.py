"""
Sandwich Leave Policy Implementation
Automatically applies leave for working days between holidays and weekends
"""
from datetime import datetime, timedelta
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def get_holidays(year=None):
    """Get all holidays for a year"""
    if not year:
        year = datetime.now().year
    
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT holiday_date as date FROM holidays WHERE YEAR(holiday_date) = %s ORDER BY holiday_date", (year,))
    holidays = cursor.fetchall()
    conn.close()
    return [h['date'] for h in holidays]

def is_weekend(date):
    """Check if date is weekend (Saturday=5, Sunday=6)"""
    return date.weekday() in [5, 6]

def get_sandwich_days(start_date, end_date, holidays):
    """
    Calculate sandwich days - only applies when leave is taken AFTER weekend/holiday
    Example: Weekend (Sat-Sun) + Monday leave = Sandwich (weekend counts as leave)
    Example: Friday leave + Weekend = NO Sandwich
    """
    sandwich_days = []
    current = start_date
    
    while current <= end_date:
        if not is_weekend(current) and current not in holidays:
            # Check if this working day comes AFTER a weekend/holiday
            prev_day = current - timedelta(days=1)
            
            # Look back to find if there's a weekend/holiday before this leave day
            if is_weekend(prev_day) or prev_day in holidays:
                # Found weekend/holiday before leave - check if it's a continuous block
                check_day = prev_day
                weekend_holiday_days = []
                
                # Collect all consecutive weekend/holiday days before this leave
                while check_day >= start_date - timedelta(days=7):  # Look back max 7 days
                    if is_weekend(check_day) or check_day in holidays:
                        weekend_holiday_days.append(check_day)
                        check_day -= timedelta(days=1)
                    else:
                        break
                
                # If we found weekend/holiday days, add them as sandwich days
                if weekend_holiday_days:
                    sandwich_days.extend(weekend_holiday_days)
        
        current += timedelta(days=1)
    
    return list(set(sandwich_days))  # Remove duplicates

def apply_sandwich_policy(employee_id, start_date, end_date):
    """
    Apply sandwich leave policy
    Returns: dict with sandwich_days and total_leave_days
    """
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    holidays = get_holidays(start_date.year)
    sandwich_days = get_sandwich_days(start_date, end_date, holidays)
    
    # Calculate total leave days including sandwich days
    total_days = 0
    current = start_date
    while current <= end_date:
        if not is_weekend(current) and current not in holidays:
            total_days += 1
        current += timedelta(days=1)
    
    # Add sandwich weekend/holiday days to total
    total_with_sandwich = total_days + len(sandwich_days)
    
    return {
        'sandwich_days': [str(d) for d in sorted(sandwich_days)],
        'sandwich_count': len(sandwich_days),
        'working_days': total_days,
        'total_leave_days': total_with_sandwich,
        'message': f'Sandwich policy: {len(sandwich_days)} weekend/holiday day(s) will be counted as leave. Total: {total_with_sandwich} days'
    }

def check_sandwich_leave(start_date, end_date):
    """
    Check if sandwich policy applies
    Returns warning message if sandwich days detected
    """
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
    
    holidays = get_holidays(start_date.year)
    sandwich_days = get_sandwich_days(start_date, end_date, holidays)
    
    if sandwich_days:
        # Calculate working days
        working_days = 0
        current = start_date
        while current <= end_date:
            if not is_weekend(current) and current not in holidays:
                working_days += 1
            current += timedelta(days=1)
        
        total_days = working_days + len(sandwich_days)
        
        return {
            'has_sandwich': True,
            'sandwich_days': [str(d) for d in sorted(sandwich_days)],
            'count': len(sandwich_days),
            'working_days': working_days,
            'total_days': total_days,
            'warning': f'⚠️ Sandwich Leave Policy: Taking leave after weekend/holiday. {len(sandwich_days)} weekend/holiday day(s) will be counted as leave. Total leave days: {total_days}'
        }
    
    return {'has_sandwich': False, 'count': 0}
