-- Migration: Bridge cooperative members and borrower-only memberships
-- Compatible with Hostinger MySQL (provider-prefixed DBs) and local environments

-- Add membership_type to coop_members if not exists
SET @dbname = DATABASE();
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
