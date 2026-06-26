#!/usr/bin/env python3
"""
Script to recalculate unpaid_days for existing approved leave requests.
This ensures consistency with the new leave approval logic.
"""

import mysql.connector
from config import DB_CONFIG

def _leave_type_column(leave_type: str) -> str:
    """Map leave type to balance column name."""
    normalized = (leave_type or "").strip().lower()
    if "sick" in normalized:
        return "sick_leave"
    if "earn" in normalized or "paid" in normalized or "annual" in normalized:
        return "earned_leave"
    return "casual_leave"

def recalculate_approved_leaves():
    """Recalculate unpaid_days for approved leave requests."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Find approved leaves that need recalculation (no unpaid_days set)
        cursor.execute("""
            SELECT id, employee_id, leave_type, days_count, start_date, end_date, is_unpaid, unpaid_days
            FROM leave_requests
            WHERE status = 'Approved'
            AND (COALESCE(unpaid_days, 0) = 0 OR is_unpaid IS NULL)
            ORDER BY id
        """)
        
        leaves = cursor.fetchall()
        
        if not leaves:
            print("✓ No leaves need recalculation")
            conn.close()
            return
        
        print(f"Found {len(leaves)} leaves to recalculate...")
        updated = 0
        
        for leave in leaves:
            leave_id = leave['id']
            employee_id = leave['employee_id']
            leave_type = leave['leave_type']
            days_requested = float(leave['days_count'] or 0)
            
            if days_requested <= 0:
                continue
            
            # Get available balance for this leave type
            col = _leave_type_column(leave_type)
            cursor.execute(f"""
                SELECT {col} FROM leave_balance WHERE employee_id = %s
            """, (employee_id,))
            bal_row = cursor.fetchone()
            available_balance = float(bal_row[col] or 0) if bal_row else 0
            
            # Calculate paid and unpaid days
            paid_days = min(days_requested, available_balance)
            unpaid_days = max(0, days_requested - available_balance)
            is_unpaid = 1 if unpaid_days > 0 else 0
            
            # Update leave_requests with unpaid_days
            cursor.execute("""
                UPDATE leave_requests
                SET is_unpaid = %s, unpaid_days = %s
                WHERE id = %s
            """, (is_unpaid, unpaid_days, leave_id))
            
            # Deduct paid days from leave_balance
            if paid_days > 0:
                cursor.execute(f"""
                    UPDATE leave_balance
                    SET {col} = GREATEST(0, COALESCE({col}, 0) - %s)
                    WHERE employee_id = %s
                """, (paid_days, employee_id))
            
            print(f"  ✓ Leave #{leave_id}: {employee_id} - {leave_type}")
            print(f"    - Requested: {days_requested}, Paid: {paid_days}, Unpaid: {unpaid_days}")
            updated += 1
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\n✓ Successfully recalculated {updated} leaves")
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Recalculating unpaid_days for approved leaves...")
    recalculate_approved_leaves()
