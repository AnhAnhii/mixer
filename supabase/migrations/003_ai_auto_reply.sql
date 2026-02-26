-- Migration: AI Auto-Reply Persistence
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. App Settings table (single row for AI config)
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    ai_auto_reply_enabled BOOLEAN DEFAULT false,
    ai_confidence_threshold NUMERIC DEFAULT 0.6,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row
INSERT INTO app_settings (id, ai_auto_reply_enabled, ai_confidence_threshold)
VALUES ('default', false, 0.6)
ON CONFLICT (id) DO NOTHING;

-- 2. AI Training Pairs table
CREATE TABLE IF NOT EXISTS ai_training_pairs (
    id TEXT PRIMARY KEY,
    customer_message TEXT NOT NULL,
    employee_response TEXT NOT NULL,
    context TEXT,
    category TEXT CHECK (category IN ('greeting', 'product', 'order', 'shipping', 'payment', 'other')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster category queries
CREATE INDEX IF NOT EXISTS idx_training_pairs_category ON ai_training_pairs(category);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_pairs ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read/write (for API routes)
CREATE POLICY "Allow all access to app_settings" ON app_settings
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to ai_training_pairs" ON ai_training_pairs
    FOR ALL USING (true) WITH CHECK (true);
