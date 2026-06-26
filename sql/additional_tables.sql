-- HRMS Additional Tables for Remaining Features

-- 1. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    attendance_date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status ENUM('Present', 'Absent', 'Half Day', 'Late', 'Leave', 'Holiday') DEFAULT 'Present',
    work_hours DECIMAL(4,2),
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INT DEFAULT 0,
    remarks TEXT,
    marked_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attendance (employee_id, attendance_date),
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 2. LEAVE BALANCE TABLE
CREATE TABLE IF NOT EXISTS leave_balance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    year INT NOT NULL,
    casual_leave_total INT DEFAULT 12,
    casual_leave_used INT DEFAULT 0,
    sick_leave_total INT DEFAULT 12,
    sick_leave_used INT DEFAULT 0,
    earned_leave_total INT DEFAULT 15,
    earned_leave_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_leave_balance (employee_id, year),
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. SALARY STRUCTURE TABLE
CREATE TABLE IF NOT EXISTS salary_structure (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    effective_from DATE NOT NULL,
    basic_salary DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) DEFAULT 0,
    transport_allowance DECIMAL(10,2) DEFAULT 0,
    medical_allowance DECIMAL(10,2) DEFAULT 0,
    special_allowance DECIMAL(10,2) DEFAULT 0,
    pf_deduction DECIMAL(10,2) DEFAULT 0,
    esic_deduction DECIMAL(10,2) DEFAULT 0,
    tds_deduction DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    gross_salary DECIMAL(10,2) NOT NULL,
    net_salary DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. SALARY REVISIONS TABLE
CREATE TABLE IF NOT EXISTS salary_revisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    old_salary DECIMAL(10,2),
    new_salary DECIMAL(10,2),
    revision_date DATE NOT NULL,
    revision_type ENUM('Increment', 'Promotion', 'Bonus', 'Adjustment') DEFAULT 'Increment',
    percentage DECIMAL(5,2),
    reason TEXT,
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    department_id VARCHAR(50) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    department_head VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. DESIGNATIONS TABLE
CREATE TABLE IF NOT EXISTS designations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    designation_id VARCHAR(50) UNIQUE NOT NULL,
    designation_name VARCHAR(100) NOT NULL,
    department_id VARCHAR(50),
    level INT DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE SET NULL
);

-- 7. PERFORMANCE CYCLES TABLE
CREATE TABLE IF NOT EXISTS performance_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cycle_id VARCHAR(50) UNIQUE NOT NULL,
    cycle_name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    review_type ENUM('Annual', 'Half-Yearly', 'Quarterly', 'Monthly') DEFAULT 'Annual',
    status ENUM('Draft', 'Active', 'Completed', 'Cancelled') DEFAULT 'Draft',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. PERFORMANCE REVIEWS TABLE
CREATE TABLE IF NOT EXISTS performance_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    review_id VARCHAR(50) UNIQUE NOT NULL,
    cycle_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    reviewer_id VARCHAR(50),
    self_review TEXT,
    manager_review TEXT,
    rating DECIMAL(3,2),
    grade VARCHAR(10),
    strengths TEXT,
    areas_of_improvement TEXT,
    goals TEXT,
    status ENUM('Pending', 'Self Review Done', 'Manager Review Done', 'Completed') DEFAULT 'Pending',
    review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cycle_id) REFERENCES performance_cycles(cycle_id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. KPI/OKR TABLE
CREATE TABLE IF NOT EXISTS kpis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kpi_id VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    cycle_id VARCHAR(50),
    kpi_name VARCHAR(200) NOT NULL,
    description TEXT,
    target_value VARCHAR(100),
    achieved_value VARCHAR(100),
    weightage DECIMAL(5,2) DEFAULT 10.00,
    status ENUM('Not Started', 'In Progress', 'Achieved', 'Not Achieved') DEFAULT 'Not Started',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (cycle_id) REFERENCES performance_cycles(cycle_id) ON DELETE CASCADE
);

-- 10. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50),
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 11. HOLIDAYS TABLE
CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_type ENUM('National', 'Regional', 'Company') DEFAULT 'Company',
    is_optional BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. COMPANY SETTINGS TABLE
CREATE TABLE IF NOT EXISTS company_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50),
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 13. BONUS & INCENTIVES TABLE
CREATE TABLE IF NOT EXISTS bonuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    bonus_type ENUM('Performance', 'Festival', 'Referral', 'Project', 'Other') DEFAULT 'Performance',
    amount DECIMAL(10,2) NOT NULL,
    bonus_month VARCHAR(7),
    reason TEXT,
    approved_by VARCHAR(100),
    status ENUM('Pending', 'Approved', 'Paid') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 14. FINAL SETTLEMENT TABLE
CREATE TABLE IF NOT EXISTS final_settlements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    last_working_date DATE NOT NULL,
    notice_period_days INT DEFAULT 0,
    notice_period_recovery DECIMAL(10,2) DEFAULT 0,
    pending_salary DECIMAL(10,2) DEFAULT 0,
    leave_encashment DECIMAL(10,2) DEFAULT 0,
    gratuity DECIMAL(10,2) DEFAULT 0,
    other_dues DECIMAL(10,2) DEFAULT 0,
    deductions DECIMAL(10,2) DEFAULT 0,
    net_payable DECIMAL(10,2) NOT NULL,
    status ENUM('Draft', 'Approved', 'Paid') DEFAULT 'Draft',
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_salary_structure_employee ON salary_structure(employee_id);
CREATE INDEX idx_performance_employee ON performance_reviews(employee_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_date ON activity_logs(created_at);
