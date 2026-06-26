-- Add flagged columns to kanban_tasks table
ALTER TABLE kanban_tasks 
ADD COLUMN flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN flagged_at TIMESTAMP NULL;
