-- Accountant Module Database Schema

-- Salary Structure Templates
CREATE TABLE IF NOT EXISTS salary_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    ctc_min DECIMAL(12,2),
    ctc_max DECIMAL(12,2),
    basic_percentage DECIMAL(5,2) DEFAULT 40.00,
    hra_percentage DECIMAL(5,2) DEFAULT 20.00,
    da_percentage DECIMAL(5,2) DEFAULT 10.00,
    transport_allowance DECIMAL(10,2) DEFAULT 2000.00,
    medical_allowance DECIMAL(10,2) DEFAULT 1500.00,
    special_allowance_percentage DECIMAL(5,2) DEFAULT 10.00,
    pf_percentage DECIMAL(5,2) DEFAULT 12.00,
    esi_percentage DECIMAL(5,2) DEFAULT 0.75,
    professional_tax DECIMAL(10,2) DEFAULT 200.00,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Employee Salary Structures
CREATE TABLE IF NOT EXISTS employee_salaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    ctc DECIMAL(12,2) NOT NULL,
    basic_salary DECIMAL(12,2),
    hra DECIMAL(12,2),
    da DECIMAL(12,2),
    transport_allowance DECIMAL(10,2),
    medical_allowance DECIMAL(10,2),
    special_allowance DECIMAL(12,2),
    gross_salary DECIMAL(12,2),
    pf_deduction DECIMAL(10,2),
    esi_deduction DECIMAL(10,2),
    professional_tax DECIMAL(10,2),
    income_tax DECIMAL(10,2) DEFAULT 0,
    total_deductions DECIMAL(12,2),
    net_salary DECIMAL(12,2),
    effective_from DATE,
    status ENUM('pending', 'approved', 'active', 'revised') DEFAULT 'pending',
    approved_by VARCHAR(50),
    approved_at TIMESTAMP NULL,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_emp_effective (employee_id, effective_from)
);

-- Monthly Payroll
CREATE TABLE IF NOT EXISTS monthly_payroll (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    month_year VARCHAR(7) NOT NULL,
    basic_salary DECIMAL(12,2),
    hra DECIMAL(12,2),
    allowances DECIMAL(12,2),
    gross_salary DECIMAL(12,2),
    deductions DECIMAL(12,2),
    net_salary DECIMAL(12,2),
    days_worked INT DEFAULT 30,
    days_absent INT DEFAULT 0,
    status ENUM('draft', 'processed', 'paid') DEFAULT 'draft',
    processed_by VARCHAR(50),
    processed_at TIMESTAMP NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_emp_month (employee_id, month_year)
);

-- Reimbursements
CREATE TABLE IF NOT EXISTS reimbursements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    amount DECIMAL(10,2),
    description TEXT,
    receipt_path VARCHAR(255),
    status ENUM('pending', 'approved', 'rejected', 'paid') DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(50),
    reviewed_at TIMESTAMP NULL,
    comments TEXT
);

-- Tax Slabs (Indian Tax System)
CREATE TABLE IF NOT EXISTS tax_slabs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    financial_year VARCHAR(10),
    min_income DECIMAL(12,2),
    max_income DECIMAL(12,2),
    tax_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default salary template
INSERT INTO salary_templates (template_name, ctc_min, ctc_max, created_by) 
VALUES ('Standard Template', 300000, 10000000, 'system')
ON DUPLICATE KEY UPDATE template_name=template_name;

-- Insert default tax slabs (FY 2024-25)
INSERT INTO tax_slabs (financial_year, min_income, max_income, tax_rate) VALUES
('2024-25', 0, 250000, 0),
('2024-25', 250001, 500000, 5),
('2024-25', 500001, 750000, 10),
('2024-25', 750001, 1000000, 15),
('2024-25', 1000001, 1250000, 20),
('2024-25', 1250001, 1500000, 25),
('2024-25', 1500001, 999999999, 30)
ON DUPLICATE KEY UPDATE financial_year=financial_year;
