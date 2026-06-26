-- Final Settlement (F&F) Table

CREATE TABLE IF NOT EXISTS final_settlements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    resignation_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    notice_period_days INT DEFAULT 0,
    notice_shortfall_days INT DEFAULT 0,
    
    -- Salary Components
    pending_salary DECIMAL(10,2) DEFAULT 0,
    earned_leave_days INT DEFAULT 0,
    earned_leave_amount DECIMAL(10,2) DEFAULT 0,
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Deductions
    notice_recovery DECIMAL(10,2) DEFAULT 0,
    advance_recovery DECIMAL(10,2) DEFAULT 0,
    other_deductions DECIMAL(10,2) DEFAULT 0,
    
    -- Final Amounts
    gross_amount DECIMAL(10,2) NOT NULL,
    total_deductions DECIMAL(10,2) NOT NULL,
    net_settlement DECIMAL(10,2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    processed_by VARCHAR(50),
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_employee (employee_id),
    INDEX idx_status (status)
);
