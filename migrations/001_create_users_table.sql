-- Migration: Create Users Table
-- Description: Základní tabulka pro uživatele aplikace
-- Created: 2025-11-29

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,

  -- Game Stats
  balance DECIMAL(16, 8) DEFAULT 0.00000000,
  total_hashrate DECIMAL(12, 2) DEFAULT 0.00,
  total_earned DECIMAL(16, 8) DEFAULT 0.00000000,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,

  -- Account Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Constraints
  CONSTRAINT username_length CHECK (char_length(username) >= 3),
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes pro rychlejší vyhledávání
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Trigger pro automatickou aktualizaci updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Komentáře k tabulce a sloupcům
COMMENT ON TABLE users IS 'Hlavní tabulka uživatelů pro crypto mining idle game';
COMMENT ON COLUMN users.balance IS 'Aktuální balance v BTC';
COMMENT ON COLUMN users.total_hashrate IS 'Celkový hashrate všech minerů uživatele (MH/s)';
COMMENT ON COLUMN users.total_earned IS 'Celkové vytěžené množství BTC za celou dobu';
