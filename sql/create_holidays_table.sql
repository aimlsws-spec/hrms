-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50) DEFAULT 'National',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (date)
);

-- Insert default holidays for 2025
INSERT INTO holidays (name, date, type) VALUES
('Republic Day', '2025-01-26', 'National'),
('Holi', '2025-03-14', 'Festival'),
('Ambedkar Jayanti', '2025-04-14', 'National'),
('Independence Day', '2025-08-15', 'National'),
('Gandhi Jayanti', '2025-10-02', 'National'),
('Diwali', '2025-10-24', 'Festival'),
('Christmas', '2025-12-25', 'Festival');
