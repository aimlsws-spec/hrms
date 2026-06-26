-- Performance Management Tables

CREATE TABLE IF NOT EXISTS performance_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    review_period VARCHAR(20) NOT NULL,
    review_date DATE NOT NULL,
    reviewer_id VARCHAR(50) NOT NULL,
    technical_skills INT DEFAULT 0,
    communication INT DEFAULT 0,
    teamwork INT DEFAULT 0,
    productivity INT DEFAULT 0,
    leadership INT DEFAULT 0,
    overall_rating DECIMAL(3,2) DEFAULT 0,
    strengths TEXT,
    areas_improvement TEXT,
    goals TEXT,
    comments TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee (employee_id),
    INDEX idx_period (review_period)
);

CREATE TABLE IF NOT EXISTS goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    goal_title VARCHAR(200) NOT NULL,
    description TEXT,
    target_date DATE,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS',
    progress INT DEFAULT 0,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_employee (employee_id)
);
