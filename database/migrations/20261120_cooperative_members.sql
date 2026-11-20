-- Migration: Add cooperative members and transaction ledger
-- Executed idempotently for Tribute Credit Cooperative

USE `tribute_coop_db`;

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
  
  -- Mandatory Evidence Items
  `signature_data` LONGTEXT NOT NULL,
  `signature_auth_id` VARCHAR(100) NOT NULL,
  `signature_timestamp` TIMESTAMP NOT NULL,
  `photo_url` LONGTEXT NOT NULL,
  `photo_timestamp` TIMESTAMP NOT NULL,
  `id_selfie_url` LONGTEXT NOT NULL,
  `id_selfie_timestamp` TIMESTAMP NOT NULL,
  `valid_id_type` VARCHAR(100) NOT NULL,
  `valid_id_number` VARCHAR(100) NOT NULL,
  
  -- Fixed Fees
  `registration_fee` DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  `capital_share` DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
  `initial_savings` DECIMAL(12,2) NOT NULL DEFAULT 500.00,
  `total_paid` DECIMAL(12,2) NOT NULL DEFAULT 3000.00,
  `payment_method` ENUM('cash', 'online', 'bank_transfer') NOT NULL DEFAULT 'cash',
  `payment_reference` VARCHAR(100) NULL,
  
  -- Audit & Staff Association
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
