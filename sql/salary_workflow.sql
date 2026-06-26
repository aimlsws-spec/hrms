-- Salary Structures Table
CREATE TABLE IF NOT EXISTS salary_structures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    annual_ctc DECIMAL(12,2) NOT NULL,
    template VARCHAR(50) DEFAULT 'standard',
    basic_salary DECIMAL(12,2),
    hra DECIMAL(12,2),
    special_allowance DECIMAL(12,2),
    transport_allowance DECIMAL(12,2),
    medical_allowance DECIMAL(12,2),
    pf_employer DECIMAL(12,2),
    pf_employee DECIMAL(12,2),
    professional_tax DECIMAL(12,2),
    gross_salary DECIMAL(12,2),
    total_deductions DECIMAL(12,2),
    net_salary DECIMAL(12,2),
    status ENUM('pending', 'approved', 'active', 'inactive') DEFAULT 'pending',
    created_by VARCHAR(50),
    approved_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    effective_from DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    INDEX idx_employee (employee_id),
    INDEX idx_status (status)
);

-- Payroll Runs Table
CREATE TABLE IF NOT EXISTS payroll_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(50) UNIQUE NOT NULL,
    month_year VARCHAR(7) NOT NULL,
    total_employees INT DEFAULT 0,
    processed_count INT DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    processed_by VARCHAR(50),
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_month (month_year),
    INDEX idx_status (status)
);

-- Payroll Transactions Table
CREATE TABLE IF NOT EXISTS payroll_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    run_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    month_year VARCHAR(7) NOT NULL,
    salary_structure_id INT,
    gross_salary DECIMAL(12,2),
    total_deductions DECIMAL(12,2),
    net_salary DECIMAL(12,2),
    slip_generated BOOLEAN DEFAULT FALSE,
    slip_filename VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES payroll_runs(run_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id),
    INDEX idx_run (run_id),
    INDEX idx_employee (employee_id),
    INDEX idx_month (month_year)
);
