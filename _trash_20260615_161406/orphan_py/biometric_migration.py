"""
Biometric Integration — Phase 1 Migration
Run once (idempotent): safe to re-run at any time.
Creates 4 new tables and adds 2 columns to the existing attendance table.
"""

import sys
import mysql.connector
from mysql.connector import Error

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@123',
    'database': 'hrms',
}

# ---------------------------------------------------------------------------
# DDL statements — all wrapped in IF NOT EXISTS / column existence checks
# ---------------------------------------------------------------------------

CREATE_RAW_LOGS = """
CREATE TABLE IF NOT EXISTS biometric_raw_logs (
    id              BIGINT          AUTO_INCREMENT PRIMARY KEY,
    enroll_id       VARCHAR(50)     NOT NULL COMMENT 'Machine EnrollID (e.g. 0042)',
    device_id       VARCHAR(50)     NOT NULL COMMENT 'Which physical device/branch',
    punch_time      DATETIME        NOT NULL,
    punch_type      ENUM('IN','OUT','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    raw_payload     JSON            COMMENT 'Full API response row for auditability',
    source          VARCHAR(30)     NOT NULL DEFAULT 'TIMEWATCH',
    synced_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_processed    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '0=pending, 1=processed',

    UNIQUE KEY uq_punch (enroll_id, device_id, punch_time),
    INDEX idx_enroll   (enroll_id),
    INDEX idx_device   (device_id),
    INDEX idx_pending  (is_processed, punch_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Immutable raw punch log — never UPDATE rows, only INSERT';
"""

CREATE_EMPLOYEE_MAP = """
CREATE TABLE IF NOT EXISTS biometric_employee_map (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    enroll_id       VARCHAR(50)     NOT NULL COMMENT 'EnrollID as stored on the machine',
    device_id       VARCHAR(50)     NOT NULL DEFAULT '*' COMMENT '* = valid on any device',
    employee_id     VARCHAR(20)     NOT NULL COMMENT 'HRMS employee_id (e.g. EMP0042)',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    mapped_by       VARCHAR(50)     COMMENT 'HRMS user who created the mapping',
    mapped_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           VARCHAR(255),

    UNIQUE KEY uq_map (enroll_id, device_id),
    INDEX idx_employee (employee_id),
    INDEX idx_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Bridge: biometric EnrollID/DeviceID -> HRMS employee_id';
"""

CREATE_SYNC_LOG = """
CREATE TABLE IF NOT EXISTS biometric_sync_log (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    device_id       VARCHAR(50)     NOT NULL,
    sync_start      DATETIME        NOT NULL,
    sync_end        DATETIME        COMMENT 'NULL while status=RUNNING',
    records_fetched INT             NOT NULL DEFAULT 0,
    records_new     INT             NOT NULL DEFAULT 0,
    status          ENUM('RUNNING','SUCCESS','FAILED') NOT NULL DEFAULT 'RUNNING',
    error_detail    TEXT            COMMENT 'Last error message if status=FAILED',

    UNIQUE KEY uq_sync (device_id, sync_start),
    INDEX idx_status  (status, sync_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='One row per sync attempt — used to compute next lookback window';
"""

CREATE_MISSING_PUNCHES = """
CREATE TABLE IF NOT EXISTS biometric_missing_punches (
    id              INT             AUTO_INCREMENT PRIMARY KEY,
    employee_id     VARCHAR(20)     NOT NULL,
    punch_date      DATE            NOT NULL,
    missing_type    ENUM('IN','OUT') NOT NULL COMMENT 'Which punch is absent',
    available_punch DATETIME        COMMENT 'The punch that DID arrive',
    resolved        TINYINT(1)      NOT NULL DEFAULT 0,
    resolved_by     VARCHAR(50),
    resolved_at     DATETIME,
    resolution_note VARCHAR(255),
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_missing  (employee_id, punch_date),
    INDEX idx_unresolved   (resolved, punch_date),
    INDEX idx_employee     (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='Flags days where only one side of an IN/OUT pair was received';
"""

# ---------------------------------------------------------------------------
# ALTER statements — only add columns that do not already exist
# ---------------------------------------------------------------------------

ALTER_ATTENDANCE_SOURCE = """
ALTER TABLE attendance
    ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
        COMMENT 'MANUAL | BIOMETRIC | REGULARIZED | GPS'
        AFTER beyond_grace;
"""

ALTER_ATTENDANCE_BIO_ID = """
ALTER TABLE attendance
    ADD COLUMN biometric_log_id BIGINT DEFAULT NULL
        COMMENT 'FK -> biometric_raw_logs.id (NULL for non-biometric records)'
        AFTER source;
"""

ALTER_ATTENDANCE_BIO_IDX = """
ALTER TABLE attendance
    ADD INDEX idx_source (source),
    ADD INDEX idx_bio_log (biometric_log_id);
"""


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(
        """SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME   = %s
             AND COLUMN_NAME  = %s""",
        (table, column),
    )
    return cursor.fetchone()[0] > 0


def index_exists(cursor, table: str, index_name: str) -> bool:
    cursor.execute(
        """SELECT COUNT(*) FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME   = %s
             AND INDEX_NAME   = %s""",
        (table, index_name),
    )
    return cursor.fetchone()[0] > 0


def run_migration():
    print("=" * 60)
    print("  Biometric Integration — Phase 1 Migration")
    print("=" * 60)

    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print(f"\n[OK] Connected to database: {DB_CONFIG['database']}")
    except Error as e:
        print(f"\n[FAIL] Cannot connect to MySQL: {e}")
        sys.exit(1)

    steps = []

    # ------------------------------------------------------------------
    # 1. Create new tables
    # ------------------------------------------------------------------
    new_tables = [
        ("biometric_raw_logs",       CREATE_RAW_LOGS),
        ("biometric_employee_map",   CREATE_EMPLOYEE_MAP),
        ("biometric_sync_log",       CREATE_SYNC_LOG),
        ("biometric_missing_punches", CREATE_MISSING_PUNCHES),
    ]

    for table_name, ddl in new_tables:
        try:
            cursor.execute(ddl)
            conn.commit()
            steps.append((table_name, "created / already exists", True))
            print(f"  [OK] Table `{table_name}`")
        except Error as e:
            steps.append((table_name, str(e), False))
            print(f"  [FAIL] Table `{table_name}`: {e}")

    # ------------------------------------------------------------------
    # 2. Alter existing `attendance` table (idempotent column adds)
    # ------------------------------------------------------------------
    print("\n  Patching `attendance` table ...")

    if not column_exists(cursor, "attendance", "source"):
        try:
            cursor.execute(ALTER_ATTENDANCE_SOURCE)
            conn.commit()
            steps.append(("attendance.source", "added", True))
            print("  [OK] Column `attendance.source` added")
        except Error as e:
            steps.append(("attendance.source", str(e), False))
            print(f"  [FAIL] Column `attendance.source`: {e}")
    else:
        steps.append(("attendance.source", "already exists — skipped", True))
        print("  [SKIP] Column `attendance.source` already exists")

    if not column_exists(cursor, "attendance", "biometric_log_id"):
        try:
            cursor.execute(ALTER_ATTENDANCE_BIO_ID)
            conn.commit()
            steps.append(("attendance.biometric_log_id", "added", True))
            print("  [OK] Column `attendance.biometric_log_id` added")
        except Error as e:
            steps.append(("attendance.biometric_log_id", str(e), False))
            print(f"  [FAIL] Column `attendance.biometric_log_id`: {e}")
    else:
        steps.append(("attendance.biometric_log_id", "already exists — skipped", True))
        print("  [SKIP] Column `attendance.biometric_log_id` already exists")

    # Add indexes only if they don't exist yet
    for idx in ("idx_source", "idx_bio_log"):
        if not index_exists(cursor, "attendance", idx):
            try:
                if idx == "idx_source":
                    cursor.execute("ALTER TABLE attendance ADD INDEX idx_source (source)")
                else:
                    cursor.execute("ALTER TABLE attendance ADD INDEX idx_bio_log (biometric_log_id)")
                conn.commit()
                print(f"  [OK] Index `{idx}` on `attendance` added")
            except Error as e:
                print(f"  [SKIP] Index `{idx}`: {e}")
        else:
            print(f"  [SKIP] Index `{idx}` already exists")

    # ------------------------------------------------------------------
    # 3. Summary
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    failed = [s for s in steps if not s[2]]
    if failed:
        print(f"  Migration completed with {len(failed)} error(s):")
        for name, msg, _ in failed:
            print(f"    - {name}: {msg}")
        sys.exit(1)
    else:
        print(f"  Migration SUCCESSFUL — {len(steps)} steps applied / verified.")
        print("\n  Tables ready:")
        print("    biometric_raw_logs         — immutable punch store")
        print("    biometric_employee_map     — EnrollID -> employee_id bridge")
        print("    biometric_sync_log         — poll history + error tracking")
        print("    biometric_missing_punches  — single-punch anomaly tracker")
        print("    attendance.source          — MANUAL | BIOMETRIC | REGULARIZED | GPS")
        print("    attendance.biometric_log_id — traceability back to raw log")

    cursor.close()
    conn.close()
    print("\n  Phase 1 complete. Ready for Phase 2 (Sync Engine).")
    print("=" * 60)


if __name__ == "__main__":
    run_migration()
