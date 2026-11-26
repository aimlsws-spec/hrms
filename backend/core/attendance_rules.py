"""
attendance_rules.py — Attendance Rules Engine

Rules applied daily (via scheduler at 23:30) and on-demand via API:

  Rule 1 — PRESENCE
    If a biometric punch OR WFH check-in exists for an employee today
    → attendance.status = 'PRESENT'
    If no record exists by end-of-day → INSERT attendance.status = 'ABSENT'

  Rule 2 — LATE ARRIVAL  (threshold: 09:50 AM)
    First check-in time > 09:50 → attendance.is_late = TRUE
    Applies to both WFO (biometric punch_time) and WFH (wfh_attendance.punch_in_at)

  Rule 3 — SALARY DEDUCTION  (company policy)
    Office start 09:30; a check-in after 09:50 is a "late day".
    Every 3 late days in a calendar month → 1 half-day salary deduction
    (3 lates = 1, 6 lates = 2, ...).
    Half-day amount = gross_salary / days_in_month / 2  (same as payroll_engine).
    attendance.beyond_grace is the per-day flag payroll counts; apply_late_flags()
    keeps it, is_late and the monthly summary in sync for every check-in method.

All functions are idempotent — safe to re-run on the same date.
"""

import logging
from datetime import date, datetime, time
from typing import Optional

import mysql.connector
from backend.config import DB_CONFIG

log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

LATE_THRESHOLD         = time(9, 50)    # check-in after this = late day
OFFICE_START           = time(9, 30)
LATE_DEDUCTION_EVERY   = 3              # every 3 late days = 1 half-day deduction
WORKING_DAYS_PER_MONTH = 26            # daily rate base

# Session-based attendance thresholds (new model)
FIRST_HALF_CUTOFF  = time(13, 30)      # punch_in  after  1:30 PM  → FIRST_HALF_LEAVE
SECOND_HALF_CUTOFF = time(14, 15)      # punch_out before 2:15 PM  → SECOND_HALF_LEAVE
MIN_SESSION_HOURS  = 4                 # session duration < 4 h    → HALF_DAY


# ── DB helper ──────────────────────────────────────────────────────────────────

def _db() -> mysql.connector.MySQLConnection:
    return mysql.connector.connect(**DB_CONFIG)


def _cfg(conn, key: str, default: str) -> str:
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT config_value FROM wfh_system_config WHERE config_key=%s", (key,))
        row = cur.fetchone()
        cur.close()
        return row["config_value"] if row else default
    except Exception:
        return default


# ── Rule 1 helpers — first check-in time for an employee on a date ────────────

def _first_biometric_punch(cur, employee_id: str, target_date: date) -> Optional[time]:
    """Biometric punch removed. Returns None."""
    return None


def _first_wfh_checkin(cur, employee_id: str, target_date: date) -> Optional[time]:
    """Return earliest WFH punch-in for this employee on target_date."""
    cur.execute(
        """
        SELECT MIN(punch_in_at) AS first_punch
        FROM wfh_attendance
        WHERE employee_id = %s
          AND DATE(punch_in_at) = %s
          AND status NOT IN ('REJECTED', 'PENDING_SELFIE')
        """,
        (employee_id, target_date),
    )
    row = cur.fetchone()
    if row and row["first_punch"]:
        return row["first_punch"].time() if hasattr(row["first_punch"], "time") else row["first_punch"]
    return None


def _get_first_checkin(cur, employee_id: str, target_date: date) -> Optional[time]:
    """
    Returns the earliest check-in time for an employee on a given date,
    checking both biometric punches and WFH sessions.
    """
    bio = _first_biometric_punch(cur, employee_id, target_date)
    wfh = _first_wfh_checkin(cur, employee_id, target_date)

    if bio and wfh:
        return min(bio, wfh)
    return bio or wfh


# ── Rule 2 — is this time considered late? ────────────────────────────────────

def is_late(checkin_time: time) -> bool:
    return checkin_time > LATE_THRESHOLD


# ── Session helpers (new MIN/MAX model) ───────────────────────────────────────

def get_session_times(
    cur, employee_id: str, target_date: date
) -> "tuple[Optional[datetime], Optional[datetime]]":
    """
    Returns (punch_in, punch_out) as datetime objects combining biometric and WFH sources.
    punch_in  = earliest record across both sources.
    punch_out = latest  record across both sources.

    SQL equivalent:
        SELECT LEAST(bio.min_t, wfh.min_t)       AS punch_in,
               GREATEST(bio.max_t, wfh.max_t)    AS punch_out
        FROM (SELECT MIN/MAX FROM biometric_raw_logs JOIN biometric_employee_map …) bio,
             (SELECT MIN/MAX FROM wfh_attendance …)                                 wfh
    """
    candidates_in:  "list[datetime]" = []
    candidates_out: "list[datetime]" = []

    # ── Biometric (WFO) ──────────────────────────────────────────────────────
    cur.execute(
        """
        SELECT MIN(r.punch_time) AS min_p, MAX(r.punch_time) AS max_p
        FROM   biometric_raw_logs r
        JOIN   biometric_employee_map m
          ON   m.enroll_id = r.enroll_id AND m.is_active = 1
        WHERE  m.employee_id = %s AND DATE(r.punch_time) = %s
        """,
        (employee_id, target_date),
    )
    bio = cur.fetchone()
    if bio and bio["min_p"]:
        candidates_in.append(bio["min_p"])
    if bio and bio["max_p"]:
        candidates_out.append(bio["max_p"])

    # ── WFH (Selfie / Geo) ───────────────────────────────────────────────────
    cur.execute(
        """
        SELECT MIN(punch_in_at) AS min_p,
               MAX(COALESCE(punch_out_at, punch_in_at)) AS max_p
        FROM   wfh_attendance
        WHERE  employee_id = %s
          AND  DATE(punch_in_at) = %s
          AND  status NOT IN ('REJECTED')
        """,
        (employee_id, target_date),
    )
    wfh = cur.fetchone()
    if wfh and wfh["min_p"]:
        candidates_in.append(wfh["min_p"])
    if wfh and wfh["max_p"]:
        candidates_out.append(wfh["max_p"])

    punch_in  = min(candidates_in)  if candidates_in  else None
    punch_out = max(candidates_out) if candidates_out else None
    return punch_in, punch_out


def calculate_attendance_status(
    punch_in:  "Optional[datetime]",
    punch_out: "Optional[datetime]",
) -> str:
    """
    Pure function — derives attendance status from session times.

    Rules (evaluated in order):
      1. No punch_in                              → ABSENT
      2. punch_in.time() > FIRST_HALF_CUTOFF      → FIRST_HALF_LEAVE  (arrived after 1:30 PM)
      3. punch_out.time() < SECOND_HALF_CUTOFF    → SECOND_HALF_LEAVE (left before 2:15 PM)
      4. (punch_out - punch_in) < MIN_SESSION_HOURS → HALF_DAY        (< 4 h total)
      5. Otherwise                                → PRESENT
    """
    if not punch_in:
        return "ABSENT"

    pi_time = punch_in.time() if hasattr(punch_in, "time") else punch_in

    if pi_time > FIRST_HALF_CUTOFF:
        return "FIRST_HALF_LEAVE"

    if punch_out:
        po_time = punch_out.time() if hasattr(punch_out, "time") else punch_out
        if po_time < SECOND_HALF_CUTOFF:
            return "SECOND_HALF_LEAVE"
        duration_h = (punch_out - punch_in).total_seconds() / 3600
        if duration_h < MIN_SESSION_HOURS:
            return "HALF_DAY"

    return "PRESENT"


# ── Session engine: replace mark_absences + mark_late_arrivals ────────────────

def process_daily_sessions(target_date: date) -> dict:
    """
    For every active employee:
      1. get_session_times()           → (punch_in, punch_out) datetime across all sources
      2. calculate_attendance_status() → PRESENT / HALF_DAY / FIRST_HALF_LEAVE /
                                         SECOND_HALF_LEAVE / ABSENT
      3. Upsert attendance with status, check_in, check_out, is_late

    Idempotent — safe to re-run on the same date.
    Called at 23:30 by run_daily_rules().
    """
    log.info("[rules] process_daily_sessions for %s", target_date)
    conn = _db()
    cur  = conn.cursor(dictionary=True)
    counts: "dict[str, int]" = {
        "PRESENT": 0, "ABSENT": 0, "HALF_DAY": 0,
        "FIRST_HALF_LEAVE": 0, "SECOND_HALF_LEAVE": 0,
    }

    try:
        cur.execute("SELECT employee_code FROM employees WHERE status = 'active'")
        employees = [r["employee_code"] for r in cur.fetchall()]

        for emp_id in employees:
            punch_in, punch_out = get_session_times(cur, emp_id, target_date)
            status = calculate_attendance_status(punch_in, punch_out)

            if status == "ABSENT":
                # No selfie/biometric session. Keep any existing non-absent record (HR manual entry,
                # leave, half day) instead of overwriting it with ABSENT.
                cur.execute("SELECT status FROM attendance WHERE employee_id = %s AND date = %s",
                            (emp_id, target_date))
                existing = cur.fetchone()
                if existing and (existing["status"] or "") not in ("", "ABSENT"):
                    counts[existing["status"]] = counts.get(existing["status"], 0) + 1
                    continue

            check_in_str  = punch_in.strftime("%H:%M:%S")  if punch_in  else None
            check_out_str = punch_out.strftime("%H:%M:%S") if punch_out else None
            late_flag     = is_late(punch_in.time()) if punch_in else False

            cur.execute(
                """
                INSERT INTO attendance
                    (employee_id, date, status, check_in, check_out, is_late)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    status    = VALUES(status),
                    check_in  = COALESCE(VALUES(check_in),  check_in),
                    check_out = COALESCE(VALUES(check_out), check_out),
                    is_late   = VALUES(is_late)
                """,
                (emp_id, target_date, status, check_in_str, check_out_str, late_flag),
            )
            counts[status] = counts.get(status, 0) + 1
            log.debug(
                "[rules] %s → %s  in=%s  out=%s",
                emp_id, status, check_in_str, check_out_str,
            )

        conn.commit()
    except Exception as exc:
        log.error("[rules] process_daily_sessions error: %s", exc)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    log.info("[rules] process_daily_sessions done: %s", counts)
    return {"date": str(target_date), "counts": counts}


# ── Rule 1: Mark absent employees ─────────────────────────────────────────────

def mark_absences(target_date: date) -> dict:
    """
    For every active employee with no attendance record on target_date,
    insert an ABSENT record.  Skips employees who already have any record
    (PRESENT, HALF_DAY, ON_LEAVE, etc.).

    Returns a summary dict.
    """
    log.info("[rules] mark_absences for %s", target_date)
    conn = _db()
    cur  = conn.cursor(dictionary=True)
    absent_count = 0
    skipped      = 0

    try:
        cur.execute(
            "SELECT employee_code FROM employees WHERE status = 'active'"
        )
        employees = [r["employee_code"] for r in cur.fetchall()]

        for emp_id in employees:
            # Skip if any attendance record exists for this date
            cur.execute(
                "SELECT 1 FROM attendance WHERE employee_id=%s AND date=%s LIMIT 1",
                (emp_id, target_date),
            )
            if cur.fetchone():
                skipped += 1
                continue

            # Also skip if there's a biometric punch or WFH session (rules haven't run yet for today)
            has_punch = _get_first_checkin(cur, emp_id, target_date)
            if has_punch:
                skipped += 1
                continue

            cur.execute(
                """INSERT INTO attendance (employee_id, date, status)
                   VALUES (%s, %s, 'ABSENT')
                   ON DUPLICATE KEY UPDATE
                     status = IF(status = '', 'ABSENT', status)""",
                (emp_id, target_date),
            )
            absent_count += 1

        conn.commit()
    except Exception as exc:
        log.error("[rules] mark_absences error: %s", exc)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    log.info("[rules] mark_absences done — absent=%d skipped=%d", absent_count, skipped)
    return {"absent_marked": absent_count, "skipped": skipped, "date": str(target_date)}


# ── Rule 2: Flag late arrivals ────────────────────────────────────────────────

def mark_late_arrivals(target_date: date) -> dict:
    """
    For every PRESENT attendance record on target_date, determine the first
    check-in time (biometric or WFH).  If it's after LATE_THRESHOLD, set
    attendance.is_late = TRUE and store the check-in time.

    Also updates attendance.check_in if it's NULL (back-fills from raw logs).
    Returns a summary dict.
    """
    log.info("[rules] mark_late_arrivals for %s", target_date)
    conn = _db()
    cur  = conn.cursor(dictionary=True)
    late_count    = 0
    on_time_count = 0
    no_data_count = 0

    try:
        cur.execute(
            """SELECT employee_id FROM attendance
               WHERE date = %s AND status IN ('PRESENT', 'HALF_DAY')""",
            (target_date,),
        )
        present = [r["employee_id"] for r in cur.fetchall()]

        for emp_id in present:
            first_in = _get_first_checkin(cur, emp_id, target_date)
            if first_in is None:
                no_data_count += 1
                continue

            time_str = first_in.strftime("%H:%M:%S")
            flag     = is_late(first_in)

            cur.execute(
                """UPDATE attendance
                   SET is_late  = %s,
                       check_in = COALESCE(check_in, %s)
                   WHERE employee_id = %s AND date = %s""",
                (flag, time_str, emp_id, target_date),
            )
            if flag:
                late_count += 1
                log.debug("[rules] LATE: %s checked in at %s", emp_id, time_str)
            else:
                on_time_count += 1

        conn.commit()
    except Exception as exc:
        log.error("[rules] mark_late_arrivals error: %s", exc)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    log.info(
        "[rules] mark_late_arrivals done — late=%d on_time=%d no_data=%d",
        late_count, on_time_count, no_data_count,
    )
    return {
        "late_flagged": late_count,
        "on_time":      on_time_count,
        "no_checkin":   no_data_count,
        "date":         str(target_date),
    }


# ── Rule 3: Monthly deduction calculation ─────────────────────────────────────

def recalculate_monthly_deductions(year: int, month: int) -> dict:
    """
    For every active employee, count HALF_DAY / FIRST_HALF_LEAVE / SECOND_HALF_LEAVE
    days in the given month.  Each event = exactly 1 half-day deduction (no threshold).

    Half-day deduction amount = gross_salary / (WORKING_DAYS_PER_MONTH * 2)
    Falls back to 0 if no salary record found.

    Returns a summary dict.
    """
    log.info("[rules] recalculate_monthly_deductions for %d-%02d", year, month)
    conn = _db()
    cur  = conn.cursor(dictionary=True)
    updated = 0
    skipped = 0

    try:
        cur.execute("SELECT employee_code FROM employees WHERE status = 'active'")
        employees = [r["employee_code"] for r in cur.fetchall()]

        for emp_id in employees:
            # Count half-day-equivalent events for this month
            cur.execute(
                """SELECT COUNT(*) AS half_day_events
                   FROM attendance
                   WHERE employee_id = %s
                     AND YEAR(date)  = %s
                     AND MONTH(date) = %s
                     AND status IN ('HALF_DAY', 'FIRST_HALF_LEAVE', 'SECOND_HALF_LEAVE')""",
                (emp_id, year, month),
            )
            row = cur.fetchone()
            half_day_events = row["half_day_events"] if row else 0

            # Upsert monthly_late_summary (tracks half-day events for this period)
            cur.execute(
                """INSERT INTO monthly_late_summary
                       (employee_id, year, month, late_days, deduction_triggered)
                   VALUES (%s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                       late_days           = VALUES(late_days),
                       deduction_triggered = VALUES(deduction_triggered),
                       updated_at          = CURRENT_TIMESTAMP""",
                (emp_id, year, month, half_day_events, half_day_events > 0),
            )

            if half_day_events == 0:
                skipped += 1
                continue

            # Look up gross salary to calculate deduction amount
            cur.execute(
                """SELECT COALESCE(es.gross_salary, ss.gross_salary, 0) AS gross
                   FROM employees e
                   LEFT JOIN employee_salaries es
                     ON es.employee_id = e.employee_code AND es.status = 'active'
                   LEFT JOIN salary_structures ss
                     ON ss.employee_id = e.employee_code AND ss.status = 'active'
                   WHERE e.employee_code = %s
                   LIMIT 1""",
                (emp_id,),
            )
            sal = cur.fetchone()
            gross           = float(sal["gross"]) if sal and sal["gross"] else 0.0
            half_day_rate   = round(gross / (WORKING_DAYS_PER_MONTH * 2), 2)
            total_deduction = round(half_day_rate * half_day_events, 2)

            # Upsert attendance_deductions
            cur.execute(
                """INSERT INTO attendance_deductions
                       (employee_id, year, month, deduction_type,
                        late_count, half_days_deducted, amount)
                   VALUES (%s, %s, %s, 'HALF_DAY_SESSION', %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                       late_count          = VALUES(late_count),
                       half_days_deducted  = VALUES(half_days_deducted),
                       amount              = VALUES(amount),
                       updated_at          = CURRENT_TIMESTAMP""",
                (emp_id, year, month, half_day_events, half_day_events, total_deduction),
            )
            updated += 1
            log.info(
                "[rules] deduction — %s: %d half-day event(s) → ₹%.2f",
                emp_id, half_day_events, total_deduction,
            )

        conn.commit()
    except Exception as exc:
        log.error("[rules] recalculate_monthly_deductions error: %s", exc)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    log.info(
        "[rules] recalculate_monthly_deductions done — updated=%d skipped=%d",
        updated, skipped,
    )
    return {
        "year": year, "month": month,
        "employees_with_deductions": updated,
        "employees_no_deduction":    skipped,
    }


# ── Entry point: run all rules for a date ─────────────────────────────────────

def run_daily_rules(target_date: Optional[date] = None) -> dict:
    """
    Run the full rules pipeline for target_date (defaults to today).
    Called by the scheduler daily at 23:30.

    Order:
      1. process_daily_sessions() — compute final PRESENT/HALF_DAY/FIRST_HALF_LEAVE/
                                    SECOND_HALF_LEAVE/ABSENT for all employees
      2. recalculate_monthly_deductions() — apply 0.5-day deduction per half-day event
    """
    if target_date is None:
        target_date = date.today()

    log.info("[rules] === run_daily_rules for %s ===", target_date)

    session_result = process_daily_sessions(target_date)
    deduct_result  = recalculate_monthly_deductions(target_date.year, target_date.month)

    summary = {
        "date":        str(target_date),
        "sessions":    session_result,
        "deductions":  deduct_result,
        "run_at":      datetime.now().isoformat(),
    }
    log.info("[rules] === run_daily_rules complete: %s ===", summary)
    return summary


# ── WFO auto-process: mark attendance from biometric punches during the day ───

def auto_process_wfo_attendance(target_date=None) -> dict:
    """Biometric machine punch integration removed."""
    return {"date": str(target_date or date.today()), "processed": 0, "pending_no_punch": 0}


# ── Helper: get monthly late summary for a single employee ────────────────────

def get_employee_late_summary(employee_id: str, year: int, month: int) -> dict:
    conn = _db()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            """SELECT mls.late_days, mls.deduction_triggered,
                      ad.half_days_deducted, ad.amount, ad.payroll_processed
               FROM monthly_late_summary mls
               LEFT JOIN attendance_deductions ad
                 ON ad.employee_id = mls.employee_id
                AND ad.year        = mls.year
                AND ad.month       = mls.month
                AND ad.deduction_type = 'LATE_ARRIVAL'
               WHERE mls.employee_id = %s
                 AND mls.year  = %s
                 AND mls.month = %s""",
            (employee_id, year, month),
        )
        row = cur.fetchone()
        return row or {
            "late_days": 0,
            "deduction_triggered": False,
            "half_days_deducted": 0,
            "amount": 0,
            "payroll_processed": False,
        }
    finally:
        cur.close()
        conn.close()



# ── Late flags for a single check-in (selfie / geo / any method) ──────────────

def apply_late_flags(cur, employee_id: str, target_date: date, check_in: time) -> dict:
    """
    Apply the late-arrival policy for one check-in. Caller owns the transaction.

      - attendance.late_minutes / early_minutes / beyond_grace / is_late
      - monthly_late_summary.late_days  (count of late days this month)
      - attendance_deductions 'LATE_ARRIVAL' (half-days = lates // 3, amount in INR)
    """
    import calendar

    late_flag    = check_in > LATE_THRESHOLD
    mins         = check_in.hour * 60 + check_in.minute
    start_mins   = OFFICE_START.hour * 60 + OFFICE_START.minute
    cur.execute(
        """UPDATE attendance
           SET late_minutes  = %s,
               early_minutes = %s,
               beyond_grace  = %s,
               is_late       = %s
           WHERE employee_id = %s AND date = %s""",
        (max(0, mins - start_mins), max(0, start_mins - mins),
         1 if late_flag else 0, late_flag, employee_id, target_date),
    )

    y, m = target_date.year, target_date.month
    cur.execute(
        """SELECT COUNT(*) AS n FROM attendance
           WHERE employee_id = %s AND YEAR(date) = %s AND MONTH(date) = %s
             AND beyond_grace = 1 AND status NOT IN ('ON_LEAVE', 'ABSENT')""",
        (employee_id, y, m),
    )
    late_days = int((cur.fetchone() or {}).get("n", 0) or 0)

    cur.execute(
        """SELECT gross_salary FROM employee_salaries
           WHERE employee_id = %s AND status = 'active'
           ORDER BY id DESC LIMIT 1""",
        (employee_id,),
    )
    sal   = cur.fetchone()
    gross = float(sal["gross_salary"]) if sal and sal.get("gross_salary") else 0.0
    half_day_rate = gross / calendar.monthrange(y, m)[1] / 2
    suggested_amount = round(1 * half_day_rate, 2)

    # Check for existing deduction review record
    cur.execute(
        """SELECT id, status, half_days_deducted, amount FROM attendance_deductions
           WHERE employee_id = %s AND year = %s AND month = %s AND deduction_type = 'LATE_ARRIVAL'""",
        (employee_id, y, m),
    )
    existing_ded = cur.fetchone()

    half_days = 0
    amount = 0.0

    if late_days >= 4:
        # Trigger HR review on fourth arrival after 9:50 AM (more than 3 lates)
        if not existing_ded:
            # First time reaching 4 late arrivals: create pending review record
            cur.execute(
                """INSERT INTO attendance_deductions
                       (employee_id, year, month, deduction_type, late_count, half_days_deducted, amount, status)
                   VALUES (%s, %s, %s, 'LATE_ARRIVAL', %s, 1, %s, 'PENDING_REVIEW')""",
                (employee_id, y, m, late_days, suggested_amount),
            )
            # Notify HR & Admin for review decision
            try:
                cur.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin') AND COALESCE(is_active, 1) = 1")
                hr_users = [r["user_id"] for r in cur.fetchall() if r.get("user_id")]
                cur.execute(
                    """SELECT full_name FROM users WHERE user_id = %s
                       UNION SELECT full_name FROM employees WHERE employee_code = %s LIMIT 1""",
                    (employee_id, employee_id),
                )
                emp_row = cur.fetchone()
                emp_name = emp_row["full_name"] if emp_row and emp_row.get("full_name") else employee_id

                for hr_uid in hr_users:
                    cur.execute(
                        """INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                           VALUES (%s, %s, %s, 'LATE_REVIEW', 0, NOW())""",
                        (
                            hr_uid,
                            f"Late-Arrival Review: {emp_name}",
                            f"{emp_name} ({employee_id}) has arrived late 4 times this month (after 09:50 AM). Action required: Review and decide whether to apply a half-day salary deduction or ignore it.",
                        ),
                    )
            except Exception as notif_err:
                log.warning("Failed to dispatch late review notification: %s", notif_err)
        else:
            # Record already exists; update late_count
            if existing_ded.get("status") == "PENDING_REVIEW":
                cur.execute(
                    """UPDATE attendance_deductions
                       SET late_count = %s, amount = %s
                       WHERE id = %s""",
                    (late_days, suggested_amount, existing_ded["id"]),
                )
            elif existing_ded.get("status") == "APPLIED":
                half_days = int(existing_ded.get("half_days_deducted") or 1)
                amount = float(existing_ded.get("amount") or suggested_amount)
                cur.execute("UPDATE attendance_deductions SET late_count = %s WHERE id = %s", (late_days, existing_ded["id"]))
            else:
                # IGNORED
                cur.execute("UPDATE attendance_deductions SET late_count = %s WHERE id = %s", (late_days, existing_ded["id"]))
    else:
        # Fewer than 4 late arrivals
        if existing_ded and existing_ded.get("status") == "PENDING_REVIEW":
            cur.execute(
                """UPDATE attendance_deductions
                   SET late_count = %s
                   WHERE id = %s""",
                (late_days, existing_ded["id"]),
            )

    is_applied = bool(existing_ded and existing_ded.get("status") == "APPLIED")
    cur.execute(
        """INSERT INTO monthly_late_summary (employee_id, year, month, late_days, deduction_triggered)
           VALUES (%s, %s, %s, %s, %s)
           ON DUPLICATE KEY UPDATE late_days = VALUES(late_days),
                                   deduction_triggered = VALUES(deduction_triggered)""",
        (employee_id, y, m, late_days, is_applied),
    )
    return {"late": late_flag, "late_days": late_days, "half_days": half_days, "amount": amount, "pending_review": (late_days >= 4 and not is_applied)}
