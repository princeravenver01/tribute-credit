-- Tribute Cooperative Loan Management System Database Schema
-- Compatible with XAMPP MySQL (phpMyAdmin)

CREATE DATABASE IF NOT EXISTS `tribute_coop_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `tribute_coop_db`;

-- 1. Users Table (Handles Admin, Account Officer, Borrower authentication)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_no` VARCHAR(50) UNIQUE NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'account_officer', 'borrower') NOT NULL DEFAULT 'borrower',
  `contact_number` VARCHAR(30) NULL,
  `address` TEXT NULL,
  `status` ENUM('active', 'inactive', 'pending') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Loan Products Table (Defines loan types, interest rates, terms)
CREATE TABLE IF NOT EXISTS `loan_products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL COMMENT 'Monthly or annual interest rate in %',
  `term_months` INT NOT NULL DEFAULT 12,
  `min_amount` DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
  `max_amount` DECIMAL(12,2) NOT NULL DEFAULT 500000.00,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Loan Applications Table
CREATE TABLE IF NOT EXISTS `loan_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loan_code` VARCHAR(50) UNIQUE NOT NULL,
  `borrower_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `amount_requested` DECIMAL(12,2) NOT NULL,
  `term_months` INT NOT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL,
  `purpose` TEXT NOT NULL,
  `monthly_amortization` DECIMAL(12,2) NOT NULL,
  `status` ENUM('pending', 'under_review', 'approved', 'rejected', 'disbursed', 'completed') DEFAULT 'pending',
  `assigned_officer_id` INT NULL,
  `officer_notes` TEXT NULL,
  `approved_by_admin_id` INT NULL,
  `rejection_reason` TEXT NULL,
  `application_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `disbursed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`borrower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `loan_products`(`id`),
  FOREIGN KEY (`assigned_officer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`approved_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Repayment Schedules / Ledger Table
CREATE TABLE IF NOT EXISTS `repayment_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `loan_id` INT NOT NULL,
  `installment_no` INT NOT NULL,
  `due_date` DATE NOT NULL,
  `principal_amount` DECIMAL(12,2) NOT NULL,
  `interest_amount` DECIMAL(12,2) NOT NULL,
  `total_due` DECIMAL(12,2) NOT NULL,
  `amount_paid` DECIMAL(12,2) DEFAULT 0.00,
  `status` ENUM('unpaid', 'partially_paid', 'paid', 'overdue') DEFAULT 'unpaid',
  `paid_at` TIMESTAMP NULL,
  FOREIGN KEY (`loan_id`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Payments / Transactions Table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reference_no` VARCHAR(60) UNIQUE NOT NULL,
  `loan_id` INT NOT NULL,
  `borrower_id` INT NOT NULL,
  `recorded_by_id` INT NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` ENUM('cash', 'bank_transfer', 'cheque', 'online') DEFAULT 'cash',
  `payment_date` DATE NOT NULL,
  `notes` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`loan_id`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`borrower_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

-- 6. Audit Trail / Activity Logs
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Non-sensitive starter products. Create the first administrator separately with
-- `npm run create-admin`; the production schema intentionally seeds no users.
INSERT IGNORE INTO `loan_products` (`id`, `name`, `description`, `interest_rate`, `term_months`, `min_amount`, `max_amount`) VALUES
(1, 'Regular Emergency Loan', 'Quick cash loan for unexpected emergencies and medical bills', 1.50, 12, 2000.00, 50000.00),
(2, 'Micro-Business / Livelihood Loan', 'Capital loan for cooperative small business entrepreneurs', 1.25, 24, 10000.00, 200000.00),
(3, 'Educational Loan', 'Tuition and academic requirements support loan for members and their dependents', 1.00, 10, 5000.00, 60000.00);

-- 7. Cooperative Members Table (Membership Registry separate from Loan Applications)
CREATE TABLE IF NOT EXISTS `coop_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_no` VARCHAR(50) UNIQUE NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `middle_name` VARCHAR(100) NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `suffix` VARCHAR(20) NULL,
  `full_name` VARCHAR(255) NOT NULL,
  `gender` ENUM('Male', 'Female', 'Other') NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `civil_status` ENUM('Single', 'Married', 'Widowed', 'Separated', 'Divorced') NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `contact_number` VARCHAR(30) NOT NULL,
  `address` TEXT NOT NULL,
  `barangay` VARCHAR(100) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `province` VARCHAR(100) NOT NULL,
  `occupation` VARCHAR(100) NOT NULL,
  `monthly_income` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `signature_data` LONGTEXT NOT NULL,
  `signature_auth_id` VARCHAR(100) NOT NULL,
  `signature_timestamp` TIMESTAMP NOT NULL,
  `photo_url` LONGTEXT NOT NULL,
  `photo_timestamp` TIMESTAMP NOT NULL,
  `id_selfie_url` LONGTEXT NOT NULL,
  `id_selfie_timestamp` TIMESTAMP NOT NULL,
  `valid_id_type` VARCHAR(100) NOT NULL,
  `valid_id_number` VARCHAR(100) NOT NULL,
  `registration_fee` DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  `capital_share` DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
  `initial_savings` DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  `total_paid` DECIMAL(12,2) NOT NULL DEFAULT 3000.00,
  `payment_method` ENUM('cash', 'online', 'bank_transfer') NOT NULL DEFAULT 'cash',
  `payment_reference` VARCHAR(100) NULL,
  `registered_by_id` INT NULL,
  `registered_by_name` VARCHAR(150) NOT NULL,
  `registered_by_role` ENUM('admin', 'account_officer') NOT NULL,
  `registration_status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (`member_no`),
  INDEX (`email`),
  INDEX (`registration_status`)
) ENGINE=InnoDB;

-- 8. Cooperative Member Transactions / Fee Ledger
CREATE TABLE IF NOT EXISTS `coop_member_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `member_id` INT NOT NULL,
  `member_no` VARCHAR(50) NOT NULL,
  `transaction_type` ENUM('registration_fee', 'capital_share', 'savings_deposit') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `reference_no` VARCHAR(100) NOT NULL,
  `recorded_by_name` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`member_id`) REFERENCES `coop_members`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
