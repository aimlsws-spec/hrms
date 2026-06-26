-- =============================================================================
-- Home Location Change Requests — Database Migration
-- Employees can set their home location only once; subsequent changes
-- require an HR-approved request.
-- Safe to run multiple times (IF NOT EXISTS guards)
-- =============================================================================

CREATE TABLE IF NOT EXISTS home_location_change_requests (
    id                       INT           NOT NULL AUTO_INCREMENT,
    employee_id              VARCHAR(50)   NOT NULL COMMENT 'FK → employees.employee_code',

    requested_latitude       DECIMAL(10,8) NOT NULL,
    requested_longitude      DECIMAL(11,8) NOT NULL,
    requested_address_label  VARCHAR(500)  NULL,
    request_reason           VARCHAR(500)  NULL,

    status    ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    hr_comment               VARCHAR(500)  NULL,
    reviewed_by              VARCHAR(50)   NULL COMMENT 'user_id of HR who actioned the request',
    reviewed_at              TIMESTAMP     NULL,

    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_emp_status  (employee_id, status),
    INDEX idx_status      (status),
    INDEX idx_created     (created_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='HR-approval workflow for employee home location changes';
