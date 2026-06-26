-- =============================================================================
-- WFH Selfie Evidence System — Database Migration
-- Safe to run multiple times (IF NOT EXISTS guards throughout)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: wfh_attendance
-- Tracks each WFH session (punch-in / punch-out pair).
-- A successful punch-in also writes to the existing `attendance` table so
-- payslip calculations (present-days count) continue to work unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wfh_attendance (
    id                      INT          NOT NULL AUTO_INCREMENT,
    employee_id             VARCHAR(50)  NOT NULL COMMENT 'FK → employees.employee_code',
    attendance_id           INT          NULL     COMMENT 'FK → attendance.id (written after attendance row created)',

    -- Session timing (all server-generated — never trust client timestamps)
    punch_in_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    punch_out_at            TIMESTAMP    NULL,
    duration_minutes        SMALLINT UNSIGNED NULL COMMENT 'Computed on punch-out',

    -- Idempotency: prevents duplicate records from double-click or network retry
    idempotency_key         VARCHAR(36)  NOT NULL COMMENT 'UUID from client, single-use',

    -- Overall workflow status
    status                  ENUM(
                                'PENDING_SELFIE',   -- punch-in accepted, selfie not yet uploaded
                                'AUTO_APPROVED',    -- selfie captured, no flags
                                'FLAGGED',          -- soft flag for HR awareness
                                'PENDING_REVIEW',   -- requires HR decision
                                'APPROVED',         -- HR approved
                                'REJECTED'          -- HR rejected
                            ) NOT NULL DEFAULT 'PENDING_SELFIE',

    flag_reason             VARCHAR(500) NULL     COMMENT 'Human-readable reason for flag',

    -- Request metadata (for anomaly detection)
    client_ip               VARCHAR(45)  NOT NULL,
    user_agent              TEXT         NOT NULL,
    client_timestamp        TIMESTAMP    NULL     COMMENT 'Client-reported time — audit only, never authoritative',

    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE  KEY uq_idempotency   (idempotency_key),
    UNIQUE  KEY uq_emp_date      (employee_id, (DATE(punch_in_at))) COMMENT 'One WFH session per employee per day',
    INDEX       idx_employee     (employee_id),
    INDEX       idx_status       (status),
    INDEX       idx_punch_in     (punch_in_at),
    INDEX       idx_attendance   (attendance_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='WFH session records — one row per employee per WFH day';


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: attendance_selfies
-- Metadata for each captured selfie image.
-- Image bytes are NEVER stored in the database — only the storage reference.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_selfies (
    id                      INT          NOT NULL AUTO_INCREMENT,
    employee_id             VARCHAR(50)  NOT NULL COMMENT 'Denormalised for fast HR queries',
    wfh_attendance_id       INT          NOT NULL COMMENT 'FK → wfh_attendance.id',
    capture_type            ENUM('checkin', 'checkout') NOT NULL DEFAULT 'checkin',

    -- Storage reference (UUID v4 — no employee info in filename)
    storage_key             CHAR(36)     NOT NULL COMMENT 'UUID v4 used as encrypted filename',
    storage_backend         ENUM('local_encrypted') NOT NULL DEFAULT 'local_encrypted',

    -- Image metadata (populated after server-side transcoding)
    file_hash               CHAR(64)     NOT NULL COMMENT 'SHA-256 of plaintext JPEG after EXIF strip',
    mime_type               VARCHAR(30)  NOT NULL DEFAULT 'image/jpeg',
    file_size_bytes         INT UNSIGNED NOT NULL,
    width_px                SMALLINT UNSIGNED NOT NULL,
    height_px               SMALLINT UNSIGNED NOT NULL,

    -- Capture context
    camera_device_label     VARCHAR(200) NULL     COMMENT 'Browser-reported device name — anomaly signal',
    capture_attempt_count   TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1-3 attempts allowed',

    -- Timestamps
    captured_at             TIMESTAMP    NOT NULL COMMENT 'Server-generated when upload accepted',
    uploaded_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retention_expires_at    DATE         NOT NULL COMMENT 'Deletion date = captured_at + retention_months',

    -- Lifecycle
    status                  ENUM(
                                'active',
                                'deletion_pending',
                                'deleted'
                            ) NOT NULL DEFAULT 'active',
    deleted_at              TIMESTAMP    NULL,
    deletion_reason         ENUM(
                                'retention_expired',
                                'consent_withdrawn',
                                'hr_request',
                                'employee_request',
                                'system_error'
                            ) NULL,

    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE  KEY uq_wfh_capture   (wfh_attendance_id, capture_type) COMMENT 'One selfie per capture type per session',
    UNIQUE  KEY uq_storage_key   (storage_key),
    INDEX       idx_employee     (employee_id),
    INDEX       idx_status       (status),
    INDEX       idx_retention    (retention_expires_at, status) COMMENT 'Retention cleanup job uses this',
    INDEX       idx_captured_at  (captured_at),

    CONSTRAINT fk_selfie_wfh
        FOREIGN KEY (wfh_attendance_id) REFERENCES wfh_attendance(id)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Selfie image metadata — bytes stored encrypted on disk, never in DB';


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: selfie_access_log
-- Immutable audit trail for every HR interaction with a selfie.
-- Rows are NEVER updated or deleted — this table is append-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS selfie_access_log (
    id                      INT          NOT NULL AUTO_INCREMENT,
    selfie_id               INT          NOT NULL COMMENT 'FK → attendance_selfies.id',
    wfh_attendance_id       INT          NOT NULL COMMENT 'Denormalised — avoids join in HR queries',
    employee_id             VARCHAR(50)  NOT NULL COMMENT 'Whose selfie was accessed',

    -- Who accessed it
    accessed_by_user_id     INT          NOT NULL COMMENT 'FK → users.user_id (HR reviewer)',
    accessed_by_name        VARCHAR(100) NOT NULL COMMENT 'Snapshot of reviewer name at access time',
    accessed_by_role        VARCHAR(20)  NOT NULL COMMENT 'Role at time of access',

    -- What they did
    access_type             ENUM(
                                'view',           -- HR opened the selfie image
                                'approve',        -- HR approved the attendance record
                                'reject',         -- HR rejected the attendance record
                                'retention_delete', -- system automated deletion
                                'manual_delete'   -- HR/admin triggered deletion
                            ) NOT NULL,
    hr_comment              TEXT         NULL     COMMENT 'Required for approve/reject actions',
    wfh_status_before       VARCHAR(20)  NULL     COMMENT 'Snapshot of wfh_attendance.status before action',
    wfh_status_after        VARCHAR(20)  NULL     COMMENT 'Snapshot of wfh_attendance.status after action',

    -- Request metadata
    ip_address              VARCHAR(45)  NOT NULL,
    user_agent              TEXT         NOT NULL,

    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_selfie         (selfie_id),
    INDEX idx_wfh            (wfh_attendance_id),
    INDEX idx_employee       (employee_id),
    INDEX idx_accessed_by    (accessed_by_user_id),
    INDEX idx_access_type    (access_type),
    INDEX idx_created_at     (created_at),

    CONSTRAINT fk_log_selfie
        FOREIGN KEY (selfie_id) REFERENCES attendance_selfies(id)
        ON UPDATE CASCADE ON DELETE RESTRICT

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Append-only audit log — every HR access to a selfie image';


-- ─────────────────────────────────────────────────────────────────────────────
-- SYSTEM CONFIGURATION: retention period (configurable without code change)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wfh_system_config (
    config_key              VARCHAR(100) NOT NULL,
    config_value            VARCHAR(500) NOT NULL,
    description             TEXT         NULL,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default configuration (safe to re-run — INSERT IGNORE)
INSERT IGNORE INTO wfh_system_config (config_key, config_value, description) VALUES
    ('selfie_retention_months',  '12',    'Months to retain selfie images before automated deletion'),
    ('selfie_max_file_size_kb',  '2048',  'Maximum selfie upload size in kilobytes'),
    ('selfie_min_width_px',      '100',   'Minimum image width in pixels'),
    ('selfie_min_height_px',     '100',   'Minimum image height in pixels'),
    ('selfie_max_capture_attempts', '3',  'Maximum retake attempts per session'),
    ('wfh_auto_close_hours',     '14',   'Hours after which an unclosed WFH session is auto-closed');
