-- Critical Features: Shift Management, GPS Attendance, Attendance Regularization

-- 1. SHIFT MANAGEMENT
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shift_name VARCHAR(100) NOT NULL,
    shift_type ENUM('Regular', 'Rotating', 'Overnight', 'Flexible') DEFAULT 'Regular',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INT DEFAULT 0 COMMENT 'Break duration in minutes',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift_type (shift_type)
);

CREATE TABLE IF NOT EXISTS employee_shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    shift_id INT NOT NULL,
    effective_date DATE NOT NULL,
    end_date DATE NULL,
    rotation_pattern VARCHAR(100) COMMENT 'e.g., Week1-Morning,Week2-Evening',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES shifts(id),
    INDEX idx_employee (employee_id),
    INDEX idx_effective_date (effective_date)
);

-- 2. GPS ATTENDANCE
CREATE TABLE IF NOT EXISTS gps_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    attendance_date DATE NOT NULL,
    check_in_time DATETIME,
    check_in_latitude DECIMAL(10, 8),
    check_in_longitude DECIMAL(11, 8),
    check_in_location VARCHAR(255),
    check_out_time DATETIME,
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    check_out_location VARCHAR(255),
    is_within_geofence BOOLEAN DEFAULT FALSE,
    distance_from_office DECIMAL(10, 2) COMMENT 'Distance in meters',
    device_info VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_gps_attendance (employee_id, attendance_date),
    INDEX idx_employee (employee_id),
    INDEX idx_date (attendance_date)
);

CREATE TABLE IF NOT EXISTS geofence_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ATTENDANCE REGULARIZATION
CREATE TABLE IF NOT EXISTS attendance_regularization (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    attendance_date DATE NOT NULL,
    original_check_in TIME,
    original_check_out TIME,
    requested_check_in TIME,
    requested_check_out TIME,
    reason TEXT NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    approved_by VARCHAR(50),
    approval_comments TEXT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_status (status),
    INDEX idx_date (attendance_date)
);

-- Insert default shifts
INSERT INTO shifts (shift_name, shift_type, start_time, end_time, break_duration) VALUES
('Morning Shift', 'Regular', '09:00:00', '18:00:00', 60),
('Evening Shift', 'Regular', '14:00:00', '23:00:00', 60),
('Night Shift', 'Overnight', '22:00:00', '07:00:00', 60),
('Flexible Shift', 'Flexible', '00:00:00', '23:59:59', 0);

-- Insert default office location (update with actual coordinates)
INSERT INTO geofence_locations (location_name, latitude, longitude, radius_meters) VALUES
('Head Office', 28.6139, 77.2090, 100);
