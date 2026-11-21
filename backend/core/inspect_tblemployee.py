"""
inspect_tblemployee.py — Targeted column + sample inspector for tblemployee.

Run this ONCE to discover the correct column names to use in biometric_processor.py.
After running, look at the output and note:
  1. Which column holds the biometric enroll_id (matches tbl_realtime_glog.user_id)
  2. Which column(s) hold the employee name
  3. Whether there is a department column

Usage:
    python inspect_tblemployee.py

You can also inspect any other table by passing its name as an argument:
    python inspect_tblemployee.py Userdetail
    python inspect_tblemployee.py tbl_realtime_userinfo
"""

import os
import sys

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            pass

try:
    import pyodbc
except ImportError:
    print("ERROR: pyodbc not installed. Run: pip install pyodbc")
    sys.exit(1)

SERVER   = os.getenv("IDMS_SERVER",   r"DESKTOP-EQ55Q8H\SQLEXPRESS")
DATABASE = os.getenv("IDMS_DATABASE", "idms")
USER     = os.getenv("IDMS_USER",     "sa")
PASSWORD = os.getenv("IDMS_PASSWORD", "sss")
DRIVER   = os.getenv("IDMS_DRIVER",   "ODBC Driver 17 for SQL Server")

TARGET_TABLE = sys.argv[1] if len(sys.argv) > 1 else "tblemployee"

DIV  = "─" * 72
DIV2 = "=" * 72


def connect():
    conn_str = (
        f"DRIVER={{{DRIVER}}};"
        f"SERVER={SERVER};"
        f"DATABASE={DATABASE};"
        f"UID={USER};"
        f"PWD={PASSWORD};"
        "TrustServerCertificate=yes;"
        "Connection Timeout=10;"
    )
    conn = pyodbc.connect(conn_str, timeout=10)
    cur = conn.cursor()
    cur.execute(f"USE [{DATABASE}]")
    cur.execute("SELECT DB_NAME()")
    actual = cur.fetchone()[0]
    cur.close()
    print(f"  Connected → {SERVER}  |  database: {actual}")
    return conn


def inspect_table(conn, table: str):
    cursor = conn.cursor()
    fq = f"[{DATABASE}].[{table}]"

    print(f"\n{DIV2}")
    print(f"  TABLE: {table}  ({fq})")
    print(DIV2)

    # ── Column schema ─────────────────────────────────────────────────────────
    cursor.execute(
        """
        SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.IS_NULLABLE,
            CASE WHEN kcu.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS is_pk
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
               ON kcu.TABLE_NAME   = c.TABLE_NAME
              AND kcu.COLUMN_NAME  = c.COLUMN_NAME
              AND kcu.CONSTRAINT_NAME LIKE 'PK%'
        WHERE c.TABLE_NAME = ?
        ORDER BY c.ORDINAL_POSITION
        """,
        table,
    )
    columns = cursor.fetchall()

    if not columns:
        print(f"\n  *** Table '{table}' was not found in database '{DATABASE}'. ***")
        print(f"  Check the table name and run python idms_inspect.py to list all tables.")
        return

    print(f"\n  Schema — {len(columns)} column(s):\n")
    print(f"  {'#':<4} {'Column Name':<30} {'Type':<15} {'Len':<8} {'Nullable':<10} {'PK'}")
    print(f"  {'-'*3} {'-'*29} {'-'*14} {'-'*7} {'-'*9} {'-'*4}")
    for i, col in enumerate(columns, 1):
        length = str(col[2]) if col[2] else "-"
        print(
            f"  {i:<4} {col[0]:<30} {col[1]:<15} {length:<8} {col[3]:<10} {col[4]}"
        )

    # ── Row count ─────────────────────────────────────────────────────────────
    cursor.execute(f"SELECT COUNT(*) FROM {fq}")
    row_count = cursor.fetchone()[0]
    print(f"\n  Total rows: {row_count}")

    # ── Sample rows ───────────────────────────────────────────────────────────
    print(f"\n{DIV}")
    print(f"  Sample data (TOP 5 rows):")
    print(DIV)

    cursor.execute(f"SELECT TOP 5 * FROM {fq}")
    sample_rows = cursor.fetchall()
    col_names   = [d[0] for d in cursor.description]

    if not sample_rows:
        print("  (table is empty)")
    else:
        col_w = max(18, max(len(c) for c in col_names))
        header = "  " + "  ".join(f"{c:<{col_w}}" for c in col_names)
        print(header)
        print("  " + "-" * (len(header) - 2))
        for row in sample_rows:
            line = "  " + "  ".join(f"{str(v)[:col_w]:<{col_w}}" for v in row)
            print(line)

    # ── Cross-reference with tbl_realtime_glog ────────────────────────────────
    # Find which column values OVERLAP with user_id values in tbl_realtime_glog.
    # This identifies the "enroll_id" column — the link between the punch log
    # and the employee record.
    print(f"\n{DIV}")
    print(f"  Cross-reference with tbl_realtime_glog.user_id:")
    print(f"  (finding which column in {table} matches the biometric enroll IDs)")
    print(DIV)

    # Only check numeric/varchar columns that look like an ID
    id_candidate_cols = [
        col[0] for col in columns
        if col[1].lower() in ("int", "bigint", "smallint", "tinyint",
                              "varchar", "nvarchar", "char", "nchar")
        and any(kw in col[0].lower() for kw in
                ("id", "no", "num", "code", "enroll", "card", "emp", "user"))
    ]

    if not id_candidate_cols:
        # Fall back to all non-text columns
        id_candidate_cols = [
            col[0] for col in columns
            if col[1].lower() in ("int", "bigint", "smallint", "tinyint", "varchar", "nvarchar")
        ][:6]  # limit to first 6 to avoid flooding output

    matched_col = None
    for col_name in id_candidate_cols:
        try:
            cursor.execute(
                f"""
                SELECT COUNT(*) AS matches
                FROM [{DATABASE}].[tbl_realtime_glog] AS g
                JOIN {fq} AS e
                  ON CAST(g.user_id AS VARCHAR(64)) = CAST(e.[{col_name}] AS VARCHAR(64))
                """
            )
            matches = cursor.fetchone()[0]
            marker = " *** MATCH — this is likely your enroll_id column!" if matches > 0 else ""
            print(f"  {col_name:<35} overlaps with tbl_realtime_glog: {matches} rows{marker}")
            if matches > 0 and matched_col is None:
                matched_col = col_name
        except Exception as exc:
            print(f"  {col_name:<35} (could not compare: {exc})")

    # ── Recommended config ────────────────────────────────────────────────────
    print(f"\n{DIV2}")
    print(f"  RECOMMENDED CONFIGURATION")
    print(DIV2)
    print()

    # Best-guess name columns
    name_cols = [col[0] for col in columns
                 if any(kw in col[0].lower()
                        for kw in ("name", "fname", "lname", "first", "last", "full"))]

    id_col    = matched_col or (id_candidate_cols[0] if id_candidate_cols else "??? — see cross-reference above")
    first_col = next((c for c in name_cols if any(k in c.lower() for k in ("first", "fname"))), None)
    last_col  = next((c for c in name_cols if any(k in c.lower() for k in ("last", "lname"))), None)
    full_col  = next((c for c in name_cols if any(k in c.lower() for k in ("full", "name"))), None)
    dept_col  = next((col[0] for col in columns if "dept" in col[0].lower() or "department" in col[0].lower()), "")

    if first_col and last_col:
        first_display = first_col
        last_display  = last_col
    elif full_col:
        first_display = full_col
        last_display  = ""
    elif name_cols:
        first_display = name_cols[0]
        last_display  = name_cols[1] if len(name_cols) > 1 else ""
    else:
        first_display = "??? — set to the name column you see above"
        last_display  = ""

    print("  Set these in biometric_processor.py  (or in your .env file):\n")
    print(f'  IDMS_USER_TABLE            = "{table}"')
    print(f'  IDMS_USER_ID_COL           = "{id_col}"')
    print(f'  IDMS_USER_FIRST_NAME_COL   = "{first_display}"')
    print(f'  IDMS_USER_LAST_NAME_COL    = "{last_display}"')
    print(f'  IDMS_USER_DEPT_COL         = "{dept_col}"')
    print(f'  IDMS_USER_ACTIVE_FILTER    = ""   (adjust if there is an IsActive / IsDeleted column)')
    print()
    print("  PowerShell one-liners (copy-paste into your terminal):\n")
    print(f'  $env:IDMS_USER_TABLE          = "{table}"')
    print(f'  $env:IDMS_USER_ID_COL         = "{id_col}"')
    print(f'  $env:IDMS_USER_FIRST_NAME_COL = "{first_display}"')
    print(f'  $env:IDMS_USER_LAST_NAME_COL  = "{last_display}"')
    if dept_col:
        print(f'  $env:IDMS_USER_DEPT_COL       = "{dept_col}"')
    print(f'  $env:IDMS_USER_ACTIVE_FILTER  = ""')
    print()
    print("  After setting env vars, restart the FastAPI server.")
    print("  The startup diagnostic will confirm the new config on next boot.")
    print()

    cursor.close()


def main():
    print(DIV2)
    print("  tblemployee Inspector — targeted column + enroll_id matcher")
    print(DIV2)

    try:
        conn = connect()
    except Exception as exc:
        print(f"\nERROR: Could not connect — {exc}")
        sys.exit(1)

    inspect_table(conn, TARGET_TABLE)
    conn.close()


if __name__ == "__main__":
    main()
