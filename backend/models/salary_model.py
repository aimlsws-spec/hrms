"""
Salary data-access layer.

Pure persistence — raw SQL against `employees` / `employee_salaries`.
No business logic, no HTTP concerns. Returns raw rows (dicts) or None.
"""

from .db import get_connection


def fetch_all_with_latest_salary():
    """Every active employee joined to their latest *active* salary (if any)."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT
                e.employee_code                              AS employee_id,
                e.full_name                                  AS name,
                COALESCE(e.department, 'N/A')               AS department,
                e.joining_date                               AS joined_on,
                e.default_work_mode                          AS work_mode,
                e.title                                      AS designation,
                es.id                                        AS salary_id,
                es.ctc,
                COALESCE(es.basic_salary, 0)                 AS basic_salary,
                COALESCE(es.hra, 0)                          AS hra,
                COALESCE(es.da, 0)                           AS da,
                COALESCE(es.transport_allowance, 0)          AS transport_allowance,
                COALESCE(es.medical_allowance, 0)            AS medical_allowance,
                COALESCE(es.special_allowance, 0)            AS special_allowance,
                COALESCE(es.gross_salary, 0)                 AS gross_salary,
                COALESCE(es.pf_deduction, 0)                 AS pf_deduction,
                COALESCE(es.esi_deduction, 0)                AS esi_deduction,
                COALESCE(es.professional_tax, 0)             AS professional_tax,
                COALESCE(es.income_tax, 0)                   AS income_tax,
                COALESCE(es.total_deductions, 0)             AS total_deductions,
                COALESCE(es.net_salary, 0)                   AS net_salary,
                es.effective_from
            FROM employees e
            LEFT JOIN employee_salaries es
                   ON es.employee_id = e.employee_code
                  AND es.id = (
                      SELECT MAX(id)
                      FROM employee_salaries
                      WHERE employee_id = e.employee_code AND status = 'active'
                  )
            WHERE e.status = 'active'
            ORDER BY e.full_name
        """)
        return cur.fetchall()
    finally:
        cur.close()
        conn.close()


def update_designation(employee_id: str, designation: str):
    """Set the employee's job title (employees.title)."""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE employees SET title = %s WHERE employee_code = %s", (designation, employee_id))
        conn.commit()
    finally:
        cur.close()
        conn.close()


def fetch_latest_active(employee_id: str):
    """Latest active salary row for one employee, or None."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT es.*
            FROM employee_salaries es
            JOIN (
                SELECT employee_id, MAX(id) AS max_id
                FROM employee_salaries
                WHERE status = 'active'
                GROUP BY employee_id
            ) _lat ON es.id = _lat.max_id
            WHERE es.employee_id = %s
        """, (employee_id,))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()


def upsert_active_salary(emp_id: str, vals: dict, effective_from: str):
    """
    Insert or update the active salary for an employee.

    Updates an existing row with the same effective_from; otherwise revises the
    current active row(s) and inserts a new one. `vals` carries the fully
    computed components (gross/net already calculated by the service layer).
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE employee_salaries
            SET ctc = %s, basic_salary = %s, hra = %s, da = %s,
                transport_allowance = %s, medical_allowance = %s, special_allowance = %s,
                gross_salary = %s, pf_deduction = %s, esi_deduction = %s,
                professional_tax = %s, income_tax = %s, total_deductions = %s,
                net_salary = %s, status = 'active'
            WHERE employee_id = %s AND effective_from = %s
        """, (vals['ctc'], vals['basic_salary'], vals['hra'], vals['da'],
              vals['transport'], vals['medical'], vals['special'],
              vals['gross'], vals['pf_deduction'], vals['esi_deduction'],
              vals['professional_tax'], vals['income_tax'],
              vals['total_deductions'], vals['net_salary'], emp_id, effective_from))

        if cur.rowcount > 0:
            # Updated existing dated record — revise any OTHER active records
            cur.execute("""
                UPDATE employee_salaries
                SET status = 'revised'
                WHERE employee_id = %s AND status = 'active' AND effective_from != %s
            """, (emp_id, effective_from))
        else:
            # No record for this date — revise current active, then insert new
            cur.execute("""
                UPDATE employee_salaries
                SET status = 'revised'
                WHERE employee_id = %s AND status = 'active'
            """, (emp_id,))
            cur.execute("""
                INSERT INTO employee_salaries
                    (employee_id, ctc, basic_salary, hra, da, transport_allowance,
                     medical_allowance, special_allowance, gross_salary, pf_deduction,
                     esi_deduction, professional_tax, income_tax, total_deductions,
                     net_salary, effective_from, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            """, (emp_id, vals['ctc'], vals['basic_salary'], vals['hra'], vals['da'],
                  vals['transport'], vals['medical'], vals['special'], vals['gross'],
                  vals['pf_deduction'], vals['esi_deduction'], vals['professional_tax'],
                  vals['income_tax'], vals['total_deductions'], vals['net_salary'],
                  effective_from))

        conn.commit()
    finally:
        cur.close()
        conn.close()
