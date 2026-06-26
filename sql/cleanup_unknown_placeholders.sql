-- cleanup_unknown_placeholders.sql
-- Removes all auto-provisioned "Unknown - X" placeholder data so the next
-- sync cycle can re-provision those enroll_ids with real names from IDMS.
--
-- Run this in MySQL (HRMS database), NOT in SQL Server.
-- Safe to run while the FastAPI server is running — the worker will
-- re-provision automatically within 30 seconds of this script completing.
--
-- Order matters: delete child records before parents to avoid FK violations.

-- ── Step 1: Remove attendance records linked to Unknown placeholders ──────────
-- (These were created against BIO* employee codes with no real name)
DELETE a
FROM attendance a
INNER JOIN employees e ON a.employee_id = e.employee_code
WHERE e.employee_code LIKE 'BIO%'
  AND e.status = 'pending';

-- ── Step 2: Remove the biometric mappings for Unknown placeholders ────────────
DELETE m
FROM biometric_employee_map m
INNER JOIN employees e ON m.employee_id = e.employee_code
WHERE e.employee_code LIKE 'BIO%'
  AND e.status = 'pending';

-- ── Step 3: Remove the Unknown placeholder employee records themselves ─────────
DELETE FROM employees
WHERE employee_code LIKE 'BIO%'
  AND status = 'pending';

-- ── Step 4: Reset punch processing flags for the last 24 hours ───────────────
-- This allows Stage 2 to re-create attendance for the newly named employees.
UPDATE biometric_raw_logs
SET    is_processed = 0
WHERE  punch_time >= NOW() - INTERVAL 24 HOUR;

-- ── Verify: these should all return 0 after running ──────────────────────────
SELECT COUNT(*) AS remaining_unknown_employees FROM employees
WHERE employee_code LIKE 'BIO%' AND status = 'pending';

SELECT COUNT(*) AS remaining_unknown_mappings FROM biometric_employee_map
WHERE notes LIKE '%Placeholder%';

SELECT COUNT(*) AS unprocessed_punches FROM biometric_raw_logs
WHERE is_processed = 0;
