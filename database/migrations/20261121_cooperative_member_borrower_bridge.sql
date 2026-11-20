-- Migration: Bridge cooperative members and borrower-only memberships
-- Compatible with Hostinger MySQL (provider-prefixed DBs) and local environments

SET @dbname = DATABASE();

-- 1. Add membership_type to coop_members if not exists
SET @tablename = 'coop_members';
SET @columnname = 'membership_type';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_members` ADD COLUMN `membership_type` ENUM(\'full_cooperative\', \'borrower_only\') NOT NULL DEFAULT \'full_cooperative\' AFTER `linked_user_id`'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Ensure index exists for membership_type
SET @indexname = 'idx_coop_members_type_status';
SET @preparedStatementIdx = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND INDEX_NAME = @indexname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_members` ADD INDEX `idx_coop_members_type_status` (`membership_type`, `registration_status`)'
));
PREPARE alterIndexIfNotExists FROM @preparedStatementIdx;
EXECUTE alterIndexIfNotExists;
DEALLOCATE PREPARE alterIndexIfNotExists;

-- Modify nullable fields on coop_members to accommodate provisional borrowers without fabricating dummy data
-- date_of_birth, gender, civil_status, valid_id_type, valid_id_number, signature fields
ALTER TABLE `coop_members`
  MODIFY COLUMN `gender` ENUM('Male', 'Female', 'Other') NULL,
  MODIFY COLUMN `date_of_birth` DATE NULL,
  MODIFY COLUMN `civil_status` ENUM('Single', 'Married', 'Widowed', 'Separated', 'Divorced') NULL,
  MODIFY COLUMN `signature_data` LONGTEXT NULL,
  MODIFY COLUMN `signature_auth_id` VARCHAR(100) NULL,
  MODIFY COLUMN `signature_timestamp` TIMESTAMP NULL,
  MODIFY COLUMN `photo_url` LONGTEXT NULL,
  MODIFY COLUMN `photo_timestamp` TIMESTAMP NULL,
  MODIFY COLUMN `id_selfie_url` LONGTEXT NULL,
  MODIFY COLUMN `id_selfie_timestamp` TIMESTAMP NULL,
  MODIFY COLUMN `valid_id_type` VARCHAR(100) NULL,
  MODIFY COLUMN `valid_id_number` VARCHAR(100) NULL;

-- 2. Audit & Idempotency columns for coop_member_transactions
SET @txntable = 'coop_member_transactions';

-- Add recorded_by_id
SET @col = 'recorded_by_id';
SET @prep = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND COLUMN_NAME = @col) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD COLUMN `recorded_by_id` INT NULL AFTER `recorded_by_name`'
));
PREPARE stmt FROM @prep;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add recorded_by_role
SET @col = 'recorded_by_role';
SET @prep = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND COLUMN_NAME = @col) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD COLUMN `recorded_by_role` ENUM(\'admin\', \'account_officer\') NOT NULL DEFAULT \'account_officer\' AFTER `recorded_by_id`'
));
PREPARE stmt FROM @prep;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add audit_id
SET @col = 'audit_id';
SET @prep = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND COLUMN_NAME = @col) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD COLUMN `audit_id` VARCHAR(64) NULL AFTER `recorded_by_role`'
));
PREPARE stmt FROM @prep;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_method
SET @col = 'payment_method';
SET @prep = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND COLUMN_NAME = @col) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD COLUMN `payment_method` ENUM(\'cash\', \'online\', \'bank_transfer\') NOT NULL DEFAULT \'cash\' AFTER `audit_id`'
));
PREPARE stmt FROM @prep;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_reference
SET @col = 'payment_reference';
SET @prep = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND COLUMN_NAME = @col) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD COLUMN `payment_reference` VARCHAR(100) NULL AFTER `payment_method`'
));
PREPARE stmt FROM @prep;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure unique index for idempotency protection on payment transactions
SET @idxname = 'uniq_member_payment_ref_type';
SET @prepIdx = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @txntable AND INDEX_NAME = @idxname) > 0,
  'SELECT 1',
  'ALTER TABLE `coop_member_transactions` ADD UNIQUE INDEX `uniq_member_payment_ref_type` (`member_no`, `payment_reference`, `transaction_type`)'
));
PREPARE stmtIdx FROM @prepIdx;
EXECUTE stmtIdx;
DEALLOCATE PREPARE stmtIdx;
