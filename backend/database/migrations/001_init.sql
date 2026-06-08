-- =====================================================
-- Ginger LiveChat AI Copilot — Database Schema
-- Migration: 001_init.sql
-- Run automatically by the backend on first startup.
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------
-- sessions: one row per widget session (browser tab)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            VARCHAR(36)   PRIMARY KEY,          -- UUID from backend
  widget_code   VARCHAR(255)  NOT NULL,
  page_url      TEXT,
  page_title    TEXT,
  started_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_active   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_widget ON sessions (widget_code);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions (started_at DESC);

-- -------------------------------------------------------
-- messages: chat history per session
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    VARCHAR(36)   NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20)   NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content       TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages (session_id, created_at);

-- -------------------------------------------------------
-- leads: contact details captured from detected intent
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    VARCHAR(36)   REFERENCES sessions(id) ON DELETE SET NULL,
  name          VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(50),
  requirement   TEXT,
  intent        VARCHAR(100),
  page_url      TEXT,
  captured_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email     ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_captured  ON leads (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_intent    ON leads (intent);
