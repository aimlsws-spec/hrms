-- Add salary column to employees table if it doesn't exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary DECIMAL(12,2) DEFAULT NULL COMMENT 'Annual CTC';

-- Update existing employees with salary from salary_structures if available
UPDATE employees e
LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
SET e.salary = ss.annual_ctc
WHERE ss.annual_ctc IS NOT NULL;
