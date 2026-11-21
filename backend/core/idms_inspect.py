"""
idms_inspect.py — IDMS SQL Server schema diagnostic tool

Run this script to discover the correct table name for your user/employee data.

Usage:
    python idms_inspect.py

What it does:
  1. Connects to the IDMS SQL Server using the same credentials as biometric_sync.py
  2. Lists ALL tables in the database
  3. For any table whose name contains 'user', 'emp', 'staff', or 'person',
     shows the column names and a 3-row sample so you can confirm which table
     holds name + department data
  4. Prints the exact env var command to configure biometric_processor.py

Once you identify the correct table, either:
  a) Set the environment variable:
       $env:IDMS_USER_TABLE = "your_table_name"   (PowerShell)
  b) Or edit the fallback in biometric_processor.py:
       IDMS_USER_TABLE: str = os.getenv("IDMS_USER_TABLE", "your_table_name")
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
    print("ERROR: pyodbc is not installed. Run: pip install pyodbc")
    sys.exit(1)

# ── Connection config — reads same env vars as biometric_sync.py ─────────────
SERVER   = os.getenv("IDMS_SERVER",   r"DESKTOP-EQ55Q8H\SQLEXPRESS")
DATABASE = os.getenv("IDMS_DATABASE", "idms")
USER     = os.getenv("IDMS_USER",     "sa")
PASSWORD = os.getenv("IDMS_PASSWORD", "sss")
DRIVER   = os.getenv("IDMS_DRIVER",   "ODBC Driver 17 for SQL Server")

CONN_STR = (
    f"DRIVER={{{DRIVER}}};"
    f"SERVER={SERVER};"
    f"DATABASE={DATABASE};"
    f"UID={USER};"
    f"PWD={PASSWORD};"
    "TrustServerCertificate=yes;"
    "Connection Timeout=10;"
)

# Tables whose names contain any of these keywords will get a column + sample dump
INTERESTING_KEYWORDS = ["user", "emp", "staff", "person", "member", "worker"]

DIVIDER = "─" * 70


def main():
    print(DIVIDER)
    print(f"  IDMS Schema Inspector")
    print(f"  Server  : {SERVER}")
    print(f"  Database: {DATABASE}")
    print(DIVIDER)

    # ── 1. Connect ────────────────────────────────────────────────────────────
    print("\n[1/3] Connecting to SQL Server…")
    try:
        conn = pyodbc.connect(CONN_STR, timeout=10)
        print("      Connection OK\n")
    except Exception as exc:
        print(f"\nERROR: Could not connect to IDMS SQL Server.\n{exc}")
        print("\nCheck:")
        print(f"  IDMS_SERVER   = {SERVER}")
        print(f"  IDMS_DATABASE = {DATABASE}")
        print(f"  IDMS_USER     = {USER}")
        print(f"  IDMS_DRIVER   = {DRIVER}")
        sys.exit(1)

    cursor = conn.cursor()

    # ── 2. List all tables ────────────────────────────────────────────────────
    print("[2/3] All tables in the database:\n")
    cursor.execute(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES "
        "WHERE TABLE_TYPE = 'BASE TABLE' "
        "ORDER BY TABLE_NAME"
    )
    all_tables = [row[0] for row in cursor.fetchall()]

    if not all_tables:
        print("      (no tables found — check DATABASE name)")
    else:
        for t in all_tables:
            marker = " ◄ (possible match)" if any(
                kw in t.lower() for kw in INTERESTING_KEYWORDS
            ) else ""
            print(f"    {t}{marker}")

    print()

    # ── 3. Deep dive into interesting tables ──────────────────────────────────
    interesting = [
        t for t in all_tables
        if any(kw in t.lower() for kw in INTERESTING_KEYWORDS)
    ]

    if not interesting:
        print("[3/3] No tables with user/employee keywords found.")
        print("      Look at the full list above and re-run with a different keyword.")
    else:
        print(f"[3/3] Inspecting {len(interesting)} candidate table(s):\n")
        for table in interesting:
            print(DIVIDER)
            print(f"  TABLE: {table}")
            print(DIVIDER)

            # Columns
            try:
                cursor.execute(
                    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH "
                    "FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_NAME = ? "
                    "ORDER BY ORDINAL_POSITION",
                    table,
                )
                columns = cursor.fetchall()
                print(f"  Columns ({len(columns)}):")
                for col in columns:
                    length = f"({col[2]})" if col[2] else ""
                    print(f"    {col[0]:<30} {col[1]}{length}")
            except Exception as exc:
                print(f"  Could not read columns: {exc}")
                continue

            # 3-row sample
            print(f"\n  Sample (top 3 rows):")
            try:
                cursor.execute(f"SELECT TOP 3 * FROM {table}")
                rows = cursor.fetchall()
                col_names = [desc[0] for desc in cursor.description]
                if rows:
                    # Print header
                    header = "  | " + " | ".join(f"{c:<20}" for c in col_names) + " |"
                    print(header)
                    print("  " + "-" * (len(header) - 2))
                    for row in rows:
                        line = "  | " + " | ".join(
                            f"{str(v)[:20]:<20}" for v in row
                        ) + " |"
                        print(line)
                else:
                    print("    (table is empty)")
            except Exception as exc:
                print(f"    Could not read sample: {exc}")

            print()

    conn.close()

    # ── 4. Instructions ───────────────────────────────────────────────────────
    print(DIVIDER)
    print("  NEXT STEP")
    print(DIVIDER)
    print()
    print("  Once you identify the correct table name, configure it with ONE of:")
    print()
    print("  Option A — Environment variable (recommended):")
    print('    PowerShell : $env:IDMS_USER_TABLE = "your_table_name"')
    print('    .env file  : IDMS_USER_TABLE=your_table_name')
    print()
    print("  Option B — Edit biometric_processor.py directly:")
    print('    IDMS_USER_TABLE: str = os.getenv("IDMS_USER_TABLE", "your_table_name")')
    print()
    print("  The table must have at least these columns (exact names may differ):")
    print("    user_id    — numeric ID matching the biometric device enroll_id")
    print("    name       — employee full name")
    print("    department — department name (optional)")
    print()
    print("  If the column names are different, also update _fetch_idms_user()")
    print("  in biometric_processor.py to match.")
    print()


if __name__ == "__main__":
    main()
