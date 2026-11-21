"""
biometric_processor.py — Phase 4 + Auto-Provisioning

Two-stage pipeline (STAGES ARE INDEPENDENT — Stage 2 always runs):

  Stage 1 — Auto-Provision:
    For every enroll_id in raw_logs that has no active mapping, query the
    IDMS SQL Server for the person's name (table set by IDMS_USER_TABLE below).
      • If exactly ONE active HRMS employee matches the name → create mapping.
      • If no unique match → create a provisional BIO_XXXX employee record
        + mapping so attendance always flows to the dashboard automatically.
    Commit all new employees / mappings before Stage 2 so the JOIN picks them up.
    If Stage 1 fails (wrong table name, connection error, etc.) it logs a
    warning and CONTINUES — Stage 2 will still process all punches that
    already have a valid mapping.

  Stage 2 — Process:
    Standard punch → attendance conversion.
    First punch of the day = check_in, last = check_out.
    Never overwrites MANUAL / REGULARIZED records.
"""

import os
import logging
from datetime import datetime, date, timedelta, time
from collections import defaultdict
from typing import Optional

import mysql.connector
try:
    import pyodbc
except ImportError:  # optional: only needed for the legacy IDMS biometric sync
    import types as _types
    pyodbc = _types.SimpleNamespace(Connection=object, connect=None)  # stub so annotations still load

logger = logging.getLogger("biometric_processor")

# ─────────────────────────────────────────────────────────────────────────────
# IDMS user-table configuration
#
# Table confirmed: tblemployee (296 employee records)
# UserInfo was empty — tblemployee is the authoritative employee store.
#
# IMPORTANT: The ID and name column names below are placeholders.
# Run  python inspect_tblemployee.py  to discover the exact column names
# and the "RECOMMENDED CONFIGURATION" block it prints will give you the
# exact values to paste here.
#
# What each variable means:
#   IDMS_USER_TABLE          — table that holds enrolled employees
#   IDMS_USER_ID_COL         — column whose value matches tbl_realtime_glog.user_id
#                              (the biometric enroll_id — NOT the HR employee number)
#   IDMS_USER_FIRST_NAME_COL — first-name column  (or full-name if stored in one col)
#   IDMS_USER_LAST_NAME_COL  — last-name column   (leave "" if name is a single column)
#   IDMS_USER_DEPT_COL       — department column  (leave "" if none)
#   IDMS_USER_ACTIVE_FILTER  — SQL fragment for active users
#                              e.g. "IsActive = 1" or "IsDeleted = 0"
#                              leave "" to return all rows
#
# Override any value via environment variable without touching this file:
#   $env:IDMS_USER_TABLE = "tblemployee"
# ─────────────────────────────────────────────────────────────────────────────

# ── Column mapping — tbl_realtime_userinfo (confirmed has data) ───────────────
#
#  tblemployee is empty on this installation — no HR records imported into it.
#
#  tbl_realtime_userinfo is the correct source:
#   • Shares the tbl_realtime_* family with tbl_realtime_glog
#   • user_id in this table IS the biometric enroll_id (same namespace)
#   • user_name holds the single full-name string
#   • Confirmed to have actual data from idms_inspect.py run
#   • No IsDeleted / active flag — all rows are valid enrolled users
#
#  Fallback option (also has data, different column names):
#   IDMS_USER_TABLE           = Userdetail
#   IDMS_USER_ID_COL          = UserID
#   IDMS_USER_FIRST_NAME_COL  = Name
#   IDMS_USER_ACTIVE_FILTER   = IsDeleted IS NULL OR IsDeleted NOT IN ('Y','1')

IDMS_USER_TABLE: str = os.getenv("IDMS_USER_TABLE", "tbl_realtime_userinfo")

# user_id directly matches tbl_realtime_glog.user_id — same system, same namespace
IDMS_USER_ID_COL: str = os.getenv("IDMS_USER_ID_COL", "user_id")

# Single full-name column — no split first/last in tbl_realtime_userinfo
IDMS_USER_FIRST_NAME_COL: str = os.getenv("IDMS_USER_FIRST_NAME_COL", "user_name")
IDMS_USER_LAST_NAME_COL:  str = os.getenv("IDMS_USER_LAST_NAME_COL",  "")

# No department column in tbl_realtime_userinfo
IDMS_USER_DEPT_COL: str = os.getenv("IDMS_USER_DEPT_COL", "")

# No active/deleted flag in tbl_realtime_userinfo — all rows are enrolled users
IDMS_USER_ACTIVE_FILTER: str = os.getenv("IDMS_USER_ACTIVE_FILTER", "")

# ── Startup diagnostic ───────────────────────────────────────────────────────

def run_startup_diagnostic() -> bool:
    """
    Runs once when the sync worker boots.  Verifies the IDMS table/column
    config is correct by running a TOP-5 SELECT and printing the results.

    Returns True if the table is reachable and has rows, False otherwise.
    Callers should still continue — a False return means auto-provisioning
    will use placeholder names, but attendance processing is unaffected.
    """
    _DIV = "=" * 62

    # Rebuild the same expressions the live lookup uses
    if IDMS_USER_FIRST_NAME_COL and IDMS_USER_LAST_NAME_COL:
        name_expr_diag = (
            f"NULLIF(LTRIM(RTRIM("
            f"ISNULL({IDMS_USER_FIRST_NAME_COL},'') + ' ' + "
            f"ISNULL({IDMS_USER_LAST_NAME_COL},''))), '')"
        )
        name_cols_display = f"{IDMS_USER_FIRST_NAME_COL} + ' ' + {IDMS_USER_LAST_NAME_COL}"
    elif IDMS_USER_FIRST_NAME_COL:
        name_expr_diag    = f"NULLIF(LTRIM(RTRIM(ISNULL({IDMS_USER_FIRST_NAME_COL},''))), '')"
        name_cols_display = IDMS_USER_FIRST_NAME_COL
    else:
        name_expr_diag    = "NULL"
        name_cols_display = "(none — name resolution disabled)"

    dept_expr = (
        f"ISNULL(NULLIF(LTRIM(RTRIM({IDMS_USER_DEPT_COL})), ''), NULL)"
        if IDMS_USER_DEPT_COL
        else "NULL"
    )
    active_where = (
        f"WHERE ({IDMS_USER_ACTIVE_FILTER})"
        if IDMS_USER_ACTIVE_FILTER.strip()
        else ""
    )

    fq_table = _fq(IDMS_USER_TABLE)  # e.g. `idms`.`UserInfo`

    sample_sql = (
        f"SELECT \n"
        f"    CAST({IDMS_USER_ID_COL} AS VARCHAR(64)) AS user_id,\n"
        f"    {name_expr_diag}                         AS name,\n"
        f"    {dept_expr}                              AS department\n"
        f"FROM {fq_table}\n"
        f"{active_where}"
    ).rstrip()

    active_and = f"  AND ({IDMS_USER_ACTIVE_FILTER})" if IDMS_USER_ACTIVE_FILTER.strip() else ""
    lookup_sql = (
        f"SELECT \n"
        f"    CAST({IDMS_USER_ID_COL} AS VARCHAR(64)) AS user_id,\n"
        f"    {name_expr_diag}                         AS name,\n"
        f"    {dept_expr}                              AS department\n"
        f"FROM {fq_table}\n"
        f"WHERE CAST({IDMS_USER_ID_COL} AS VARCHAR(64)) = '<ENROLL_ID_HERE>'\n"
        f"{active_and}"
    ).rstrip()

    print(f"\n{_DIV}")
    print("  IDMS CONFIGURATION DIAGNOSTIC")
    print(_DIV)
    print(f"  Table        : {IDMS_USER_TABLE}")
    print(f"  ID column    : {IDMS_USER_ID_COL}")
    print(f"  Name columns : {name_cols_display}")
    print(f"  Dept column  : {IDMS_USER_DEPT_COL or '(none)'}")
    print(f"  Active filter: {IDMS_USER_ACTIVE_FILTER or '(none)'}")
    print(f"\n  Sample SQL (TOP 5 — paste into SSMS to verify):\n")
    for line in sample_sql.splitlines():
        print(f"    {line}")
    print(f"\n  Per-lookup SQL (replace <ENROLL_ID_HERE>):\n")
    for line in lookup_sql.splitlines():
        print(f"    {line}")

    conn = None
    try:
        conn   = _get_idms_db()   # prints "[IDMS] Connection OK — database: idms"
        cursor = conn.cursor()

        # ── Confirm the active DB before running any table query ──────────────
        cursor.execute("SELECT DB_NAME(), @@SERVERNAME")
        db_row    = cursor.fetchone()
        actual_db = db_row[0] if db_row else "UNKNOWN"
        server    = db_row[1] if db_row else "UNKNOWN"
        print(f"\n  Active connection:")
        print(f"    Server   : {server}")
        print(f"    Database : {actual_db}   {'← CORRECT' if actual_db.lower() == _IDMS_DATABASE.lower() else f'← *** WRONG (expected {_IDMS_DATABASE}) ***'}")
        print(f"    FQ table : {fq_table}")

        cursor.execute(sample_sql)
        rows   = cursor.fetchall()

        if not rows:
            # ── Does the table exist at all? ──────────────────────────────────
            cursor.execute(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_CATALOG = DB_NAME() AND TABLE_NAME = ?",
                IDMS_USER_TABLE,
            )
            table_exists = (cursor.fetchone() or (0,))[0] > 0

            print(f"\n  *** WARNING: 0 rows returned from {fq_table} ***")

            if not table_exists:
                print(f"  The table '{IDMS_USER_TABLE}' does NOT exist in '{actual_db}'.")
                print(f"  Run:  python idms_inspect.py  to list available tables.")
                print(f"  Auto-provisioning will create 'Unknown - [id]' placeholders.")
                print(f"\n{_DIV}\n")
                return False

            # ── Table exists — is the active filter the culprit? ──────────────
            # Count rows WITHOUT the filter to distinguish "empty table" from
            # "filter excludes everything".
            cursor.execute(f"SELECT COUNT(*) FROM {fq_table}")
            total_rows = (cursor.fetchone() or (0,))[0]

            if total_rows > 0 and IDMS_USER_ACTIVE_FILTER.strip():
                # Filter is killing all rows — show the real distinct values
                print(
                    f"\n  ROOT CAUSE: The active filter  \"{IDMS_USER_ACTIVE_FILTER}\"  "
                    f"matches 0 of {total_rows} rows."
                )
                print(f"  The ACTIVE column stores different values than expected.")
                print(f"\n  Querying distinct ACTIVE values in {fq_table}...\n")
                try:
                    # Identify the filter column name from the expression
                    # (first word before the operator is the column name)
                    filter_col = IDMS_USER_ACTIVE_FILTER.strip().split()[0].strip("[]")
                    cursor.execute(
                        f"SELECT CAST([{filter_col}] AS VARCHAR(255)) AS val, COUNT(*) AS cnt "
                        f"FROM {fq_table} "
                        f"GROUP BY [{filter_col}] "
                        f"ORDER BY cnt DESC"
                    )
                    dist_rows = cursor.fetchall()
                    print(f"  {'Value':<25} {'Row count'}")
                    print(f"  {'-'*24} {'-'*10}")
                    for dr in dist_rows:
                        val_display = repr(dr[0]) if dr[0] is not None else "NULL"
                        print(f"  {val_display:<25} {dr[1]}")
                    print()
                    # Best guess: the value with the most rows is likely "active"
                    if dist_rows:
                        best_val = dist_rows[0][0]
                        print(f"  Most common value: {best_val!r} ({dist_rows[0][1]} rows)")
                        print(f"  If that is the 'active' value, run:\n")
                        print(f"    $env:IDMS_USER_ACTIVE_FILTER = \"{filter_col} = '{best_val}'\"")
                        print(f"\n  Or to return ALL employees regardless of status:")
                        print(f"    $env:IDMS_USER_ACTIVE_FILTER = \"\"")
                except Exception as fe:
                    print(f"  (Could not read distinct values: {fe})")
                    print(f"  Quick fix: clear the filter:  $env:IDMS_USER_ACTIVE_FILTER = \"\"")

            elif total_rows == 0:
                print(f"  The table '{IDMS_USER_TABLE}' is genuinely empty ({total_rows} rows total).")
                print(f"  Verify in SSMS: SELECT COUNT(*) FROM {fq_table}")

            else:
                # Filter is empty but still 0 rows — column/name issue
                print(f"  The table has {total_rows} row(s) but the SELECT returned 0.")
                print(f"  Check that IDMS_USER_ID_COL and IDMS_USER_FIRST_NAME_COL are correct.")
                print(f"  Run:  python inspect_tblemployee.py  to verify column names.")

            print(f"\n  Auto-provisioning will create 'Unknown - [id]' placeholders.")
            print(f"\n{_DIV}\n")
            return False

        print(f"\n  Results ({len(rows)} row(s) — showing up to 5):")
        print(f"  {'ID':<15} {'Name':<30} {'Dept'}")
        print(f"  {'-'*14} {'-'*29} {'-'*20}")
        for r in rows:
            print(f"  {str(r[0]):<15} {str(r[1] or ''):<30} {str(r[2] or '')}")
        print(f"\n  Config looks correct — auto-provisioning is ready.")
        print(f"\n{_DIV}\n")
        return True

    except Exception as exc:
        err_str = str(exc)
        is_bad_column = "42S22" in err_str or "Invalid column name" in err_str
        is_bad_table  = "42S02" in err_str or "Invalid object name" in err_str

        print(f"\n  *** ERROR querying `{IDMS_USER_TABLE}`: ***")
        print(f"  {exc}")

        # ── 42S22: configured column doesn't exist → show real columns ────────
        if is_bad_column and conn is not None:
            print(f"\n  Root cause: one of your configured column names does not exist in {IDMS_USER_TABLE}.")
            print(f"  Querying INFORMATION_SCHEMA to show the actual columns...\n")
            try:
                _cur = conn.cursor()
                _cur.execute(
                    """
                    SELECT c.COLUMN_NAME, c.DATA_TYPE,
                           CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS is_pk
                    FROM   INFORMATION_SCHEMA.COLUMNS c
                    LEFT   JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                                ON kcu.TABLE_NAME  = c.TABLE_NAME
                               AND kcu.COLUMN_NAME = c.COLUMN_NAME
                               AND kcu.CONSTRAINT_NAME LIKE 'PK%'
                    WHERE  c.TABLE_NAME = ?
                    ORDER  BY c.ORDINAL_POSITION
                    """,
                    IDMS_USER_TABLE,
                )
                cols = _cur.fetchall()
                _cur.close()

                if cols:
                    print(f"  Columns in `{IDMS_USER_TABLE}` ({len(cols)} total):\n")
                    print(f"  {'#':<4} {'Column Name':<30} {'Type':<15} {'PK'}")
                    print(f"  {'-'*3} {'-'*29} {'-'*14} {'-'*4}")
                    for i, c in enumerate(cols, 1):
                        print(f"  {i:<4} {c[0]:<30} {c[1]:<15} {c[2]}")

                    # Best-guess ID column (matches with tbl_realtime_glog.user_id)
                    id_candidates = [
                        c[0] for c in cols
                        if any(k in c[0].lower()
                               for k in ("enroll", "id", "no", "num", "code", "card", "emp", "user"))
                    ]
                    name_candidates = [
                        c[0] for c in cols
                        if any(k in c[0].lower()
                               for k in ("name", "emp", "first", "last", "full"))
                    ]

                    print(f"\n  Likely ID column (matches biometric enroll_id): "
                          + (", ".join(id_candidates) if id_candidates else "(none found — check manually)"))
                    print(f"  Likely name column(s): "
                          + (", ".join(name_candidates) if name_candidates else "(none found — check manually)"))

                    # Recommend the first plausible candidate
                    best_id   = id_candidates[0]   if id_candidates   else "???"
                    best_name_first = name_candidates[0] if name_candidates else "???"
                    best_name_last  = name_candidates[1] if len(name_candidates) > 1 else ""

                    print(f"\n  ── Suggested fix — paste these into PowerShell, then restart: ──\n")
                    print(f'  $env:IDMS_USER_TABLE          = "{IDMS_USER_TABLE}"')
                    print(f'  $env:IDMS_USER_ID_COL         = "{best_id}"')
                    print(f'  $env:IDMS_USER_FIRST_NAME_COL = "{best_name_first}"')
                    print(f'  $env:IDMS_USER_LAST_NAME_COL  = "{best_name_last}"')
                    print(f'  $env:IDMS_USER_ACTIVE_FILTER  = ""')
                    print(f"\n  Or run:  python inspect_tblemployee.py")
                    print(f"  That script cross-references columns with tbl_realtime_glog.user_id")
                    print(f"  to confirm which column is the biometric enroll_id.\n")
                else:
                    print(f"  Could not read columns — table may not exist with that name.")
                    print(f"  Run: python idms_inspect.py  to list all tables.")
            except Exception as schema_exc:
                print(f"  (Could not query column schema: {schema_exc})")

        # ── 42S02: table itself doesn't exist ─────────────────────────────────
        elif is_bad_table:
            print(f"\n  Root cause: table '{IDMS_USER_TABLE}' does not exist in the database.")
            print(f"  Run: python idms_inspect.py  to list all available tables.")

        else:
            print(f"  Check IDMS_SERVER, IDMS_DATABASE, IDMS_USER_TABLE config.")

        print(f"  Auto-provisioning will use 'Unknown - [id]' placeholders until fixed.")
        print(f"\n{_DIV}\n")
        return False

    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


# ── Shift defaults (override via .env) ───────────────────────────────────────
SHIFT_START  = time(int(os.getenv("SHIFT_START_HOUR", 9)),
                    int(os.getenv("SHIFT_START_MIN",  30)))
SHIFT_END    = time(int(os.getenv("SHIFT_END_HOUR",  18)),
                    int(os.getenv("SHIFT_END_MIN",    30)))
GRACE_MIN    = int(os.getenv("GRACE_MINUTES",         15))
HALF_DAY_HRS = float(os.getenv("HALF_DAY_THRESHOLD_HOURS", 4.5))

# ── IDMS SQL Server config (same env vars as biometric_sync.py) ───────────────
_IDMS_SERVER   = os.getenv("IDMS_SERVER",   r"DESKTOP-EQ55Q8H\SQLEXPRESS")
_IDMS_DATABASE = os.getenv("IDMS_DATABASE", "idms")
_IDMS_USER     = os.getenv("IDMS_USER",     "sa")
_IDMS_PASSWORD = os.getenv("IDMS_PASSWORD", "sss")
_IDMS_DRIVER   = os.getenv("IDMS_DRIVER",   "ODBC Driver 17 for SQL Server")


# ── Database helpers ──────────────────────────────────────────────────────────

def _get_db():
    return mysql.connector.connect(
        host     = os.getenv("DB_HOST",     "localhost"),
        user     = os.getenv("DB_USER",     "root"),
        password = os.getenv("DB_PASSWORD", ""),
        database = os.getenv("DB_NAME",     "hrms"),
    )


def _get_idms_db() -> pyodbc.Connection:
    """
    IDMS is the biometric device vendor's own SQL Server database — read-only,
    external to our stack. Our own data (_get_db() above) is always MySQL.
    """
    conn_str = (
        f"DRIVER={{{_IDMS_DRIVER}}};"
        f"SERVER={_IDMS_SERVER};"
        f"DATABASE={_IDMS_DATABASE};"
        f"UID={_IDMS_USER};"
        f"PWD={_IDMS_PASSWORD};"
        "TrustServerCertificate=yes;"
        "Connection Timeout=10;"
        "APP=hrms_biometric;"
    )
    conn = pyodbc.connect(conn_str, timeout=10)

    # DATABASE= in the connection string is a *hint* to SQL Server.
    # If the login's default database is 'master' (common for 'sa'), some
    # ODBC drivers honour the login default instead.  USE is authoritative
    # and immediately switches the connection context.
    cursor = conn.cursor()
    try:
        cursor.execute(f"USE [{_IDMS_DATABASE}]")
        cursor.execute("SELECT DB_NAME()")
        row = cursor.fetchone()
        actual_db = row[0] if row else "UNKNOWN"
        if actual_db.lower() != _IDMS_DATABASE.lower():
            print(
                f"[IDMS] *** WARNING: connected to '{actual_db}' "
                f"but expected '{_IDMS_DATABASE}'. "
                f"Check IDMS_DATABASE env var and SQL Server login defaults. ***"
            )
        else:
            print(f"[IDMS] Connection OK — database: {actual_db}")
    finally:
        cursor.close()

    return conn


def _fq(table: str) -> str:
    """
    Returns a fully-qualified SQL Server table reference:
        UserInfo          →  [idms].[UserInfo]
        idms.dbo.UserInfo →  returned as-is (already qualified)

    Qualifying the name means the query works correctly even if the session
    context is accidentally in 'master' — SQL Server resolves the reference
    to the right database regardless of the active USE context.
    """
    if "." in table:
        return table  # caller already qualified it
    return f"[{_IDMS_DATABASE}].[{table}]"


# ── Stage 1 helpers: IDMS lookup + HRMS matching ─────────────────────────────

def _fetch_idms_user(enroll_id: str) -> Optional[dict]:
    """
    Queries IDMS_USER_TABLE for the user's name / department.
    Column names, table name, and active-user filter are all read from the
    module-level config variables so they can be changed via env vars.

    Returns {'name': str, 'department': str|None} or None when not found.
    Raises RuntimeError on connection / SQL error so the caller can log the
    standardised "User lookup failed - skipping auto-provisioning for ID X" warning.

    Connection is always closed in a finally block — no leak even when
    cursor.execute() throws a 42S02 (Invalid object name) error.
    """
    # Build the name expression.
    # If both first + last columns are configured, concatenate them with a space.
    # ISNULL(col, '') ensures a NULL first/last name does not poison the whole concat.
    # NULLIF(..., '') converts a blank result (both columns NULL) to SQL NULL.
    if IDMS_USER_FIRST_NAME_COL and IDMS_USER_LAST_NAME_COL:
        name_expr = (
            f"NULLIF(LTRIM(RTRIM("
            f"ISNULL({IDMS_USER_FIRST_NAME_COL}, '') + ' ' + "
            f"ISNULL({IDMS_USER_LAST_NAME_COL}, '')"
            f")), '')"
        )
    elif IDMS_USER_FIRST_NAME_COL:
        name_expr = (
            f"NULLIF(LTRIM(RTRIM(ISNULL({IDMS_USER_FIRST_NAME_COL}, ''))), '')"
        )
    else:
        name_expr = "NULL"

    dept_expr = (
        f"ISNULL(NULLIF(LTRIM(RTRIM({IDMS_USER_DEPT_COL})), ''), NULL)"
        if IDMS_USER_DEPT_COL
        else "NULL"
    )

    active_clause = (
        f"  AND ({IDMS_USER_ACTIVE_FILTER})"
        if IDMS_USER_ACTIVE_FILTER.strip()
        else ""
    )

    # _fq() prefixes the table with `idms`.`...` so the query resolves
    # to the right database even when the session context is 'master'.
    sql = f"""
        SELECT
            CAST({IDMS_USER_ID_COL} AS VARCHAR(64)) AS user_id,
            {name_expr}                              AS name,
            {dept_expr}                              AS department
        FROM  {_fq(IDMS_USER_TABLE)}
        WHERE CAST({IDMS_USER_ID_COL} AS VARCHAR(64)) = CAST(? AS VARCHAR(64))
        {active_clause}
    """

    conn = None
    try:
        conn   = _get_idms_db()
        cursor = conn.cursor()
        # All identifiers come from developer-controlled config — f-string is safe.
        cursor.execute(sql, str(enroll_id))
        row = cursor.fetchone()

        if not row:
            # Print the exact SQL so the developer can paste it into SSMS immediately
            debug_sql = sql.replace("?", f"'{enroll_id}'").strip()
            print(
                f"\n[IDMS NOT FOUND] enroll_id={enroll_id} — 0 rows returned.\n"
                f"  Paste this into SSMS to investigate:\n\n"
                + "\n".join(f"  {line}" for line in debug_sql.splitlines())
                + "\n"
            )
            logger.warning(
                "[AUTO-PROVISION] enroll_id=%s not found in %s "
                "(check active filter or verify the ID exists in the table)",
                enroll_id, IDMS_USER_TABLE,
            )
            return None

        return {
            "name":       str(row[1]).strip() if row[1] else None,
            "department": str(row[2]).strip() if row[2] else None,
        }

    except Exception as exc:
        # Re-raise so the caller logs the standardised warning and continues the loop
        raise RuntimeError(
            f"IDMS {IDMS_USER_TABLE} lookup failed "
            f"for enroll_id={enroll_id}: {exc}"
        ) from exc

    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def _find_hrms_employee_by_name(cursor, name: str) -> Optional[str]:
    """
    Searches active employees by full_name.
    Returns employee_code ONLY when exactly one employee matches — avoids
    incorrect auto-mapping when two employees share similar names.

    Two passes:
      1. Exact case-insensitive match
      2. First-word + last-word LIKE (handles middle name variations)
    """
    name = name.strip()
    if not name:
        return None

    # Pass 1: exact match
    cursor.execute(
        """SELECT employee_code FROM employees
           WHERE LOWER(full_name) = LOWER(%s) AND status = 'active'
           LIMIT 2""",
        (name,),
    )
    rows = cursor.fetchall()
    if len(rows) == 1:
        return rows[0]["employee_code"]
    if len(rows) > 1:
        logger.warning(
            "[AUTO-PROVISION] Ambiguous exact match for '%s' — %d employees, skipping",
            name, len(rows),
        )
        return None

    # Pass 2: first + last token fuzzy match
    parts = name.split()
    if len(parts) >= 2:
        cursor.execute(
            """SELECT employee_code FROM employees
               WHERE  full_name LIKE %s
                 AND  full_name LIKE %s
                 AND  status    = 'active'
               LIMIT 2""",
            (f"%{parts[0]}%", f"%{parts[-1]}%"),
        )
        rows = cursor.fetchall()
        if len(rows) == 1:
            logger.info(
                "[AUTO-PROVISION] Fuzzy name match: '%s' → %s",
                name, rows[0]["employee_code"],
            )
            return rows[0]["employee_code"]
        if len(rows) > 1:
            logger.warning(
                "[AUTO-PROVISION] Ambiguous fuzzy match for '%s' — skipping", name
            )

    return None


def _create_provisional_employee(
    cursor,
    enroll_id:  str,
    name:       str,
    department: Optional[str],
    status:     str = "active",
) -> str:
    """
    Creates a minimal employee row when no unique HRMS match exists.
    Code format: BIO{enroll_id:04d}  (e.g. BIO0045) — never collides with EMP_XXXX.
    Title = 'BIO-PROVISIONAL' so HR can identify and clean up later.

    status='active'  — used when we have a real name from IDMS
    status='pending' — used for "Unknown - X" placeholders (IDMS returned nothing)

    Uses INSERT IGNORE so repeated calls are idempotent.
    """
    employee_code = f"BIO{int(enroll_id):04d}"
    full_name     = name or f"Unknown - {enroll_id}"
    email         = f"bio.{enroll_id}@biometric.provisional"
    dept          = department or "Unassigned"

    cursor.execute(
        """
        INSERT IGNORE INTO employees
            (employee_code, full_name, email, phone, department,
             title, joining_date, status)
        VALUES (%s, %s, %s, '0000000000', %s, 'BIO-PROVISIONAL', CURDATE(), %s)
        """,
        (employee_code, full_name, email, dept, status),
    )
    logger.info(
        "[AUTO-PROVISION] Provisional employee: code=%s  name='%s'  status=%s",
        employee_code, full_name, status,
    )
    return employee_code


def _auto_provision_mapping(
    enroll_id: str,
    device_id: str,
    cursor,             # live HRMS cursor (dictionary=True)
) -> str:
    """
    Full auto-provision sequence for one unmapped enroll_id.

    Priority order:
      1. IDMS lookup succeeds + exact/fuzzy name match  →  link to existing employee
      2. IDMS lookup succeeds + no name match           →  create BIO-PROVISIONAL (active)
      3. IDMS lookup fails OR returns 0 rows            →  create 'Unknown - {id}' (pending)

    Never returns None — a mapping is ALWAYS created so attendance flows
    regardless of whether the IDMS lookup succeeds.
    """
    logger.info("[AUTO-PROVISION] enroll_id=%s  device=%s", enroll_id, device_id)

    # ── Try IDMS lookup — catch all errors so Stage 2 is never blocked ────────
    name:       Optional[str] = None
    department: Optional[str] = None
    idms_ok = False

    try:
        idms_user = _fetch_idms_user(enroll_id)
        if idms_user and idms_user.get("name"):
            name       = idms_user["name"]
            department = idms_user.get("department")
            idms_ok    = True
        else:
            logger.warning(
                "[AUTO-PROVISION] enroll_id=%s — IDMS returned no data; "
                "will create placeholder so attendance is captured",
                enroll_id,
            )
    except Exception as exc:
        logger.warning(
            "[AUTO-PROVISION] User lookup failed - skipping auto-provisioning for ID %s: %s — "
            "creating placeholder so attendance is captured",
            enroll_id, exc,
        )

    # ── Resolve employee_code ──────────────────────────────────────────────────
    if idms_ok and name:
        # Path A: IDMS has a real name → try to link to an existing HRMS employee
        employee_code = _find_hrms_employee_by_name(cursor, name)
        if employee_code:
            logger.info(
                "[AUTO-PROVISION] Matched enroll_id=%s → existing employee %s ('%s')",
                enroll_id, employee_code, name,
            )
        else:
            # Named but no unique match → provisional with the real name
            employee_code = _create_provisional_employee(
                cursor, enroll_id, name, department, status="active"
            )
    else:
        # Path B: IDMS had no data (table mismatch, connection error, or missing row)
        # Create a placeholder so the punch is never silently dropped.
        placeholder_name = f"Unknown - {enroll_id}"
        print(
            f"[AUTO-PROVISION] No IDMS data for enroll_id={enroll_id} — "
            f"creating placeholder '{placeholder_name}' (status=pending)"
        )
        employee_code = _create_provisional_employee(
            cursor, enroll_id, placeholder_name, None, status="pending"
        )

    # ── Upsert mapping — idempotent, safe to call repeatedly ──────────────────
    notes = (
        f"Auto-provisioned from TimeWatch — {name}"
        if name
        else f"Placeholder — IDMS had no record for enroll_id {enroll_id}"
    )
    cursor.execute(
        """
        INSERT INTO biometric_employee_map
            (enroll_id, device_id, employee_id, is_active, mapped_by, notes)
        VALUES (%s, %s, %s, 1, 'auto_provision', %s)
        ON DUPLICATE KEY UPDATE
            employee_id = VALUES(employee_id),
            is_active   = 1,
            mapped_by   = 'auto_provision',
            notes       = VALUES(notes),
            mapped_at   = CURRENT_TIMESTAMP
        """,
        (enroll_id, device_id, employee_code, notes),
    )
    logger.info(
        "[AUTO-PROVISION] Mapping saved: enroll_id=%s → %s  (idms_ok=%s)",
        enroll_id, employee_code, idms_ok,
    )
    return employee_code


# ── Shift status calculator ───────────────────────────────────────────────────

def _calc_status(check_in: time, check_out: Optional[time]):
    """Returns (status, late_min, beyond_grace, overtime_min, early_arrival_min)."""
    today          = date.today()
    shift_start_dt = datetime.combine(today, SHIFT_START)
    shift_end_dt   = datetime.combine(today, SHIFT_END)
    grace_deadline = (shift_start_dt + timedelta(minutes=GRACE_MIN)).time()
    scheduled_min  = max(0, int((shift_end_dt - shift_start_dt).total_seconds() / 60))

    cin_dt   = datetime.combine(today, check_in)
    late_sec = (cin_dt - shift_start_dt - timedelta(minutes=GRACE_MIN)).total_seconds()
    late_min = max(0, int(late_sec / 60))
    beyond_grace = 1 if check_in > grace_deadline else 0

    overtime_min = 0
    early_arrival_min = max(0, int((shift_start_dt - cin_dt).total_seconds() / 60))
    worked_hours = 0.0

    if check_out:
        cout_dt      = datetime.combine(today, check_out)
        worked_hours = max(0.0, (cout_dt - cin_dt).total_seconds() / 3600)
        worked_min   = max(0, int((cout_dt - cin_dt).total_seconds() / 60))
        overtime_min = max(0, worked_min - scheduled_min)

    if check_out and worked_hours < HALF_DAY_HRS:
        status = "HALF_DAY"
    elif beyond_grace:
        status = "LATE"
    else:
        status = "PRESENT"

    return status, late_min, beyond_grace, overtime_min, early_arrival_min


# ── Force-reprocess helper ────────────────────────────────────────────────────

def force_reprocess_raw_logs(hours: int = 24) -> int:
    """
    Resets is_processed = 0 for all biometric_raw_logs rows punched within
    the last `hours` hours so the next Stage 2 cycle re-converts them into
    attendance records.

    Safe to call while the BiometricWorker is running — Stage 2 runs every
    30 s and will pick up the reset rows automatically.

    Returns the number of rows reset.

    Typical usage after fixing a broken config (e.g. wrong IDMS table):

        python - <<'EOF'
        from backend.core.biometric_processor import force_reprocess_raw_logs
        n = force_reprocess_raw_logs(24)
        print(f"Reset {n} rows — Stage 2 will re-process them within 30 s")
        EOF
    """
    conn   = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE biometric_raw_logs
            SET    is_processed = 0
            WHERE  punch_time  >= NOW() - INTERVAL %s HOUR
              AND  is_processed = 1
            """,
            (hours,),
        )
        conn.commit()
        count = cursor.rowcount
        print(
            f"[FORCE-REPROCESS] Reset {count} row(s) in biometric_raw_logs "
            f"(last {hours}h) — Stage 2 will re-process them on the next cycle."
        )
        return count
    except Exception as exc:
        conn.rollback()
        print(f"[FORCE-REPROCESS] Error: {exc}")
        raise
    finally:
        cursor.close()
        conn.close()


# ── Main entry point ──────────────────────────────────────────────────────────

def process_pending_punches() -> dict:
    """
    Stage 1 and Stage 2 run in SEPARATE try/except blocks.
    A crash in Stage 1 (e.g. wrong IDMS table name) logs a warning and then
    Stage 2 immediately runs — attendance for all already-mapped employees
    is never blocked by a provisioning failure.

    Returns summary dict with keys:
        auto_provisioned, processed, attendance_created, attendance_updated,
        skipped, errors
    """
    conn   = _get_db()
    cursor = conn.cursor(dictionary=True)
    result = {
        "auto_provisioned":    0,
        "processed":           0,
        "attendance_created":  0,
        "attendance_updated":  0,
        "skipped":             0,
        "errors":              0,
    }

    # =========================================================================
    # STAGE 1 — Auto-provision unmapped enroll_ids
    # Wrapped in its own try/except so Stage 2 always executes below.
    # =========================================================================
    try:
        cursor.execute(
            """
            SELECT DISTINCT r.enroll_id, r.device_id
            FROM   biometric_raw_logs r
            LEFT   JOIN biometric_employee_map m
                        ON  r.enroll_id  = m.enroll_id
                        AND (m.device_id = r.device_id OR m.device_id = '*')
                        AND m.is_active  = 1
            WHERE  r.is_processed  = 0
              AND  m.employee_id   IS NULL
            """
        )
        unmapped = cursor.fetchall()

        if unmapped:
            print(
                f"\n[AUTO-PROVISION] Found {len(unmapped)} unmapped enroll_id(s): "
                + ", ".join(str(r['enroll_id']) for r in unmapped)
            )
            logger.info(
                "[AUTO-PROVISION] Found %d unmapped enroll_id(s) — starting auto-provision",
                len(unmapped),
            )
            idms_hits = 0
            idms_misses = 0
            for row in unmapped:
                enroll_id = row["enroll_id"]
                try:
                    emp_code = _auto_provision_mapping(enroll_id, row["device_id"], cursor)
                    result["auto_provisioned"] += 1
                    # _auto_provision_mapping prints whether IDMS hit or placeholder was used;
                    # track counts here for the summary line.
                    if "Unknown" in (emp_code or ""):
                        idms_misses += 1
                    else:
                        idms_hits += 1
                except Exception as exc:
                    logger.warning(
                        "[AUTO-PROVISION] User lookup failed - "
                        "skipping auto-provisioning for ID %s: %s",
                        enroll_id, exc,
                    )
                    result["errors"] += 1
                    idms_misses += 1
                    continue

            # Commit all provisioned employees + mappings so Stage 2 JOIN sees them
            conn.commit()
            print(
                f"[AUTO-PROVISION] Stage 1 done — "
                f"total={len(unmapped)} | "
                f"provisioned={result['auto_provisioned']} | "
                f"idms_matched={idms_hits} | "
                f"placeholders={idms_misses} | "
                f"errors={result['errors']}"
            )
            logger.info(
                "[AUTO-PROVISION] Stage 1 complete — %d provisioned, %d skipped/failed",
                result["auto_provisioned"],
                len(unmapped) - result["auto_provisioned"],
            )

    except Exception as exc:
        # Outer Stage 1 crash (e.g. MySQL connection error querying raw_logs).
        # Roll back any partial work and fall through to Stage 2.
        logger.error(
            "[AUTO-PROVISION] Stage 1 crashed — rolling back and continuing to "
            "Stage 2 (already-mapped punches will still be processed): %s",
            exc,
        )
        try:
            conn.rollback()
        except Exception:
            pass

    # =========================================================================
    # STAGE 2 — Process punches → attendance
    # Runs unconditionally regardless of Stage 1 outcome.
    # =========================================================================
    try:
        cursor.execute(
            """
            SELECT r.id, r.punch_time, m.employee_id
            FROM   biometric_raw_logs r
            JOIN   biometric_employee_map m
                   ON  r.enroll_id  = m.enroll_id
                   AND (m.device_id = r.device_id OR m.device_id = '*')
                   AND m.is_active  = 1
            WHERE  r.is_processed = 0
            ORDER  BY m.employee_id, r.punch_time
            """
        )
        rows = cursor.fetchall()

        if not rows:
            logger.info("[PROCESSOR] No unprocessed punches to convert")
        else:
            # Group by (employee_id, calendar date)
            groups: dict = defaultdict(list)
            for row in rows:
                day = row["punch_time"].date()
                groups[(row["employee_id"], day)].append(row)

            ids_to_mark: list = []

            for (emp_id, work_date), punches in groups.items():
                punches.sort(key=lambda p: p["punch_time"])

                first = punches[0]
                last  = punches[-1]

                check_in_time  = first["punch_time"].time()
                check_out_time = last["punch_time"].time() if len(punches) > 1 else None

                status, late_min, beyond_grace, overtime_min, early_min = _calc_status(
                    check_in_time, check_out_time
                )

                # Check for a protected existing record
                cursor.execute(
                    "SELECT id, source FROM attendance WHERE employee_id=%s AND date=%s",
                    (emp_id, work_date),
                )
                existing = cursor.fetchone()

                if existing and existing["source"] in ("MANUAL", "REGULARIZED"):
                    result["skipped"] += 1
                    ids_to_mark.extend(p["id"] for p in punches)
                    continue

                try:
                    if existing:
                        cursor.execute(
                            """
                            UPDATE attendance SET
                                status           = %s,
                                check_in         = %s,
                                check_out        = %s,
                                late_minutes     = %s,
                                beyond_grace     = %s,
                                overtime_minutes = %s,
                                early_minutes    = %s,
                                source           = 'BIOMETRIC',
                                biometric_log_id = %s
                            WHERE employee_id = %s AND date = %s
                            """,
                            (
                                status,
                                str(check_in_time),
                                str(check_out_time) if check_out_time else None,
                                late_min, beyond_grace, overtime_min, early_min,
                                first["id"],
                                emp_id, work_date,
                            ),
                        )
                        result["attendance_updated"] += 1
                    else:
                        cursor.execute(
                            """
                            INSERT INTO attendance
                                (employee_id, date, status, check_in, check_out,
                                 late_minutes, beyond_grace, overtime_minutes, early_minutes,
                                 source, biometric_log_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'BIOMETRIC', %s)
                            """,
                            (
                                emp_id, work_date, status,
                                str(check_in_time),
                                str(check_out_time) if check_out_time else None,
                                late_min, beyond_grace, overtime_min, early_min,
                                first["id"],
                            ),
                        )
                        result["attendance_created"] += 1

                    # Label IN / OUT on the boundary raw logs
                    cursor.execute(
                        "UPDATE biometric_raw_logs SET punch_type='IN'  WHERE id=%s",
                        (first["id"],),
                    )
                    if len(punches) > 1:
                        cursor.execute(
                            "UPDATE biometric_raw_logs SET punch_type='OUT' WHERE id=%s",
                            (last["id"],),
                        )

                    ids_to_mark.extend(p["id"] for p in punches)
                    result["processed"] += len(punches)

                except Exception as exc:
                    # Per-employee error: log and continue — do not stop the loop
                    logger.warning(
                        "[PROCESSOR] Error for emp=%s date=%s: %s", emp_id, work_date, exc
                    )
                    conn.rollback()
                    result["errors"] += 1

            # Bulk-mark raw logs as processed
            if ids_to_mark:
                placeholders = ",".join(["%s"] * len(ids_to_mark))
                cursor.execute(
                    f"UPDATE biometric_raw_logs SET is_processed=1 WHERE id IN ({placeholders})",
                    ids_to_mark,
                )

            conn.commit()

    except Exception as exc:
        logger.error("[PROCESSOR] Stage 2 fatal error: %s", exc)
        try:
            conn.rollback()
        except Exception:
            pass
        result["errors"] += 1

    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass

    # Heartbeat — printed (not just logged) so it's visible in the terminal
    # even when log level is WARNING
    print(
        f"[Sync Loop Heartbeat] - Processed up to: "
        f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | "
        f"created={result['attendance_created']} "
        f"updated={result['attendance_updated']} "
        f"provisioned={result['auto_provisioned']} "
        f"errors={result['errors']}"
    )

    logger.info("[PROCESSOR] Result: %s", result)
    return result
