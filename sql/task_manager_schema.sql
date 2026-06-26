-- Kanban Task Manager Database Schema

-- Task Boards Table
CREATE TABLE IF NOT EXISTS task_boards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Kanban Tasks Table
CREATE TABLE IF NOT EXISTS kanban_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    board_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in_progress', 'review', 'done') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    assigned_to VARCHAR(50),
    created_by VARCHAR(50),
    due_date DATE,
    position INT DEFAULT 0,
    flagged BOOLEAN DEFAULT FALSE,
    flagged_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE,
    INDEX idx_board_status (board_id, status),
    INDEX idx_assigned (assigned_to)
);

-- Task Comments Table
CREATE TABLE IF NOT EXISTS task_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE
);

-- Insert default board
INSERT INTO task_boards (name, description, created_by) 
VALUES ('HRMS Project Board', 'Main project management board', 'admin')
ON DUPLICATE KEY UPDATE name=name;
