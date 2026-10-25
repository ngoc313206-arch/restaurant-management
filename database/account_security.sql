
-- ===========================================
-- RESTAURANT MANAGEMENT
-- MIGRATION: ACCOUNT SECURITY
-- ===========================================

BEGIN;

-- Trạng thái tài khoản
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Phiên bản phiên đăng nhập
ALTER TABLE users
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- Kiểm tra phiên bản không âm
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_token_version_nonnegative'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_token_version_nonnegative
    CHECK (token_version >= 0);
  END IF;
END $$;

COMMIT;

