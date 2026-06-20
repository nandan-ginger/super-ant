-- =====================================================
-- Ginger LiveChat AI Copilot — Database Schema
-- Migration: 002_widgets.sql
-- Run automatically by the backend on startup.
-- =====================================================

-- -------------------------------------------------------
-- widgets: one row per registered customer website
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS widgets (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_code  VARCHAR(64)  UNIQUE NOT NULL,   -- short unique embed key e.g. wgt_abc12345
  name         VARCHAR(255) NOT NULL,           -- website/client name
  url          TEXT         NOT NULL,           -- website URL
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widgets_code ON widgets (widget_code);
CREATE INDEX IF NOT EXISTS idx_widgets_created ON widgets (created_at DESC);

-- -------------------------------------------------------
-- admin_users: platform admins created by superadmin
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  username     VARCHAR(100) UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT         NOT NULL,
  role         VARCHAR(20)  NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
  -- Granular permissions stored as JSONB
  -- Example: {"widgets":{"view":true,"edit":true,"delete":false},"livechats":{"view":true},"visitors":{"view":true},"leads":{"view":false}}
  permissions  JSONB        NOT NULL DEFAULT '{}',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by   UUID         REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users (username);
CREATE INDEX IF NOT EXISTS idx_admin_users_email    ON admin_users (email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role     ON admin_users (role);
