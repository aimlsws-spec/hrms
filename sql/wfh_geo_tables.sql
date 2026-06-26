-- =============================================================================
-- WFH Geo Attendance — Database Migration
-- Safe to run multiple times (IF NOT EXISTS / IGNORE guards throughout)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: employee_home_locations
-- Stores geocoded home coordinates for WFH geo-attendance validation.
-- Populated by HR manually or by employee registering from home via GPS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_home_locations (
    id              INT           NOT NULL AUTO_INCREMENT,
    employee_id     VARCHAR(50)   NOT NULL COMMENT 'FK → employees.employee_code',

    latitude        DECIMAL(10,8) NOT NULL,
    longitude       DECIMAL(11,8) NOT NULL,

    -- Human-readable label (copied from employee_profiles.current_address or entered by HR)
    address_label   VARCHAR(500)  NULL,

    -- How the coordinates were established
    registered_via  ENUM('employee_gps', 'hr_manual', 'geocoded') NOT NULL DEFAULT 'hr_manual',

    updated_by      VARCHAR(50)   NULL COMMENT 'user_id of who last updated',

    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE  KEY uq_employee     (employee_id),
    INDEX       idx_employee    (employee_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Employee home GPS coordinates for WFH geo-attendance validation';


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER wfh_attendance: add geo columns
-- Using separate statements with error suppression so this is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- attendance_method: SELFIE (default, preserves all existing rows) or GEO
ALTER TABLE wfh_attendance
    ADD COLUMN IF NOT EXISTS attendance_method  ENUM('SELFIE','GEO') NOT NULL DEFAULT 'SELFIE'
        COMMENT 'Which method was used: webcam selfie or geo-location'
        AFTER status;

-- GPS coordinates submitted at geo check-in time
ALTER TABLE wfh_attendance
    ADD COLUMN IF NOT EXISTS geo_latitude       DECIMAL(10,8)        NULL
        COMMENT 'Latitude submitted by employee at geo check-in'
        AFTER attendance_method;

ALTER TABLE wfh_attendance
    ADD COLUMN IF NOT EXISTS geo_longitude      DECIMAL(11,8)        NULL
        COMMENT 'Longitude submitted by employee at geo check-in'
        AFTER geo_latitude;

ALTER TABLE wfh_attendance
    ADD COLUMN IF NOT EXISTS geo_distance_meters DECIMAL(10,2)       NULL
        COMMENT 'Calculated distance (meters) from registered home location at check-in'
        AFTER geo_longitude;


-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIGURATION: geo radius (reuses existing wfh_system_config table)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT IGNORE INTO wfh_system_config (config_key, config_value, description) VALUES
    ('wfh_geo_radius_meters', '300',
     'Radius in meters within which an employee is considered at home for geo attendance. Recommended 200–500.');
