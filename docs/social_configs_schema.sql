-- ========================================
-- SOCIAL AUTO-REPLY SCHEMA
-- ========================================

-- Table để lưu cấu hình auto-reply cho từng post
CREATE TABLE IF NOT EXISTS social_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    comment_replies JSONB DEFAULT '[]'::jsonb,
    inbox_message TEXT DEFAULT '',
    attached_product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_configs_post_id ON social_configs(post_id);
CREATE INDEX IF NOT EXISTS idx_social_configs_enabled ON social_configs(is_enabled);

-- Enable RLS
ALTER TABLE social_configs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust as needed)
CREATE POLICY "Allow all operations on social_configs"
ON social_configs FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE social_configs;

-- ========================================
-- TEST INSERT
-- ========================================
-- INSERT INTO social_configs (post_id, is_enabled, comment_replies, inbox_message)
-- VALUES (
--     'test_post_123',
--     true,
--     '[{"id": "1", "text": "Shop đã inbox bạn rồi ạ!"}]',
--     'Chào {{customer_name}}, cảm ơn bạn đã quan tâm!'
-- );
