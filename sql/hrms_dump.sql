-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: hrms
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `accountant_settings`
--

DROP TABLE IF EXISTS `accountant_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `accountant_settings` (
  `id` int NOT NULL DEFAULT '1',
  `company_name` varchar(200) NOT NULL DEFAULT 'Seawind Solutions',
  `fiscal_year_start` varchar(20) NOT NULL DEFAULT 'april',
  `currency` varchar(10) NOT NULL DEFAULT 'INR',
  `payroll_cycle` varchar(20) NOT NULL DEFAULT 'monthly',
  `pay_day` varchar(10) NOT NULL DEFAULT '25',
  `notify_payroll_processed` tinyint(1) NOT NULL DEFAULT '1',
  `notify_expense_requests` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `accountant_settings`
--

LOCK TABLES `accountant_settings` WRITE;
/*!40000 ALTER TABLE `accountant_settings` DISABLE KEYS */;
INSERT INTO `accountant_settings` VALUES (1,'Seawind Solutions','april','INR','monthly','15',1,1,'2026-06-01 11:26:55','2026-06-01 11:29:27');
/*!40000 ALTER TABLE `accountant_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_activity_logs`
--

DROP TABLE IF EXISTS `admin_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` varchar(50) NOT NULL,
  `action` varchar(200) NOT NULL,
  `details` text,
  `ip_address` varchar(50) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_id`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_activity_logs`
--

LOCK TABLES `admin_activity_logs` WRITE;
/*!40000 ALTER TABLE `admin_activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `admin_activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `announcements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_by` varchar(50) NOT NULL,
  `creator_name` varchar(150) DEFAULT 'Admin',
  `creator_role` varchar(50) DEFAULT 'admin',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_active_created` (`is_active`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `announcements`
--

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
INSERT INTO `announcements` VALUES (1,'Test Announcement','This is a test announcement for all employees.','admin','Admin User','admin',1,'2026-05-19 05:26:41'),(2,'Company Meeting','All hands meeting on Friday 3pm.','admin001','Admin User','admin',1,'2026-05-19 05:28:01'),(3,'test announcement','this is test announcement','hr001','HR Manager','hr',1,'2026-05-19 05:29:09'),(4,'New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','hr001','HR Manager','hr',1,'2026-06-03 09:54:04');
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `date` date NOT NULL,
  `status` varchar(20) NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `late_minutes` int NOT NULL DEFAULT '0',
  `overtime_minutes` int NOT NULL DEFAULT '0',
  `early_minutes` int NOT NULL DEFAULT '0',
  `beyond_grace` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance` (`employee_id`,`date`),
  UNIQUE KEY `uq_emp_date` (`employee_id`,`date`),
  KEY `idx_employee_date` (`employee_id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (1,'EMP0003','2026-05-21','PRESENT','09:20:00','03:00:00','2026-05-21 10:40:04',0,0,10,0),(3,'EMP001','2026-06-02','PRESENT','14:55:03',NULL,'2026-06-02 09:25:04',325,0,0,1),(4,'EMP0006','2026-06-02','PRESENT','15:31:47','15:33:22','2026-06-02 10:01:47',362,0,0,1),(5,'EMP0007','2026-06-03','PRESENT','13:14:35','14:34:40','2026-06-03 07:44:35',225,0,0,1),(6,'EMP0006','2026-06-03','PRESENT','13:15:02',NULL,'2026-06-03 07:45:02',225,0,0,1),(7,'EMP0008','2026-06-03','PRESENT','14:16:17','14:17:16','2026-06-03 08:46:17',286,0,0,1),(8,'EMP0009','2026-06-03','PRESENT','14:28:32','16:19:30','2026-06-03 08:58:32',299,0,0,1),(9,'EMP0003','2026-06-05','PRESENT','18:28:08',NULL,'2026-06-05 12:58:08',538,0,0,1),(10,'EMP0008','2026-06-06','PRESENT','15:45:55','17:08:48','2026-06-06 10:15:55',376,0,0,1),(11,'EMP0006','2026-06-08','PRESENT','10:08:27',NULL,'2026-06-08 04:38:27',38,0,0,1),(12,'EMP0009','2026-06-08','PRESENT','10:08:54',NULL,'2026-06-08 04:38:54',39,0,0,1),(13,'EMP0008','2026-06-08','PRESENT','11:44:22',NULL,'2026-06-08 06:14:22',134,0,0,1),(14,'EMP0003','2026-06-09','PRESENT','12:27:06',NULL,'2026-06-09 06:57:06',177,0,0,1),(15,'EMP0006','2026-06-09','PRESENT','12:48:28',NULL,'2026-06-09 07:18:28',198,0,0,1),(16,'EMP0006','2026-06-10','PRESENT','10:06:00',NULL,'2026-06-10 04:36:00',0,0,0,0);
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_regularization`
--

DROP TABLE IF EXISTS `attendance_regularization`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_regularization` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `attendance_date` date NOT NULL,
  `original_check_in` time DEFAULT NULL,
  `original_check_out` time DEFAULT NULL,
  `requested_check_in` time NOT NULL,
  `requested_check_out` time NOT NULL,
  `reason` text NOT NULL,
  `status` enum('Pending','Approved','Rejected') DEFAULT 'Pending',
  `approved_by` varchar(100) DEFAULT NULL,
  `approval_comments` text,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_date` (`attendance_date`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_regularization`
--

LOCK TABLES `attendance_regularization` WRITE;
/*!40000 ALTER TABLE `attendance_regularization` DISABLE KEYS */;
INSERT INTO `attendance_regularization` VALUES (1,'EMP0003','2026-05-21','09:00:00','18:00:00','09:20:00','03:00:00','not feeling well ','Approved','HR Manager','ok ','2026-05-21 10:59:37','2026-05-21 10:58:58');
/*!40000 ALTER TABLE `attendance_regularization` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_selfies`
--

DROP TABLE IF EXISTS `attendance_selfies`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_selfies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL COMMENT 'Denormalised for fast HR queries',
  `wfh_attendance_id` int NOT NULL COMMENT 'FK ÔåÆ wfh_attendance.id',
  `capture_type` enum('checkin','checkout') NOT NULL DEFAULT 'checkin',
  `storage_key` char(36) NOT NULL COMMENT 'UUID v4 used as encrypted filename',
  `storage_backend` enum('local_encrypted') NOT NULL DEFAULT 'local_encrypted',
  `file_hash` char(64) NOT NULL COMMENT 'SHA-256 of plaintext JPEG after EXIF strip',
  `mime_type` varchar(30) NOT NULL DEFAULT 'image/jpeg',
  `file_size_bytes` int unsigned NOT NULL,
  `width_px` smallint unsigned NOT NULL,
  `height_px` smallint unsigned NOT NULL,
  `camera_device_label` varchar(200) DEFAULT NULL COMMENT 'Browser-reported device name ÔÇö anomaly signal',
  `capture_attempt_count` tinyint unsigned NOT NULL DEFAULT '1' COMMENT '1-3 attempts allowed',
  `captured_at` timestamp NOT NULL COMMENT 'Server-generated when upload accepted',
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `retention_expires_at` date NOT NULL COMMENT 'Deletion date = captured_at + retention_months',
  `status` enum('active','deletion_pending','deleted') NOT NULL DEFAULT 'active',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deletion_reason` enum('retention_expired','consent_withdrawn','hr_request','employee_request','system_error') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wfh_capture` (`wfh_attendance_id`,`capture_type`) COMMENT 'One selfie per capture type per session',
  UNIQUE KEY `uq_storage_key` (`storage_key`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_retention` (`retention_expires_at`,`status`) COMMENT 'Retention cleanup job uses this',
  KEY `idx_captured_at` (`captured_at`),
  CONSTRAINT `fk_selfie_wfh` FOREIGN KEY (`wfh_attendance_id`) REFERENCES `wfh_attendance` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Selfie image metadata ÔÇö bytes stored encrypted on disk, never in DB';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_selfies`
--

LOCK TABLES `attendance_selfies` WRITE;
/*!40000 ALTER TABLE `attendance_selfies` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_selfies` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bonuses`
--

DROP TABLE IF EXISTS `bonuses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bonuses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `bonus_type` varchar(50) NOT NULL,
  `reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bonuses`
--

LOCK TABLES `bonuses` WRITE;
/*!40000 ALTER TABLE `bonuses` DISABLE KEYS */;
/*!40000 ALTER TABLE `bonuses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `company_settings`
--

DROP TABLE IF EXISTS `company_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `company_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `company_settings`
--

LOCK TABLES `company_settings` WRITE;
/*!40000 ALTER TABLE `company_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `company_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `head_id` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `designations`
--

DROP TABLE IF EXISTS `designations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `designations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL,
  `department_id` int DEFAULT NULL,
  `level` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `designations_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `designations`
--

LOCK TABLES `designations` WRITE;
/*!40000 ALTER TABLE `designations` DISABLE KEYS */;
/*!40000 ALTER TABLE `designations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `document_requests`
--

DROP TABLE IF EXISTS `document_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `document_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `employee_name` varchar(100) DEFAULT NULL,
  `document_type` varchar(50) NOT NULL,
  `reason` text,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `file_url` varchar(500) DEFAULT NULL,
  `file_html` longtext,
  `rejected_reason` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `requested_month` varchar(7) DEFAULT NULL,
  `hr_approved_by` varchar(100) DEFAULT NULL,
  `hr_forwarded_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `document_requests`
--

LOCK TABLES `document_requests` WRITE;
/*!40000 ALTER TABLE `document_requests` DISABLE KEYS */;
INSERT INTO `document_requests` VALUES (1,'EMP0006','Dev','salary-slip','loan approvement','generated',NULL,NULL,NULL,'2026-05-27 10:40:42','2026-05-27 10:42:01',NULL,NULL,NULL),(2,'EMP0006','Dev','offer-letter','for personal reason','generated',NULL,NULL,NULL,'2026-05-27 10:56:31','2026-05-27 10:57:30',NULL,NULL,NULL),(3,'EMP0006','Dev','relieving-letter',NULL,'generated',NULL,NULL,NULL,'2026-05-27 11:15:09','2026-05-27 11:15:52',NULL,NULL,NULL),(4,'EMP0007','Prerna','appointment-letter','Generated by HR','generated','generated_docs/appointment_letter_EMP0007_20260603171223.pdf',NULL,NULL,'2026-06-03 11:42:23','2026-06-04 05:21:14',NULL,NULL,NULL),(5,'EMP0007','Prerna','appointment-letter','Generated by HR','approved','/api/documents/download/appointment_letter_EMP0007_20260603172058.pdf',NULL,NULL,'2026-06-03 11:50:58','2026-06-03 11:50:58',NULL,NULL,NULL),(6,'EMP0007','Prerna','appointment-letter','Generated by HR','generated','/api/documents/download/appointment_letter_EMP0007_20260603174132.pdf',NULL,NULL,'2026-06-03 12:12:28','2026-06-04 05:49:07',NULL,NULL,NULL),(7,'EMP0009','Shrusti','offer-letter','Generated by HR','generated','/api/documents/download/offer_letter_EMP0009_20260604105407.pdf',NULL,NULL,'2026-06-04 05:25:06','2026-06-04 05:25:06',NULL,NULL,NULL),(8,'EMP0008','jenishdesignmaster','offer-letter',NULL,'generated','/api/documents/download/offer_letter_EMP0008_20260604112705.pdf',NULL,NULL,'2026-06-04 05:54:40','2026-06-04 05:58:01',NULL,NULL,NULL),(9,'EMP0008','jenishdesignmaster','offer-letter','Generated by HR','generated','/api/documents/download/offer_letter_EMP0008_20260604112705.pdf',NULL,NULL,'2026-06-04 05:58:01','2026-06-04 05:58:01',NULL,NULL,NULL),(10,'EMP001','Test User','offer-letter','Generated by HR','generated','/api/documents/download/offer_letter_EMP001_20260604113110.pdf',NULL,NULL,'2026-06-04 06:02:06','2026-06-04 06:02:06',NULL,NULL,NULL),(11,'EMP0009','Project manager','experience-letter',NULL,'generated','/api/documents/download/experience_letter_EMP0009_20260604155337.pdf',NULL,NULL,'2026-06-04 10:21:10','2026-06-04 10:24:41',NULL,NULL,NULL),(12,'EMP0009','Project manager','experience-letter','Generated by HR','generated','/api/documents/download/experience_letter_EMP0009_20260604155337.pdf',NULL,NULL,'2026-06-04 10:24:41','2026-06-04 10:24:41',NULL,NULL,NULL),(13,'EMP0004','Jenish  Sir ','relieving-letter','Generated by HR','generated','/api/documents/download/relieving_letter_EMP0004_20260604161030.pdf',NULL,NULL,'2026-06-04 10:41:27','2026-06-04 10:41:27',NULL,NULL,NULL),(14,'EMP0004','Jenish  Sir ','relieving-letter','Generated by HR','generated','/api/documents/download/relieving_letter_EMP0004_20260604161342.pdf',NULL,NULL,'2026-06-04 10:44:38','2026-06-04 10:44:38',NULL,NULL,NULL),(15,'EMP0004','Jenish  Sir','relieving-letter','Generated by HR','generated','/api/documents/download/relieving_letter_EMP0004_20260604162344.pdf',NULL,NULL,'2026-06-04 10:54:43','2026-06-04 10:54:43',NULL,NULL,NULL),(16,'EMP0003','Bhumika Mukesh bhai Tirgar','offer-letter','Generated by HR','generated','/api/documents/download/offer_letter_EMP0003_20260604164411.pdf',NULL,NULL,'2026-06-04 11:15:07','2026-06-04 11:15:07',NULL,NULL,NULL),(17,'EMP0003','Bhumika Mukesh bhai Tirgar','offer-letter','Generated by HR','generated','/api/documents/download/offer_letter_EMP0003_20260605162345.pdf',NULL,NULL,'2026-06-05 10:54:44','2026-06-05 10:54:44',NULL,NULL,NULL),(18,'EMP0008','jenishdesignmaster','salary-slip',NULL,'generated',NULL,NULL,NULL,'2026-06-08 04:15:41','2026-06-08 04:17:53',NULL,NULL,NULL),(19,'EMP0009','Project manager','salary-slip',NULL,'hr_approved',NULL,NULL,NULL,'2026-06-08 04:39:17','2026-06-08 05:39:57','2026-06','HR','2026-06-08 10:09:46'),(20,'EMP0008','jenishdesignmaster','salary-slip',NULL,'generated','/api/documents/download/salary_slip_EMP0008_202606.pdf','<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<title>Salary Slip — June 2026 — jenishdesignmaster</title>\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:24px}\n.wrap{max-width:780px;margin:0 auto}\n.hdr{background:#0a1f44;color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}\n.co{font-size:16px;font-weight:700;letter-spacing:.03em}\n.doc-title{font-size:13px;opacity:.8;margin-top:2px}\n.period{font-size:18px;font-weight:700}\n.emp-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #c8d4e0;border-top:none}\n.emp-grid .cell{padding:7px 12px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0}\n.emp-grid .cell:nth-child(even){border-right:none}\n.k{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b}\n.v{font-size:12px;font-weight:600;color:#1e293b;margin-top:1px}\ntable.data{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}\ntable.data th{background:#0a1f44;color:#fff;padding:6px 10px;text-align:center;font-size:10px;font-weight:600;letter-spacing:.04em}\ntable.data th.left{text-align:left}\ntable.data td{padding:5px 10px;border-bottom:1px solid #e8ecf0}\ntable.data td.lb{font-weight:600}\ntable.data td.lbl{color:#475569}\ntable.data td.num{text-align:right}\ntable.data td.red{color:#dc2626}\ntable.data tr.subtot td{background:#f0f4f8;font-weight:700}\ntable.data tr.tot td{background:#dde6f0;font-weight:700;font-size:12px}\n.net-bar{background:#0a1f44;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:0;font-size:14px;font-weight:700}\n.net-amt{font-size:20px;font-weight:800}\n.sign-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:28px;text-align:center}\n.sign-box{border-top:1px solid #94a3b8;padding-top:6px;font-size:10px;color:#64748b}\n.foot{text-align:center;margin-top:18px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}\n.print-btn{position:fixed;top:14px;right:14px;background:#3b82f6;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;z-index:99}\n@media print{.print-btn{display:none}}\n</style>\n</head>\n<body>\n<button class=\"print-btn\" onclick=\"window.print()\">&#128424; Print / Save PDF</button>\n<div class=\"wrap\">\n\n  <!-- Header -->\n  <div class=\"hdr\">\n    <div>\n      <div class=\"co\">Seawind Solutions</div>\n      <div class=\"doc-title\">Pay Slip</div>\n    </div>\n    <div class=\"period\">June 2026</div>\n  </div>\n\n  <!-- Employee Info -->\n  <div class=\"emp-grid\">\n    <div class=\"cell\"><div class=\"k\">Employee Name</div><div class=\"v\">jenishdesignmaster</div></div>\n    <div class=\"cell\"><div class=\"k\">Employee ID</div><div class=\"v\">EMP0008</div></div>\n    <div class=\"cell\"><div class=\"k\">Designation</div><div class=\"v\">N/A</div></div>\n    <div class=\"cell\"><div class=\"k\">Department</div><div class=\"v\">Graphic Design</div></div>\n  </div>\n\n  <!-- Attendance Summary -->\n  <table class=\"data\" style=\"margin-top:12px\">\n    <tr>\n      <th class=\"left\" colspan=\"2\">Attendance</th>\n      <th>Total Days</th>\n      <th>Working Days</th>\n      <th>Absent Days</th>\n    </tr>\n    <tr>\n      <td class=\"lb\" colspan=\"2\">June 2026</td>\n      <td class=\"num\">30</td>\n      <td class=\"num\">2</td>\n      <td class=\"num\">28</td>\n    </tr>\n  </table>\n\n  <!-- Leave Summary -->\n  <table class=\"data\" style=\"margin-top:12px\">\n    <tr>\n      <th class=\"left\">Leave Type</th>\n      <th>Monthly Allowance</th>\n      <th>Used (This Month)</th>\n      <th>Balance</th>\n      <th>Unpaid Days</th>\n    </tr>\n    \n        <tr>\n          <td class=\"lb\">PL</td>\n          <td class=\"num\">0.5</td>\n          <td class=\"num\">0.0</td>\n          <td class=\"num\">0.50</td>\n          <td class=\"num\">0.0</td>\n        </tr>\n        <tr>\n          <td class=\"lb\">SL</td>\n          <td class=\"num\">0.5</td>\n          <td class=\"num\">0.0</td>\n          <td class=\"num\">0.50</td>\n          <td class=\"num\">0.0</td>\n        </tr>\n        <tr>\n          <td class=\"lb\">CL</td>\n          <td class=\"num\">0.5</td>\n          <td class=\"num\">5.0</td>\n          <td class=\"num\">0.00</td>\n          <td class=\"num\">4.5</td>\n        </tr>\n    <tr class=\"subtot\">\n      <td class=\"lb\">Total</td>\n      <td class=\"num\">1.5</td>\n      <td class=\"num\">5.0</td>\n      <td class=\"num\">1.00</td>\n      <td class=\"num\">—</td>\n    </tr>\n  </table>\n\n  <!-- Earnings & Deductions -->\n  <table class=\"data\" style=\"margin-top:12px\">\n    <tr>\n      <th class=\"left\" colspan=\"2\">Earnings</th>\n      <th class=\"left\" colspan=\"2\">Deductions</th>\n    </tr>\n    <tr>\n      <td class=\"lb lbl\">Gross Salary</td>\n      <td class=\"num\">&#8377;41,666.67</td>\n      <td class=\"lb lbl\">Professional Tax (PT)</td>\n      <td class=\"num red\">&#8377;200.00</td>\n    </tr>\n    \n        <tr>\n          <td class=\"lb lbl\">Unpaid Leave Deduction (4.50 days)</td>\n          <td class=\"num red\">&#8377;6,250.00</td>\n          <td class=\"lb lbl\">–</td>\n          <td class=\"num\">–</td>\n        </tr>\n    <tr class=\"tot\">\n      <td class=\"lb\">Total Earnings</td>\n      <td class=\"num\">&#8377;41,666.67</td>\n      <td class=\"lb\">Total Deductions</td>\n      <td class=\"num red\">&#8377;6,450.00</td>\n    </tr>\n  </table>\n\n  <!-- Net Salary -->\n  <div class=\"net-bar\">\n    <span>Net Salary — June 2026</span>\n    <span class=\"net-amt\">&#8377;35,216.67</span>\n  </div>\n\n  <!-- Signatures -->\n  <div class=\"sign-row\">\n    <div class=\"sign-box\">Employee Signature</div>\n    <div class=\"sign-box\">Accountant</div>\n    <div class=\"sign-box\">Authorized Signatory</div>\n  </div>\n\n  <div class=\"foot\">This is a computer-generated document. No signature required. | Seawind Solutions</div>\n</div>\n</body>\n</html>',NULL,'2026-06-08 05:27:01','2026-06-08 05:28:17','2026-06','HR','2026-06-08 10:57:42'),(21,'EMP0007','Prerna','salary-slip',NULL,'hr_approved',NULL,NULL,NULL,'2026-06-08 05:43:24','2026-06-08 05:51:34','2026-06','HR','2026-06-08 11:13:49'),(22,'EMP0007','Prerna','salary-slip',NULL,'generated','/api/documents/download/salary_slip_EMP0007_202606.pdf',NULL,NULL,'2026-06-08 05:54:09','2026-06-08 06:06:27','2026-06','HR','2026-06-08 11:24:34');
/*!40000 ALTER TABLE `document_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_activity_logs`
--

DROP TABLE IF EXISTS `employee_activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_activity_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `action` varchar(200) NOT NULL,
  `details` text,
  `ip_address` varchar(50) DEFAULT NULL,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_activity_logs`
--

LOCK TABLES `employee_activity_logs` WRITE;
/*!40000 ALTER TABLE `employee_activity_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `employee_activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_home_location_audit`
--

DROP TABLE IF EXISTS `employee_home_location_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_home_location_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address_label` varchar(500) DEFAULT NULL,
  `registered_via` enum('employee_gps','hr_manual','geocoded') NOT NULL,
  `changed_by` varchar(50) NOT NULL,
  `changed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp` (`employee_id`),
  KEY `idx_changed_at` (`changed_at`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_home_location_audit`
--

LOCK TABLES `employee_home_location_audit` WRITE;
/*!40000 ALTER TABLE `employee_home_location_audit` DISABLE KEYS */;
INSERT INTO `employee_home_location_audit` VALUES (1,'EMP0007',22.99887628,72.61799276,NULL,'employee_gps','EMP0007','2026-06-03 06:42:11'),(2,'EMP0007',22.99887628,72.61799276,'Bhaipura Road, Mehmdabad - Khokhra, Maninagar Taluka, Ahmedabad, Gujarat, 380026, India','employee_gps','EMP0007','2026-06-03 06:42:12'),(3,'EMP0007',23.02316500,72.50749400,NULL,'employee_gps','EMP0007','2026-06-03 06:43:28'),(4,'EMP0007',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0007','2026-06-03 06:43:30'),(5,'EMP0007',23.02316500,72.50749400,NULL,'employee_gps','EMP0007','2026-06-03 06:47:43'),(6,'EMP0007',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0007','2026-06-03 06:47:43'),(7,'EMP0007',23.02316500,72.50749400,NULL,'employee_gps','EMP0007','2026-06-03 07:37:56'),(8,'EMP0007',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0007','2026-06-03 07:37:57'),(9,'EMP0007',23.02316500,72.50749400,NULL,'employee_gps','EMP0007','2026-06-03 07:54:40'),(10,'EMP0007',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0007','2026-06-03 07:54:41'),(11,'EMP0008',23.02316500,72.50749400,NULL,'employee_gps','EMP0008','2026-06-03 07:59:16'),(12,'EMP0008',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0008','2026-06-03 07:59:18'),(13,'EMP0008',23.02316500,72.50749400,NULL,'employee_gps','EMP0008','2026-06-03 07:59:29'),(14,'EMP0008',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0008','2026-06-03 07:59:29'),(15,'EMP0008',23.02316500,72.50749400,NULL,'employee_gps','EMP0008','2026-06-03 07:59:38'),(16,'EMP0008',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0008','2026-06-03 07:59:38'),(17,'EMP0008',23.02316500,72.50749400,NULL,'employee_gps','EMP0008','2026-06-03 07:59:41'),(18,'EMP0008',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0008','2026-06-03 07:59:41'),(19,'EMP0009',23.02316500,72.50749400,NULL,'employee_gps','EMP0009','2026-06-03 08:58:25'),(20,'EMP0009',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0009','2026-06-03 08:58:26'),(22,'EMP0008',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-05 07:00:48'),(23,'EMP0007',23.02298152,72.50756085,'Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-05 07:03:01'),(24,'EMP0006',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-05 07:03:03'),(25,'EMP0003',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0003','2026-06-05 12:57:22');
/*!40000 ALTER TABLE `employee_home_location_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_home_locations`
--

DROP TABLE IF EXISTS `employee_home_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_home_locations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `address_label` varchar(500) DEFAULT NULL,
  `registered_via` enum('employee_gps','hr_manual','geocoded') NOT NULL DEFAULT 'hr_manual',
  `updated_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee` (`employee_id`),
  KEY `idx_employee` (`employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_home_locations`
--

LOCK TABLES `employee_home_locations` WRITE;
/*!40000 ALTER TABLE `employee_home_locations` DISABLE KEYS */;
INSERT INTO `employee_home_locations` VALUES (1,'EMP0007',23.02298152,72.50756085,'Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-02 12:28:19','2026-06-05 07:03:01'),(16,'EMP0008',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-03 07:59:16','2026-06-05 07:00:48'),(24,'EMP0009',23.02316500,72.50749400,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0009','2026-06-03 08:58:25','2026-06-03 08:58:26'),(28,'EMP0006',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','hr_manual','hr001','2026-06-05 06:40:05','2026-06-05 07:03:03'),(32,'EMP0003',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India','employee_gps','EMP0003','2026-06-05 12:57:22','2026-06-05 12:57:22');
/*!40000 ALTER TABLE `employee_home_locations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_profiles`
--

DROP TABLE IF EXISTS `employee_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_profiles` (
  `employee_id` varchar(50) NOT NULL,
  `profile_completed` tinyint(1) DEFAULT '0',
  `fathers_spouse_name` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('Male','Female','Other') DEFAULT NULL,
  `marital_status` enum('Single','Married','Divorced','Widowed') DEFAULT NULL,
  `nationality` varchar(100) DEFAULT NULL,
  `photograph_path` varchar(500) DEFAULT NULL,
  `current_address` text,
  `permanent_address` text,
  `alternate_mobile` varchar(20) DEFAULT NULL,
  `alternate_phone` varchar(20) DEFAULT NULL,
  `emergency_number` varchar(20) DEFAULT NULL,
  `aadhaar_number` varchar(20) DEFAULT NULL,
  `aadhaar_image_path` varchar(500) DEFAULT NULL,
  `pan_number` varchar(20) DEFAULT NULL,
  `pan_image_path` varchar(500) DEFAULT NULL,
  `uan_number` varchar(50) DEFAULT NULL,
  `highest_qualification` varchar(255) DEFAULT NULL,
  `degree_certificates_path` varchar(500) DEFAULT NULL,
  `university_name` varchar(255) DEFAULT NULL,
  `year_of_passing` int DEFAULT NULL,
  `is_fresher` tinyint(1) DEFAULT NULL,
  `experience_letters_path` varchar(500) DEFAULT NULL,
  `relieving_letter_path` varchar(500) DEFAULT NULL,
  `bank_name` varchar(255) DEFAULT NULL,
  `account_holder_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `branch_name` varchar(255) DEFAULT NULL,
  `signature_path` varchar(500) DEFAULT NULL,
  `appointment_letter_path` varchar(500) DEFAULT NULL,
  `nda_agreement_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_profiles`
--

LOCK TABLES `employee_profiles` WRITE;
/*!40000 ALTER TABLE `employee_profiles` DISABLE KEYS */;
INSERT INTO `employee_profiles` VALUES ('EMP0006',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'1234567890',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-26 12:48:44','2026-05-27 11:50:12'),('EMP0007',0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'generated_docs/appointment_letter_EMP0007_20260603174132.pdf',NULL,'2026-06-03 11:42:23','2026-06-03 12:12:28');
/*!40000 ALTER TABLE `employee_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_salaries`
--

DROP TABLE IF EXISTS `employee_salaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employee_salaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `ctc` decimal(12,2) NOT NULL,
  `basic_salary` decimal(12,2) DEFAULT NULL,
  `hra` decimal(12,2) DEFAULT NULL,
  `da` decimal(12,2) DEFAULT NULL,
  `transport_allowance` decimal(10,2) DEFAULT NULL,
  `medical_allowance` decimal(10,2) DEFAULT NULL,
  `special_allowance` decimal(12,2) DEFAULT NULL,
  `gross_salary` decimal(12,2) DEFAULT NULL,
  `pf_deduction` decimal(10,2) DEFAULT NULL,
  `esi_deduction` decimal(10,2) DEFAULT NULL,
  `professional_tax` decimal(10,2) DEFAULT NULL,
  `income_tax` decimal(10,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT NULL,
  `net_salary` decimal(12,2) DEFAULT NULL,
  `effective_from` date DEFAULT NULL,
  `status` enum('pending','approved','active','revised') DEFAULT 'pending',
  `approved_by` varchar(50) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_emp_effective` (`employee_id`,`effective_from`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_salaries`
--

LOCK TABLES `employee_salaries` WRITE;
/*!40000 ALTER TABLE `employee_salaries` DISABLE KEYS */;
INSERT INTO `employee_salaries` VALUES (1,'EMP001',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(2,'EMP0002',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(3,'EMP0003',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(4,'EMP0004',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(5,'EMP0005',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(6,'EMP0006',500000.00,16666.67,8333.33,0.00,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-01 10:32:27'),(7,'EMP0007',500000.00,16666.67,8333.33,NULL,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-02 05:02:44'),(9,'EMP0009',400000.00,13333.33,6666.66,0.00,1600.00,1250.00,10483.34,33333.33,1600.00,0.00,200.00,0.00,1800.00,31533.33,'2026-06-01','active',NULL,NULL,NULL,'2026-06-03 09:36:42'),(11,'EMP0008',500000.00,16666.67,8333.33,0.00,1600.00,1250.00,13816.67,41666.67,2000.00,0.00,200.00,0.00,2200.00,39466.67,'2026-06-01','active',NULL,NULL,NULL,'2026-06-06 07:53:50');
/*!40000 ALTER TABLE `employee_salaries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `employees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(50) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `designation_id` int DEFAULT NULL,
  `reporting_manager` varchar(100) DEFAULT NULL,
  `joining_date` date DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reporting_manager_id` int DEFAULT NULL,
  `employee_id` varchar(50) GENERATED ALWAYS AS (`employee_code`) VIRTUAL,
  `first_name` varchar(100) GENERATED ALWAYS AS (substring_index(`full_name`,_utf8mb4' ',1)) VIRTUAL,
  `last_name` varchar(100) GENERATED ALWAYS AS (if((locate(_utf8mb4' ',`full_name`) > 0),trim(substr(`full_name`,(locate(_utf8mb4' ',`full_name`) + 1))),_utf8mb4'')) VIRTUAL,
  `name` varchar(100) GENERATED ALWAYS AS (`full_name`) VIRTUAL,
  `date_of_joining` date GENERATED ALWAYS AS (`joining_date`) VIRTUAL,
  `department` varchar(100) DEFAULT NULL,
  `title` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_code` (`employee_code`),
  UNIQUE KEY `email` (`email`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `employees_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` (`id`, `employee_code`, `full_name`, `email`, `phone`, `department_id`, `designation_id`, `reporting_manager`, `joining_date`, `status`, `created_at`, `reporting_manager_id`, `department`, `title`, `city`, `state`) VALUES (1,'EMP001','Test User','test@hrms.com','9999999999',NULL,NULL,NULL,NULL,'active','2026-05-18 09:30:04',NULL,NULL,NULL,NULL,NULL),(2,'EMP0002','Jane Doe','jane.doe@test.com','',NULL,NULL,NULL,'2026-05-19','active','2026-05-19 04:50:05',NULL,'Engineering','Engineer',NULL,NULL),(3,'EMP0003','Bhumika Mukesh bhai Tirgar','aimlsws@gmail.com','+22314567890',NULL,NULL,NULL,'2026-05-19','active','2026-05-19 04:53:01',NULL,'IT','AI/ML Dev.',NULL,NULL),(4,'EMP0004','Jenish  Sir ','designermastrer@gmail.com','1234467890',NULL,NULL,NULL,'2026-05-21','active','2026-05-21 06:02:05',NULL,'Operations','Designer',NULL,NULL),(5,'EMP0005','Test Employee','testemployee01@example.com','9876543210',NULL,NULL,NULL,'2026-05-26','active','2026-05-26 06:56:47',NULL,'Engineering',NULL,NULL,NULL),(6,'EMP0006','Dev','dev@seawindsolution.com','1234567890',NULL,NULL,NULL,'2026-05-26','active','2026-05-26 07:00:53',NULL,'IT',NULL,'ahmedabad ','gujarat'),(7,'EMP0007','Prerna','mishraperna3@gmail.com','1234556789',NULL,NULL,NULL,'2026-06-01','active','2026-06-01 11:36:06',NULL,'Sales',NULL,NULL,NULL),(8,'EMP0008','jenishdesignmaster','deshmukhaarti568@gmail.com','',NULL,NULL,NULL,'2026-06-03','active','2026-06-03 07:57:19',NULL,'Design',NULL,NULL,NULL),(9,'EMP0009','Project manager','project@seawindsolution.com','1234556890',NULL,NULL,NULL,'2026-06-03','active','2026-06-03 08:56:10',NULL,'Operations',NULL,NULL,NULL),(10,'EMP0010','Lakshya  L','jainlakshya5050@gmail.com','1534289098',NULL,NULL,NULL,'2026-06-09','active','2026-06-09 10:38:08',NULL,'IT','Intern',NULL,NULL);
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `geo_attendance_attempts`
--

DROP TABLE IF EXISTS `geo_attendance_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `geo_attendance_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `attempted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `home_latitude` decimal(10,8) DEFAULT NULL,
  `home_longitude` decimal(11,8) DEFAULT NULL,
  `distance_meters` decimal(10,2) DEFAULT NULL,
  `radius_meters` int NOT NULL DEFAULT '300',
  `within_radius` tinyint(1) NOT NULL DEFAULT '0',
  `wfh_id` int DEFAULT NULL COMMENT 'wfh_attendance.id when successful',
  `client_ip` varchar(45) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_attempted_at` (`attempted_at`),
  KEY `idx_within_radius` (`within_radius`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `geo_attendance_attempts`
--

LOCK TABLES `geo_attendance_attempts` WRITE;
/*!40000 ALTER TABLE `geo_attendance_attempts` DISABLE KEYS */;
INSERT INTO `geo_attendance_attempts` VALUES (1,'EMP0007','2026-06-03 06:42:33',23.02316500,72.50749400,22.99887628,72.61799276,11627.25,300,0,NULL,'127.0.0.1'),(2,'EMP0007','2026-06-03 06:42:46',23.02316500,72.50749400,22.99887628,72.61799276,11627.25,300,0,NULL,'127.0.0.1'),(3,'EMP0007','2026-06-03 07:44:35',23.02316500,72.50749400,23.02316500,72.50749400,0.00,300,1,4,'127.0.0.1'),(4,'EMP0007','2026-06-03 07:49:26',28.61390000,77.20900000,23.02316500,72.50749400,779488.77,300,0,NULL,'127.0.0.1'),(5,'EMP0007','2026-06-03 07:52:16',28.61390000,77.20900000,23.02316500,72.50749400,779488.77,300,0,NULL,'127.0.0.1'),(6,'EMP0008','2026-06-03 08:46:17',23.02316500,72.50749400,23.02316500,72.50749400,0.00,300,1,6,'127.0.0.1'),(7,'EMP0009','2026-06-03 08:58:32',23.02316500,72.50749400,23.02316500,72.50749400,0.00,300,1,7,'127.0.0.1'),(8,'EMP0003','2026-06-05 12:58:08',23.02317000,72.50749200,23.02317000,72.50749200,0.00,500,1,8,'127.0.0.1'),(9,'EMP0008','2026-06-06 10:15:55',23.02317100,72.50749200,23.02317000,72.50749200,0.11,500,1,9,'127.0.0.1'),(10,'EMP0006','2026-06-08 04:38:27',23.02316800,72.50749000,23.02317000,72.50749200,0.30,500,1,10,'127.0.0.1'),(11,'EMP0009','2026-06-08 04:38:54',23.02316800,72.50749000,23.02316500,72.50749400,0.53,500,1,11,'127.0.0.1'),(12,'EMP0008','2026-06-08 06:14:22',23.02316800,72.50749000,23.02317000,72.50749200,0.30,500,1,12,'127.0.0.1'),(13,'EMP0003','2026-06-09 06:57:06',23.02316800,72.50749000,23.02317000,72.50749200,0.30,500,1,13,'127.0.0.1'),(14,'EMP0006','2026-06-09 07:18:28',23.02316800,72.50749000,23.02317000,72.50749200,0.30,500,1,14,'127.0.0.1'),(15,'EMP0006','2026-06-10 04:36:00',23.02316700,72.50748900,23.02317000,72.50749200,0.45,500,1,15,'127.0.0.1');
/*!40000 ALTER TABLE `geo_attendance_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `holidays`
--

DROP TABLE IF EXISTS `holidays`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `holidays`
--

LOCK TABLES `holidays` WRITE;
/*!40000 ALTER TABLE `holidays` DISABLE KEYS */;
/*!40000 ALTER TABLE `holidays` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `home_location_change_requests`
--

DROP TABLE IF EXISTS `home_location_change_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `home_location_change_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `requested_latitude` decimal(10,8) NOT NULL,
  `requested_longitude` decimal(11,8) NOT NULL,
  `requested_address_label` varchar(500) DEFAULT NULL,
  `request_reason` varchar(500) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `hr_comment` varchar(500) DEFAULT NULL,
  `reviewed_by` varchar(50) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp_status` (`employee_id`,`status`),
  KEY `idx_status` (`status`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `home_location_change_requests`
--

LOCK TABLES `home_location_change_requests` WRITE;
/*!40000 ALTER TABLE `home_location_change_requests` DISABLE KEYS */;
INSERT INTO `home_location_change_requests` VALUES (1,'EMP0006',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India',NULL,'approved',NULL,'hr001','2026-06-05 07:03:03','2026-06-05 06:59:17'),(2,'EMP0008',23.02317000,72.50749200,'Ramdevnagar road, Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India',NULL,'approved',NULL,'hr001','2026-06-05 07:00:49','2026-06-05 07:00:16'),(3,'EMP0007',23.02298152,72.50756085,'Ramdev nagar, Vejalpur Taluka, Ahmedabad, Gujarat, 380015, India',NULL,'approved',NULL,'hr001','2026-06-05 07:03:01','2026-06-05 07:02:24');
/*!40000 ALTER TABLE `home_location_change_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kpis`
--

DROP TABLE IF EXISTS `kpis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `cycle_id` int NOT NULL,
  `kpi_name` varchar(200) NOT NULL,
  `target` text,
  `weightage` decimal(5,2) DEFAULT '1.00',
  `achievement` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cycle_id` (`cycle_id`),
  KEY `idx_employee_cycle` (`employee_id`,`cycle_id`),
  CONSTRAINT `kpis_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kpis`
--

LOCK TABLES `kpis` WRITE;
/*!40000 ALTER TABLE `kpis` DISABLE KEYS */;
/*!40000 ALTER TABLE `kpis` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_balance`
--

DROP TABLE IF EXISTS `leave_balance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_balance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `casual_leave` decimal(5,2) DEFAULT '0.50',
  `sick_leave` decimal(5,2) DEFAULT '0.50',
  `earned_leave` decimal(5,2) DEFAULT '0.50',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employee_id` (`employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_balance`
--

LOCK TABLES `leave_balance` WRITE;
/*!40000 ALTER TABLE `leave_balance` DISABLE KEYS */;
INSERT INTO `leave_balance` VALUES (1,'EMP001',0.50,0.50,0.50,'2026-06-06 06:28:33'),(2,'hr001',0.50,0.50,0.50,'2026-06-06 06:28:33'),(3,'acc001',0.50,0.50,0.50,'2026-06-06 06:28:33'),(4,'EMP0003',0.50,0.50,0.50,'2026-06-06 06:28:33'),(5,'EMP0002',0.50,0.50,0.50,'2026-06-06 06:28:33'),(6,'1',0.50,0.50,0.50,'2026-06-06 06:28:33'),(13,'admin001',0.50,0.50,0.50,'2026-06-06 06:28:33'),(14,'EMP0004',0.50,0.50,0.50,'2026-06-06 06:28:33'),(16,'EMP0006',0.00,0.50,0.50,'2026-06-06 06:46:05'),(18,'EMP0007',0.50,0.00,0.50,'2026-06-06 07:44:00'),(19,'EMP0008',0.00,0.50,0.50,'2026-06-06 11:36:04'),(20,'EMP0009',0.50,0.50,0.50,'2026-06-06 06:28:33');
/*!40000 ALTER TABLE `leave_balance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leave_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `leave_type` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days_count` int NOT NULL DEFAULT '1',
  `reason` text,
  `status` varchar(20) DEFAULT 'PENDING',
  `approved_by` varchar(50) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approval_comments` text,
  `approval_date` timestamp NULL DEFAULT NULL,
  `is_unpaid` tinyint(1) DEFAULT '0',
  `unpaid_days` decimal(5,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
INSERT INTO `leave_requests` VALUES (7,'hr001','Sick Leave','2026-05-21','2026-05-23',3,'SICK','Approved','HR Manager','2026-05-19 07:57:31','2026-05-19 07:55:54','2026-05-19 07:55:54','Get well soon ','2026-05-19 07:57:31',0,0.00),(8,'hr001','Casual Leave','2026-06-12','2026-06-14',3,'Family Function ','Approved','HR','2026-06-05 07:41:21','2026-05-21 06:23:31','2026-05-21 06:23:31','Rejected by HR Manager','2026-06-05 07:41:21',0,0.00),(9,'EMP0006','Sick Leave','2026-05-28','2026-05-30',3,'appointment for wisdom tooth extraction and have to take bed rest for 3 days ','Approved','HR Manager','2026-05-26 10:34:57','2026-05-26 10:24:15','2026-05-26 10:24:15','get well soon','2026-05-26 10:34:57',0,0.00),(10,'EMP0006','Casual Leave','2026-06-07','2026-06-09',3,'Brother\'s Wedding ','Approved','HR Manager','2026-06-06 06:46:54','2026-06-06 06:46:05','2026-06-06 06:46:05','Approved by HR Manager','2026-06-06 06:46:54',0,0.00),(11,'EMP0007','Sick Leave','2026-06-07','2026-06-09',3,'Wisdom Tooth extraction operation ','Pending',NULL,NULL,'2026-06-06 07:44:00','2026-06-06 07:44:00',NULL,NULL,0,0.00),(12,'EMP0009','Casual Leave','2026-06-07','2026-06-10',4,'Sister\'s Marriage','Approved','HR Manager','2026-06-06 07:53:36','2026-06-06 07:52:24','2026-06-06 07:52:24','Approved by HR Manager','2026-06-06 07:53:36',1,4.00),(13,'EMP0008','Casual Leave','2026-06-07','2026-06-11',5,'vacation to goa','Approved','HR Manager','2026-06-06 11:36:04','2026-06-06 11:35:20','2026-06-06 11:35:20','Enjoy ','2026-06-06 11:36:04',1,4.50);
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `leave_requests_days_count_bi` BEFORE INSERT ON `leave_requests` FOR EACH ROW BEGIN
                IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
                    SET NEW.days_count = TIMESTAMPDIFF(DAY, NEW.start_date, NEW.end_date) + 1;
                END IF;
            END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `leave_requests_days_count_bu` BEFORE UPDATE ON `leave_requests` FOR EACH ROW BEGIN
                IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
                    SET NEW.days_count = TIMESTAMPDIFF(DAY, NEW.start_date, NEW.end_date) + 1;
                END IF;
            END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `login_history`
--

DROP TABLE IF EXISTS `login_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `login_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `logout_time` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `device_info` text,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`)
) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_history`
--

LOCK TABLES `login_history` WRITE;
/*!40000 ALTER TABLE `login_history` DISABLE KEYS */;
INSERT INTO `login_history` VALUES (1,'admin001','2026-05-18 12:46:14',NULL,'127.0.0.1',NULL),(2,'admin001','2026-05-18 12:46:14',NULL,'127.0.0.1',NULL),(3,'hr001','2026-05-19 04:13:14',NULL,'127.0.0.1',NULL),(4,'hr001','2026-05-19 04:16:20',NULL,'127.0.0.1',NULL),(5,'admin001','2026-05-19 08:39:28',NULL,'127.0.0.1',NULL),(6,'hr001','2026-05-19 10:22:18',NULL,'127.0.0.1',NULL),(7,'hr001','2026-05-20 04:41:55',NULL,'127.0.0.1',NULL),(8,'hr001','2026-05-20 05:25:02',NULL,'127.0.0.1',NULL),(9,'hr001','2026-05-21 04:02:56',NULL,'127.0.0.1',NULL),(10,'hr001','2026-05-21 05:40:58',NULL,'127.0.0.1',NULL),(11,'hr001','2026-05-21 05:43:06',NULL,'127.0.0.1',NULL),(12,'hr001','2026-05-21 07:35:56',NULL,'127.0.0.1',NULL),(13,'hr001','2026-05-21 12:07:22',NULL,'127.0.0.1',NULL),(14,'EMP0006','2026-05-26 07:01:28',NULL,'127.0.0.1',NULL),(15,'hr001','2026-05-26 07:03:50',NULL,'127.0.0.1',NULL),(16,'EMP0006','2026-05-26 07:25:35',NULL,'127.0.0.1',NULL),(17,'EMP0006','2026-05-26 07:55:33',NULL,'127.0.0.1',NULL),(18,'EMP0006','2026-05-26 09:49:39',NULL,'127.0.0.1',NULL),(19,'hr ','2026-05-26 10:25:26',NULL,'127.0.0.1',NULL),(20,'hr ','2026-05-26 10:25:32',NULL,'127.0.0.1',NULL),(21,'hr ','2026-05-26 10:25:33',NULL,'127.0.0.1',NULL),(22,'hr ','2026-05-26 10:25:36',NULL,'127.0.0.1',NULL),(23,'hr ','2026-05-26 10:31:03',NULL,'127.0.0.1',NULL),(24,'hr001','2026-05-26 10:34:02',NULL,'127.0.0.1',NULL),(25,'EMP0006','2026-05-26 10:35:28',NULL,'127.0.0.1',NULL),(26,'EMP0006','2026-05-27 10:14:39',NULL,'127.0.0.1',NULL),(27,'EMP0006','2026-05-27 10:17:46',NULL,'127.0.0.1',NULL),(28,'EMP0006','2026-05-27 10:19:20',NULL,'127.0.0.1',NULL),(29,'hr001','2026-05-27 10:41:19',NULL,'127.0.0.1',NULL),(30,'hr001','2026-05-27 10:44:39',NULL,'127.0.0.1',NULL),(31,'EMP0006','2026-05-27 10:45:26',NULL,'127.0.0.1',NULL),(32,'hr001','2026-05-27 10:56:51',NULL,'127.0.0.1',NULL),(33,'EMP0006','2026-05-27 10:57:47',NULL,'127.0.0.1',NULL),(34,'hr001','2026-05-27 11:15:26',NULL,'127.0.0.1',NULL),(35,'EMP0006','2026-05-27 11:16:09',NULL,'127.0.0.1',NULL),(36,'hr001','2026-05-27 11:51:21',NULL,'127.0.0.1',NULL),(37,'EMP0006','2026-06-01 10:55:30',NULL,'127.0.0.1',NULL),(38,'hr001','2026-06-01 11:30:20',NULL,'127.0.0.1',NULL),(39,'EMP0007','2026-06-01 11:47:02',NULL,'127.0.0.1',NULL),(40,'hr001','2026-06-01 11:47:59',NULL,'127.0.0.1',NULL),(41,'hr001','2026-06-02 05:03:08',NULL,'127.0.0.1',NULL),(42,'hr001','2026-06-02 05:03:34',NULL,'127.0.0.1',NULL),(43,'EMP0006','2026-06-02 05:42:42',NULL,'127.0.0.1',NULL),(44,'hr001','2026-06-02 06:05:53',NULL,'127.0.0.1',NULL),(45,'EMP0006','2026-06-02 09:03:34',NULL,'127.0.0.1',NULL),(46,'EMP0006','2026-06-02 09:03:52',NULL,'127.0.0.1',NULL),(47,'EMP0006','2026-06-02 09:10:20',NULL,'127.0.0.1',NULL),(48,'hr001','2026-06-02 11:30:29',NULL,'127.0.0.1',NULL),(49,'EMP0006','2026-06-02 11:57:24',NULL,'127.0.0.1',NULL),(50,'EMP0007','2026-06-02 11:57:55',NULL,'127.0.0.1',NULL),(51,'hr001','2026-06-02 12:28:54',NULL,'127.0.0.1',NULL),(52,'EMP0007','2026-06-02 12:29:54',NULL,'127.0.0.1',NULL),(53,'jenishdesignmaster','2026-06-03 07:57:44',NULL,'127.0.0.1',NULL),(54,'designmaster','2026-06-03 07:57:53',NULL,'127.0.0.1',NULL),(55,'EMP0008','2026-06-03 07:59:04',NULL,'127.0.0.1',NULL),(56,'hr001','2026-06-03 08:48:38',NULL,'127.0.0.1',NULL),(57,'EMP0009','2026-06-03 08:56:30',NULL,'127.0.0.1',NULL),(58,'hr001','2026-06-03 09:35:15',NULL,'127.0.0.1',NULL),(59,'EMP0008','2026-06-03 09:57:33',NULL,'127.0.0.1',NULL),(60,'EMP0009','2026-06-03 10:20:42',NULL,'127.0.0.1',NULL),(61,'hr001','2026-06-03 10:53:13',NULL,'127.0.0.1',NULL),(62,'EMP0008','2026-06-04 05:52:03',NULL,'127.0.0.1',NULL),(63,'hr001','2026-06-04 05:54:55',NULL,'127.0.0.1',NULL),(64,'EMP0008','2026-06-04 05:58:14',NULL,'127.0.0.1',NULL),(65,'hr001','2026-06-04 05:59:42',NULL,'127.0.0.1',NULL),(66,'EMP0006','2026-06-04 09:18:18',NULL,'127.0.0.1',NULL),(67,'hr001','2026-06-04 09:21:03',NULL,'127.0.0.1',NULL),(68,'EMP0009','2026-06-04 10:20:58',NULL,'127.0.0.1',NULL),(69,'EMP0009','2026-06-04 10:21:23',NULL,'127.0.0.1',NULL),(70,'hr001','2026-06-04 10:21:39',NULL,'127.0.0.1',NULL),(71,'EMP0006','2026-06-04 12:23:13',NULL,'127.0.0.1',NULL),(72,'EMP0009','2026-06-05 06:59:46',NULL,'127.0.0.1',NULL),(73,'EMP0008','2026-06-05 07:00:07',NULL,'127.0.0.1',NULL),(74,'hr001','2026-06-05 07:00:34',NULL,'127.0.0.1',NULL),(75,'EMP0007','2026-06-05 07:01:25',NULL,'127.0.0.1',NULL),(76,'hr001','2026-06-05 07:02:48',NULL,'127.0.0.1',NULL),(77,'EMP0006','2026-06-05 10:10:15',NULL,'127.0.0.1',NULL),(78,'hr001','2026-06-05 10:19:41',NULL,'127.0.0.1',NULL),(79,'EMP0003','2026-06-05 11:11:15',NULL,'127.0.0.1',NULL),(80,'hr001','2026-06-05 12:59:13',NULL,'127.0.0.1',NULL),(81,'EMP0006','2026-06-06 06:00:50',NULL,'127.0.0.1',NULL),(82,'hr001','2026-06-06 06:46:35',NULL,'127.0.0.1',NULL),(83,'EMP0006','2026-06-06 06:47:22',NULL,'127.0.0.1',NULL),(84,'EMP0007','2026-06-06 07:42:12',NULL,'127.0.0.1',NULL),(85,'EMP0007','2026-06-06 07:44:15',NULL,'127.0.0.1',NULL),(86,'EMP0009','2026-06-06 07:49:33',NULL,'127.0.0.1',NULL),(87,'hr001','2026-06-06 07:50:06',NULL,'127.0.0.1',NULL),(88,'EMP0009','2026-06-06 07:50:42',NULL,'127.0.0.1',NULL),(89,'hr001','2026-06-06 07:53:13',NULL,'127.0.0.1',NULL),(90,'EMP0009','2026-06-06 09:50:52',NULL,'127.0.0.1',NULL),(91,'EMP0008','2026-06-06 10:15:37',NULL,'127.0.0.1',NULL),(92,'hr001','2026-06-06 11:35:35',NULL,'127.0.0.1',NULL),(93,'EMP0008','2026-06-06 11:36:17',NULL,'127.0.0.1',NULL),(94,'EMP0008','2026-06-06 11:38:35',NULL,'127.0.0.1',NULL),(95,'hr001','2026-06-08 04:16:22',NULL,'127.0.0.1',NULL),(96,'EMP0006','2026-06-08 04:38:12',NULL,'127.0.0.1',NULL),(97,'EMP0009','2026-06-08 04:38:45',NULL,'127.0.0.1',NULL),(98,'hr001','2026-06-08 04:39:29',NULL,'127.0.0.1',NULL),(99,'EMP0008','2026-06-08 05:26:44',NULL,'127.0.0.1',NULL),(100,'hr001','2026-06-08 05:27:34',NULL,'127.0.0.1',NULL),(101,'EMP0007','2026-06-08 05:43:18',NULL,'127.0.0.1',NULL),(102,'hr001','2026-06-08 05:43:40',NULL,'127.0.0.1',NULL),(103,'EMP0007','2026-06-08 05:54:01',NULL,'127.0.0.1',NULL),(104,'hr001','2026-06-08 05:54:29',NULL,'127.0.0.1',NULL),(105,'EMP0008','2026-06-08 06:13:11',NULL,'127.0.0.1',NULL),(106,'EMP0003','2026-06-09 06:49:30',NULL,'127.0.0.1',NULL),(107,'EMP0008','2026-06-09 06:52:42',NULL,'127.0.0.1',NULL),(108,'EMP0003','2026-06-09 06:53:20',NULL,'127.0.0.1',NULL),(109,'EMP0006','2026-06-09 07:17:26',NULL,'127.0.0.1',NULL),(110,'hr001','2026-06-09 09:38:26',NULL,'127.0.0.1',NULL),(111,'EMP0008','2026-06-09 09:43:55',NULL,'127.0.0.1',NULL),(112,'acc001','2026-06-09 10:35:42',NULL,'127.0.0.1',NULL),(113,'hr001','2026-06-09 10:35:59',NULL,'127.0.0.1',NULL),(114,'hr001','2026-06-10 04:35:24',NULL,'127.0.0.1',NULL),(115,'EMP0006','2026-06-10 04:35:43',NULL,'127.0.0.1',NULL);
/*!40000 ALTER TABLE `login_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manager_reviews`
--

DROP TABLE IF EXISTS `manager_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manager_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `cycle_id` int NOT NULL,
  `manager_id` varchar(50) NOT NULL,
  `feedback` text,
  `rating` decimal(3,1) DEFAULT NULL,
  `promotion_recommended` tinyint(1) DEFAULT '0',
  `appraisal_recommended` tinyint(1) DEFAULT '0',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cycle_id` (`cycle_id`),
  KEY `idx_employee_cycle` (`employee_id`,`cycle_id`),
  CONSTRAINT `manager_reviews_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manager_reviews`
--

LOCK TABLES `manager_reviews` WRITE;
/*!40000 ALTER TABLE `manager_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `manager_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `monthly_payroll`
--

DROP TABLE IF EXISTS `monthly_payroll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `monthly_payroll` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `month_year` varchar(7) NOT NULL,
  `basic_salary` decimal(12,2) DEFAULT NULL,
  `hra` decimal(12,2) DEFAULT NULL,
  `allowances` decimal(12,2) DEFAULT NULL,
  `gross_salary` decimal(12,2) DEFAULT NULL,
  `deductions` decimal(12,2) DEFAULT NULL,
  `net_salary` decimal(12,2) DEFAULT NULL,
  `days_worked` int DEFAULT '30',
  `days_absent` int DEFAULT '0',
  `status` enum('draft','processed','paid') DEFAULT 'draft',
  `processed_by` varchar(50) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_emp_month` (`employee_id`,`month_year`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `monthly_payroll`
--

LOCK TABLES `monthly_payroll` WRITE;
/*!40000 ALTER TABLE `monthly_payroll` DISABLE KEYS */;
INSERT INTO `monthly_payroll` VALUES (1,'EMP001','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(2,'EMP0002','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(3,'EMP0003','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(4,'EMP0004','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(5,'EMP0005','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(6,'EMP0006','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-01 10:32:27'),(8,'EMP0007','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-02 05:02:44'),(9,'EMP0008','2026-06',16666.67,8333.33,16666.67,41666.67,2200.00,39466.67,30,0,'draft',NULL,NULL,NULL,'2026-06-06 07:53:50'),(10,'EMP0009','2026-06',13333.33,6666.66,13333.34,33333.33,6244.44,27088.89,30,4,'draft',NULL,NULL,NULL,'2026-06-06 07:53:50');
/*!40000 ALTER TABLE `monthly_payroll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `type` varchar(50) DEFAULT 'general',
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`user_id`,`is_read`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,'acc001','📢 Test Announcement','This is a test announcement for all employees.','announcement',1,'2026-05-19 05:26:41'),(2,'admin001','📢 Test Announcement','This is a test announcement for all employees.','announcement',0,'2026-05-19 05:26:41'),(3,'EMP0002','📢 Test Announcement','This is a test announcement for all employees.','announcement',0,'2026-05-19 05:26:41'),(4,'EMP0003','📢 Test Announcement','This is a test announcement for all employees.','announcement',0,'2026-05-19 05:26:41'),(5,'hr001','📢 Test Announcement','This is a test announcement for all employees.','announcement',1,'2026-05-19 05:26:41'),(6,'acc001','Company Meeting','All hands meeting on Friday 3pm.','announcement',0,'2026-05-19 05:28:01'),(7,'admin001','Company Meeting','All hands meeting on Friday 3pm.','announcement',0,'2026-05-19 05:28:01'),(8,'EMP0002','Company Meeting','All hands meeting on Friday 3pm.','announcement',0,'2026-05-19 05:28:01'),(9,'EMP0003','Company Meeting','All hands meeting on Friday 3pm.','announcement',0,'2026-05-19 05:28:01'),(10,'hr001','Company Meeting','All hands meeting on Friday 3pm.','announcement',1,'2026-05-19 05:28:01'),(11,'acc001','test announcement','this is test announcement','announcement',0,'2026-05-19 05:29:09'),(12,'admin001','test announcement','this is test announcement','announcement',0,'2026-05-19 05:29:09'),(13,'EMP0002','test announcement','this is test announcement','announcement',0,'2026-05-19 05:29:09'),(14,'EMP0003','test announcement','this is test announcement','announcement',0,'2026-05-19 05:29:09'),(15,'hr001','test announcement','this is test announcement','announcement',1,'2026-05-19 05:29:09'),(24,'admin001','New leave request','hr001 submitted 3 day(s) of Sick Leave. Request #7 is pending review.','leave_request',0,'2026-05-19 07:55:54'),(25,'hr001','New leave request','hr001 submitted 3 day(s) of Sick Leave. Request #7 is pending review.','leave_request',0,'2026-05-19 07:55:54'),(26,'admin001','New leave request','hr001 submitted 3 day(s) of Casual Leave. Request #8 is pending review.','leave_request',0,'2026-05-21 06:23:31'),(27,'hr001','New leave request','hr001 submitted 3 day(s) of Casual Leave. Request #8 is pending review.','leave_request',0,'2026-05-21 06:23:31'),(28,'admin001','New leave request','EMP0006 submitted 3 day(s) of Sick Leave. Request #9 is pending review.','leave_request',0,'2026-05-26 10:24:15'),(29,'hr001','New leave request','EMP0006 submitted 3 day(s) of Sick Leave. Request #9 is pending review.','leave_request',0,'2026-05-26 10:24:15'),(30,'acc001','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(31,'admin001','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(32,'EMP0002','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(33,'EMP0003','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(34,'EMP0004','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(35,'EMP0005','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(36,'EMP0006','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(37,'EMP0007','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(38,'EMP0008','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(39,'EMP0009','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(40,'hr001','New Company Policy','If any Person Take leave Just Before and After Holidays like Sat Sunday Than Sandwich Policy will be applying On them','announcement',0,'2026-06-03 09:54:04'),(41,'admin001','New leave request','EMP0006 submitted 3 day(s) of Casual Leave. Request #10 is pending review.','leave_request',0,'2026-06-06 06:46:05'),(42,'hr001','New leave request','EMP0006 submitted 3 day(s) of Casual Leave. Request #10 is pending review.','leave_request',0,'2026-06-06 06:46:05'),(43,'admin001','New leave request','EMP0007 submitted 3 day(s) of Sick Leave. Request #11 is pending review.','leave_request',0,'2026-06-06 07:44:00'),(44,'hr001','New leave request','EMP0007 submitted 3 day(s) of Sick Leave. Request #11 is pending review.','leave_request',0,'2026-06-06 07:44:00'),(45,'admin001','New leave request','EMP0009 submitted 4 day(s) of Casual Leave. Request #12 is pending review.','leave_request',0,'2026-06-06 07:52:24'),(46,'hr001','New leave request','EMP0009 submitted 4 day(s) of Casual Leave. Request #12 is pending review.','leave_request',0,'2026-06-06 07:52:24'),(47,'admin001','New leave request','EMP0008 submitted 5 day(s) of Casual Leave. Request #13 is pending review.','leave_request',0,'2026-06-06 11:35:20'),(48,'hr001','New leave request','EMP0008 submitted 5 day(s) of Casual Leave. Request #13 is pending review.','leave_request',0,'2026-06-06 11:35:20');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `performance_cycles`
--

DROP TABLE IF EXISTS `performance_cycles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `performance_cycles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `description` text,
  `status` varchar(20) DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `performance_cycles`
--

LOCK TABLES `performance_cycles` WRITE;
/*!40000 ALTER TABLE `performance_cycles` DISABLE KEYS */;
/*!40000 ALTER TABLE `performance_cycles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reimbursements`
--

DROP TABLE IF EXISTS `reimbursements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reimbursements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `description` text,
  `receipt_path` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected','paid') DEFAULT 'pending',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` varchar(50) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `comments` text,
  `expense_date` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reimbursements`
--

LOCK TABLES `reimbursements` WRITE;
/*!40000 ALTER TABLE `reimbursements` DISABLE KEYS */;
INSERT INTO `reimbursements` VALUES (1,'EMP0002','General',1500.00,'Team lunch',NULL,'approved','2026-06-01 10:50:10',NULL,'2026-06-01 10:54:45',NULL,'2026-05-28'),(2,'EMP0006','General',300.00,'Bought Room Freshner for Office',NULL,'approved','2026-06-01 10:57:30',NULL,'2026-06-01 10:58:23',NULL,'2026-06-01'),(3,'EMP0003','Travel',800.00,'Cab to client site',NULL,'approved','2026-06-01 11:05:26',NULL,'2026-06-01 11:05:26',NULL,'2026-06-01'),(4,'EMP0004','Meals',450.00,'Working lunch',NULL,'approved','2026-06-01 11:05:26',NULL,'2026-06-01 11:05:26',NULL,'2026-05-30'),(5,'EMP0005','Office',650.00,'Stationery for team',NULL,'approved','2026-06-01 11:05:26',NULL,'2026-06-01 11:05:26',NULL,'2026-05-29');
/*!40000 ALTER TABLE `reimbursements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `salary_structure`
--

DROP TABLE IF EXISTS `salary_structure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salary_structure` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `basic` decimal(10,2) NOT NULL,
  `hra` decimal(10,2) DEFAULT '0.00',
  `allowances` decimal(10,2) DEFAULT '0.00',
  `pf` decimal(10,2) DEFAULT '0.00',
  `esic` decimal(10,2) DEFAULT '0.00',
  `tds` decimal(10,2) DEFAULT '0.00',
  `gross_salary` decimal(10,2) NOT NULL,
  `net_salary` decimal(10,2) NOT NULL,
  `effective_from` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `salary_structure`
--

LOCK TABLES `salary_structure` WRITE;
/*!40000 ALTER TABLE `salary_structure` DISABLE KEYS */;
/*!40000 ALTER TABLE `salary_structure` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `salary_templates`
--

DROP TABLE IF EXISTS `salary_templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `salary_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) NOT NULL,
  `ctc_min` decimal(12,2) DEFAULT NULL,
  `ctc_max` decimal(12,2) DEFAULT NULL,
  `basic_percentage` decimal(5,2) DEFAULT '40.00',
  `hra_percentage` decimal(5,2) DEFAULT '20.00',
  `da_percentage` decimal(5,2) DEFAULT '10.00',
  `transport_allowance` decimal(10,2) DEFAULT '2000.00',
  `medical_allowance` decimal(10,2) DEFAULT '1500.00',
  `special_allowance_percentage` decimal(5,2) DEFAULT '10.00',
  `pf_percentage` decimal(5,2) DEFAULT '12.00',
  `esi_percentage` decimal(5,2) DEFAULT '0.75',
  `professional_tax` decimal(10,2) DEFAULT '200.00',
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `salary_templates`
--

LOCK TABLES `salary_templates` WRITE;
/*!40000 ALTER TABLE `salary_templates` DISABLE KEYS */;
INSERT INTO `salary_templates` VALUES (1,'Standard Template',300000.00,10000000.00,40.00,20.00,10.00,2000.00,1500.00,10.00,12.00,0.75,200.00,'system','2026-05-18 09:24:57',1);
/*!40000 ALTER TABLE `salary_templates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `self_reviews`
--

DROP TABLE IF EXISTS `self_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `self_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `cycle_id` int NOT NULL,
  `achievements` text,
  `challenges` text,
  `goals` text,
  `rating` decimal(3,1) DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `cycle_id` (`cycle_id`),
  KEY `idx_employee_cycle` (`employee_id`,`cycle_id`),
  CONSTRAINT `self_reviews_ibfk_1` FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `self_reviews`
--

LOCK TABLES `self_reviews` WRITE;
/*!40000 ALTER TABLE `self_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `self_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `selfie_access_log`
--

DROP TABLE IF EXISTS `selfie_access_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `selfie_access_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `selfie_id` int NOT NULL COMMENT 'FK ÔåÆ attendance_selfies.id',
  `wfh_attendance_id` int NOT NULL COMMENT 'Denormalised ÔÇö avoids join in HR queries',
  `employee_id` varchar(50) NOT NULL COMMENT 'Whose selfie was accessed',
  `accessed_by_user_id` int NOT NULL COMMENT 'FK ÔåÆ users.user_id (HR reviewer)',
  `accessed_by_name` varchar(100) NOT NULL COMMENT 'Snapshot of reviewer name at access time',
  `accessed_by_role` varchar(20) NOT NULL COMMENT 'Role at time of access',
  `access_type` enum('view','approve','reject','retention_delete','manual_delete') NOT NULL,
  `hr_comment` text COMMENT 'Required for approve/reject actions',
  `wfh_status_before` varchar(20) DEFAULT NULL COMMENT 'Snapshot of wfh_attendance.status before action',
  `wfh_status_after` varchar(20) DEFAULT NULL COMMENT 'Snapshot of wfh_attendance.status after action',
  `ip_address` varchar(45) NOT NULL,
  `user_agent` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_selfie` (`selfie_id`),
  KEY `idx_wfh` (`wfh_attendance_id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_accessed_by` (`accessed_by_user_id`),
  KEY `idx_access_type` (`access_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_log_selfie` FOREIGN KEY (`selfie_id`) REFERENCES `attendance_selfies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Append-only audit log ÔÇö every HR access to a selfie image';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `selfie_access_log`
--

LOCK TABLES `selfie_access_log` WRITE;
/*!40000 ALTER TABLE `selfie_access_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `selfie_access_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tax_slabs`
--

DROP TABLE IF EXISTS `tax_slabs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tax_slabs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `financial_year` varchar(10) DEFAULT NULL,
  `min_income` decimal(12,2) DEFAULT NULL,
  `max_income` decimal(12,2) DEFAULT NULL,
  `tax_rate` decimal(5,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tax_slabs`
--

LOCK TABLES `tax_slabs` WRITE;
/*!40000 ALTER TABLE `tax_slabs` DISABLE KEYS */;
INSERT INTO `tax_slabs` VALUES (1,'2024-25',0.00,250000.00,0.00,'2026-05-18 09:24:57'),(2,'2024-25',250001.00,500000.00,5.00,'2026-05-18 09:24:57'),(3,'2024-25',500001.00,750000.00,10.00,'2026-05-18 09:24:57'),(4,'2024-25',750001.00,1000000.00,15.00,'2026-05-18 09:24:57'),(5,'2024-25',1000001.00,1250000.00,20.00,'2026-05-18 09:24:57'),(6,'2024-25',1250001.00,1500000.00,25.00,'2026-05-18 09:24:57'),(7,'2024-25',1500001.00,999999999.00,30.00,'2026-05-18 09:24:57');
/*!40000 ALTER TABLE `tax_slabs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `team_members`
--

DROP TABLE IF EXISTS `team_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `team_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `team_id` int NOT NULL,
  `employee_id` varchar(50) NOT NULL,
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_team_member` (`team_id`,`employee_id`),
  CONSTRAINT `team_members_ibfk_1` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `team_members`
--

LOCK TABLES `team_members` WRITE;
/*!40000 ALTER TABLE `team_members` DISABLE KEYS */;
INSERT INTO `team_members` VALUES (5,5,'EMP0003','2026-05-26 07:18:30');
/*!40000 ALTER TABLE `team_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `team_name` varchar(100) NOT NULL,
  `manager_id` varchar(50) DEFAULT NULL,
  `description` text,
  `created_by` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teams`
--

LOCK TABLES `teams` WRITE;
/*!40000 ALTER TABLE `teams` DISABLE KEYS */;
INSERT INTO `teams` VALUES (5,'IT Team','EMP0006','Team for Automation','HR Manager','2026-05-26 07:18:19');
/*!40000 ALTER TABLE `teams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_token` (`session_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` varchar(50) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `role` varchar(50) DEFAULT 'employee',
  `profile_completed` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES ('acc001','accountant','acc123','accounts@seawindsolution.com','Accountant','accountant',1,1,'2026-05-18 12:25:16'),('admin001','admin','admin123','admin@seawindsolution.com','Administrator','admin',1,1,'2026-05-18 12:25:16'),('EMP0002','jane.doe','pass123','jane.doe@test.com','Jane Doe','employee',0,1,'2026-05-19 04:50:05'),('EMP0003','aimlsws','Bhumika1124','aimlsws@gmail.com','Bhumika Mukesh bhai Tirgar','employee',0,1,'2026-05-19 04:53:01'),('EMP0004','designermastrer','Jenish123456','designermastrer@gmail.com','Jenish  Sir ','employee',0,1,'2026-05-21 06:02:05'),('EMP0005','testemployee01','$2b$12$7btlNIZPsrAXQ5d/KkHLSu4l/peHmTF.unEYP5TpkhYoWZt2in3m.','testemployee01@example.com','Test Employee','employee',0,1,'2026-05-26 06:56:47'),('EMP0006','devsws','$2b$12$3w9UZIkE.mFOdXAy9XEbhO7Yl0Hxbw9YmEDbCPMsSD54zeSHleeLy','dev@seawindsolution.com','Dev','employee',0,1,'2026-05-26 07:00:53'),('EMP0007','prernamishra','$2b$12$BcclhQ8AQUAMKXuQlMd3NuLQPFHlrPYZ92b5NmzHGA0r6oDwxlXF.','mishraperna3@gmail.com','Prerna','employee',0,1,'2026-06-01 11:36:06'),('EMP0008','jenishhdesignmaster','$2b$12$MG.kZdLcOUkIIpz5j9/5z.WJxFK/F2nOfiPA4X40Vl1vBo4gT87wq','deshmukhaarti568@gmail.com','jenishdesignmaster','employee',0,1,'2026-06-03 07:57:21'),('EMP0009','projectmanagerr','$2b$12$ksiM5v9wT9ktp9m5YGt7CeYclk7nNojl3rEMK6/6XrA2/DS8aM90q','project@seawindsolution.com','Project manager','employee',0,1,'2026-06-03 08:56:10'),('EMP0010','jainlakshya5050','Lakshya1124','jainlakshya5050@gmail.com','Lakshya  L','employee',0,1,'2026-06-09 10:38:08'),('hr001','hr','hr123','hr@seawindsolution.com','HR Manager','hr',1,1,'2026-05-18 12:25:16');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wfh_attendance`
--

DROP TABLE IF EXISTS `wfh_attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wfh_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` varchar(50) NOT NULL COMMENT 'FK ÔåÆ employees.employee_code',
  `attendance_id` int DEFAULT NULL COMMENT 'FK ÔåÆ attendance.id (written after attendance row created)',
  `punch_in_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `punch_out_at` timestamp NULL DEFAULT NULL,
  `duration_minutes` smallint unsigned DEFAULT NULL COMMENT 'Computed on punch-out',
  `idempotency_key` varchar(36) NOT NULL COMMENT 'UUID from client, single-use',
  `status` enum('PENDING_SELFIE','AUTO_APPROVED','FLAGGED','PENDING_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING_SELFIE',
  `attendance_method` enum('SELFIE','GEO') NOT NULL DEFAULT 'SELFIE',
  `geo_latitude` decimal(10,8) DEFAULT NULL,
  `geo_longitude` decimal(11,8) DEFAULT NULL,
  `geo_distance_meters` decimal(10,2) DEFAULT NULL,
  `flag_reason` varchar(500) DEFAULT NULL COMMENT 'Human-readable reason for flag',
  `client_ip` varchar(45) NOT NULL,
  `user_agent` text NOT NULL,
  `client_timestamp` timestamp NULL DEFAULT NULL COMMENT 'Client-reported time ÔÇö audit only, never authoritative',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_idempotency` (`idempotency_key`),
  UNIQUE KEY `uq_emp_date` (`employee_id`,(cast(`punch_in_at` as date))) COMMENT 'One WFH session per employee per day',
  KEY `idx_employee` (`employee_id`),
  KEY `idx_status` (`status`),
  KEY `idx_punch_in` (`punch_in_at`),
  KEY `idx_attendance` (`attendance_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='WFH session records ÔÇö one row per employee per WFH day';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wfh_attendance`
--

LOCK TABLES `wfh_attendance` WRITE;
/*!40000 ALTER TABLE `wfh_attendance` DISABLE KEYS */;
INSERT INTO `wfh_attendance` VALUES (2,'EMP001',3,'2026-06-02 09:25:04',NULL,NULL,'f20c800c-f091-4fab-99e9-a147d04b68a5','PENDING_SELFIE','SELFIE',NULL,NULL,NULL,NULL,'127.0.0.1','test-agent',NULL,'2026-06-02 09:25:04','2026-06-02 09:25:04'),(3,'EMP0006',4,'2026-06-02 10:01:47','2026-06-02 10:03:22',1,'12345678-1234-1234-1234-123456789012','PENDING_SELFIE','SELFIE',NULL,NULL,NULL,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT; Windows NT 10.0; en-IN) WindowsPowerShell/5.1.19041.6456',NULL,'2026-06-02 10:01:47','2026-06-02 10:03:22'),(4,'EMP0007',5,'2026-06-03 07:44:35','2026-06-03 09:04:41',80,'1826213a-f3d3-4869-81ca-992cb6ba3c13','AUTO_APPROVED','GEO',23.02316500,72.50749400,0.00,NULL,'127.0.0.1','python-requests/2.33.1','2026-06-03 04:30:00','2026-06-03 07:44:35','2026-06-03 09:04:40'),(5,'EMP0006',6,'2026-06-03 07:45:02',NULL,NULL,'630716f6-7455-41f6-8c45-b3fedcc804ce','PENDING_SELFIE','SELFIE',NULL,NULL,NULL,NULL,'127.0.0.1','python-requests/2.33.1','2026-06-03 04:30:00','2026-06-03 07:45:02','2026-06-03 07:45:02'),(6,'EMP0008',7,'2026-06-03 08:46:18','2026-06-03 08:47:17',0,'0875e39f-41ae-477a-a744-a5e3bab35b8e','AUTO_APPROVED','GEO',23.02316500,72.50749400,0.00,NULL,'127.0.0.1','python-requests/2.33.1','2026-06-03 03:12:52','2026-06-03 08:46:17','2026-06-03 08:47:16'),(7,'EMP0009',8,'2026-06-03 08:58:33','2026-06-03 10:49:30',110,'5bab641d-4d2d-40ce-bceb-01f31bd2ee7a','AUTO_APPROVED','GEO',23.02316500,72.50749400,0.00,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-03 03:28:32','2026-06-03 08:58:32','2026-06-03 10:49:30'),(8,'EMP0003',9,'2026-06-05 12:58:08',NULL,NULL,'a5de92d9-9d5f-4c78-ab8e-366957b7ddfa','AUTO_APPROVED','GEO',23.02317000,72.50749200,0.00,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-05 07:28:08','2026-06-05 12:58:08','2026-06-05 12:58:08'),(9,'EMP0008',10,'2026-06-06 10:15:56','2026-06-06 11:38:49',82,'7677305f-262f-4eb3-82a3-c61f887ee754','AUTO_APPROVED','GEO',23.02317100,72.50749200,0.11,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-06 04:45:55','2026-06-06 10:15:55','2026-06-06 11:38:48'),(10,'EMP0006',11,'2026-06-08 04:38:28',NULL,NULL,'a223392c-a8c0-4ccb-b635-f302a11192b5','AUTO_APPROVED','GEO',23.02316800,72.50749000,0.30,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-07 23:08:27','2026-06-08 04:38:27','2026-06-08 04:38:27'),(11,'EMP0009',12,'2026-06-08 04:38:54',NULL,NULL,'c302ccaa-e606-4719-9567-9cc968b23701','AUTO_APPROVED','GEO',23.02316800,72.50749000,0.53,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-07 23:08:54','2026-06-08 04:38:54','2026-06-08 04:38:54'),(12,'EMP0008',13,'2026-06-08 06:14:22',NULL,NULL,'a9426dc6-1c2b-44af-aa64-f410a9d644a0','AUTO_APPROVED','GEO',23.02316800,72.50749000,0.30,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-08 00:44:22','2026-06-08 06:14:22','2026-06-08 06:14:22'),(13,'EMP0003',14,'2026-06-09 06:57:06',NULL,NULL,'a9d21e6f-8dd3-4c19-b83a-dd3cf4e445aa','AUTO_APPROVED','GEO',23.02316800,72.50749000,0.30,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-09 01:27:06','2026-06-09 06:57:06','2026-06-09 06:57:06'),(14,'EMP0006',15,'2026-06-09 07:18:28',NULL,NULL,'ddb8d954-21a5-4cb0-b05d-ea5fba21f09f','AUTO_APPROVED','GEO',23.02316800,72.50749000,0.30,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-09 01:48:28','2026-06-09 07:18:28','2026-06-09 07:18:28'),(15,'EMP0006',16,'2026-06-10 04:36:01',NULL,NULL,'ff14f3dd-d38b-440e-be95-03003eae4ea3','AUTO_APPROVED','GEO',23.02316700,72.50748900,0.45,NULL,'127.0.0.1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36','2026-06-09 23:06:00','2026-06-10 04:36:00','2026-06-10 04:36:00');
/*!40000 ALTER TABLE `wfh_attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wfh_system_config`
--

DROP TABLE IF EXISTS `wfh_system_config`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wfh_system_config` (
  `config_key` varchar(100) NOT NULL,
  `config_value` varchar(500) NOT NULL,
  `description` text,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wfh_system_config`
--

LOCK TABLES `wfh_system_config` WRITE;
/*!40000 ALTER TABLE `wfh_system_config` DISABLE KEYS */;
INSERT INTO `wfh_system_config` VALUES ('selfie_max_capture_attempts','3','Maximum retake attempts per session','2026-06-02 08:58:24'),('selfie_max_file_size_kb','2048','Maximum selfie upload size in kilobytes','2026-06-02 08:58:24'),('selfie_min_height_px','100','Minimum image height in pixels','2026-06-02 08:58:24'),('selfie_min_width_px','100','Minimum image width in pixels','2026-06-02 08:58:24'),('selfie_retention_months','12','Months to retain selfie images before automated deletion','2026-06-02 08:58:24'),('wfh_auto_close_hours','14','Hours after which an unclosed WFH session is auto-closed','2026-06-02 08:58:24'),('wfh_geo_radius_meters','500','Radius in metres for WFH geo attendance validation','2026-06-03 09:40:43');
/*!40000 ALTER TABLE `wfh_system_config` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-10 10:23:32
