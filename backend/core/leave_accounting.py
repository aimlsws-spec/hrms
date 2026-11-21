"""
Leave accounting engine.

Keeps leave_balance as the fast current-balance table, and leave_ledger as the
auditable source of why balances changed.
"""

import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import mysql.connector

from backend.config import DB_CONFIG

log = logging.getLogger(__name__)

MONTHLY_CREDIT = {
    "SL": Decimal("0.50"),
    "CL": Decimal("0.50"),
    "PL": Decimal("0.50"),
}

BALANCE_COLUMNS = {
    "SL": "sick_leave",
    "CL": "casual_leave",
    "PL": "earned_leave",
}


def _db() -> mysql.connector.MySQLConnection:
    return mysql.connector.connect(**DB_CONFIG)


def quantize_days(value) -> Decimal:
    """Normalize leave values to two decimal places."""
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_month_opening(previous_closing, monthly_credit) -> Decimal:
    """Pure carry-forward function: previous closing + this month's credit."""
    return quantize_days(previous_closing) + quantize_days(monthly_credit)


def period_for(target_date: date) -> str:
    return target_date.strftime("%Y-%m")


def leave_type_code(leave_type: str) -> str:
    normalized = (leave_type or "").strip().lower()
    if "sick" in normalized or normalized == "sl":
        return "SL"
    if "earn" in normalized or "paid" in normalized or "annual" in normalized or normalized == "pl":
        return "PL"
    return "CL"


def ensure_leave_ledger_table(cursor) -> None:
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leave_ledger (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            period CHAR(7) NOT NULL,
            leave_type VARCHAR(10) NOT NULL,
            transaction_type VARCHAR(30) NOT NULL,
            days DECIMAL(6,2) NOT NULL,
            balance_after DECIMAL(6,2) NOT NULL,
            reference_type VARCHAR(50) NULL,
            reference_id VARCHAR(50) NULL,
            idempotency_key VARCHAR(120) NOT NULL,
            remarks TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_leave_ledger_idempotency (idempotency_key),
            INDEX idx_employee_period (employee_id, period),
            INDEX idx_reference (reference_type, reference_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)


def ensure_leave_accounting_tables() -> None:
    conn = _db()
    cur = conn.cursor()
    try:
        ensure_leave_ledger_table(cur)
        conn.commit()
    finally:
        cur.close()
        conn.close()


def _get_active_employee_ids(cursor) -> list[str]:
    cursor.execute("""
        SELECT employee_code
        FROM employees
        WHERE LOWER(COALESCE(status, 'active')) = 'active'
    """)
    return [row["employee_code"] for row in cursor.fetchall()]


def _ensure_balance_row(cursor, employee_id: str) -> None:
    current_year = date.today().year
    cursor.execute(
        """
        INSERT IGNORE INTO leave_balance
            (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
        VALUES (%s, %s, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00)
        """,
        (employee_id, current_year),
    )


def _fetch_balance_for_update(cursor, employee_id: str) -> dict:
    _ensure_balance_row(cursor, employee_id)
    cursor.execute(
        """
        SELECT year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total
        FROM leave_balance
        WHERE employee_id = %s
        FOR UPDATE
        """,
        (employee_id,),
    )
    row = cursor.fetchone() or {}
    current_year = date.today().year
    rec_year = row.get("year") or current_year
    if rec_year < current_year:
        c_tot = row.get("casual_total") or Decimal("12.00")
        s_tot = row.get("sick_total") or Decimal("12.00")
        e_tot = row.get("earned_total") or Decimal("12.00")
        cursor.execute(
            """
            UPDATE leave_balance
            SET year = %s, casual_leave = %s, sick_leave = %s, earned_leave = %s
            WHERE employee_id = %s
            """,
            (current_year, c_tot, s_tot, e_tot, employee_id),
        )
        row["casual_leave"] = c_tot
        row["sick_leave"] = s_tot
        row["earned_leave"] = e_tot
        row["year"] = current_year
    return row


def record_leave_debit(
    cursor,
    *,
    employee_id: str,
    leave_type: str,
    days: float,
    reference_type: str = "LEAVE_REQUEST",
    reference_id: Optional[str] = None,
    remarks: str = "",
    target_date: Optional[date] = None,
) -> dict:
    """Record an approved paid-leave debit in the ledger and current balance."""
    debit_days = quantize_days(days)
    if debit_days <= 0:
        return {"created": False, "balance_after": None, "reason": "zero_days"}

    target_date = target_date or date.today()
    period = period_for(target_date)
    code = leave_type_code(leave_type)
    column = BALANCE_COLUMNS[code]
    ref_id = str(reference_id or "")
    idempotency_key = f"{employee_id}:{period}:{code}:DEBIT:{reference_type}:{ref_id}"

    balance = _fetch_balance_for_update(cursor, employee_id)
    previous_balance = quantize_days(balance.get(column))
    balance_after = max(Decimal("0.00"), previous_balance - debit_days)

    cursor.execute(
        """
        INSERT IGNORE INTO leave_ledger
            (employee_id, period, leave_type, transaction_type, days, balance_after,
             reference_type, reference_id, idempotency_key, remarks)
        VALUES
            (%s, %s, %s, 'DEBIT', %s, %s, %s, %s, %s, %s)
        """,
        (
            employee_id,
            period,
            code,
            -debit_days,
            balance_after,
            reference_type,
            ref_id or None,
            idempotency_key,
            remarks or f"Approved {leave_type} debit",
        ),
    )
    created = cursor.rowcount == 1
    if created:
        cursor.execute(
            f"UPDATE leave_balance SET {column} = %s WHERE employee_id = %s",
            (balance_after, employee_id),
        )

    return {"created": created, "balance_after": balance_after, "leave_type": code}


def credit_monthly_leaves(target_date: Optional[date] = None, conn=None) -> dict:
    """
    Idempotently add 0.5 SL, 0.5 CL, and 0.5 PL to each active employee.
    Current leave_balance is treated as the previous period closing balance.
    """
    target_date = target_date or date.today()
    period = period_for(target_date)
    owns_connection = conn is None
    conn = conn or _db()
    cur = conn.cursor(dictionary=True)

    result = {
        "success": True,
        "period": period,
        "employees": 0,
        "ledger_rows_created": 0,
        "already_credited_rows": 0,
    }

    try:
        ensure_leave_ledger_table(cur)
        employee_ids = _get_active_employee_ids(cur)
        result["employees"] = len(employee_ids)

        for employee_id in employee_ids:
            balance = _fetch_balance_for_update(cur, employee_id)
            for leave_type, credit in MONTHLY_CREDIT.items():
                column = BALANCE_COLUMNS[leave_type]
                previous_closing = quantize_days(balance.get(column))
                balance_after = calculate_month_opening(previous_closing, credit)
                idempotency_key = f"{employee_id}:{period}:{leave_type}:MONTHLY_CREDIT"

                cur.execute(
                    """
                    INSERT IGNORE INTO leave_ledger
                        (employee_id, period, leave_type, transaction_type, days,
                         balance_after, reference_type, idempotency_key, remarks)
                    VALUES
                        (%s, %s, %s, 'MONTHLY_CREDIT', %s, %s,
                         'MONTHLY_ACCRUAL', %s, %s)
                    """,
                    (
                        employee_id,
                        period,
                        leave_type,
                        credit,
                        balance_after,
                        idempotency_key,
                        f"Monthly {leave_type} credit with carry-forward",
                    ),
                )

                if cur.rowcount == 1:
                    cur.execute(
                        f"UPDATE leave_balance SET {column} = %s WHERE employee_id = %s",
                        (balance_after, employee_id),
                    )
                    balance[column] = balance_after
                    result["ledger_rows_created"] += 1
                else:
                    result["already_credited_rows"] += 1

        conn.commit()
    except Exception:
        conn.rollback()
        log.exception("[leave-accounting] monthly credit failed for %s", period)
        raise
    finally:
        cur.close()
        if owns_connection:
            conn.close()

    return result


def credit_monthly_leaves_job() -> None:
    result = credit_monthly_leaves()
    log.info("[leave-accounting] monthly credit complete: %s", result)
