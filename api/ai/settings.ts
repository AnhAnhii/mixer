// api/ai/settings.ts
// AI auto-reply settings — persisted in Supabase (not in-memory)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function getSupabase() {
    return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = getSupabase();

    // GET — current settings + training pair count
    if (req.method === 'GET') {
        const { data: settings } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 'default')
            .single();

        const { count } = await supabase
            .from('ai_training_pairs')
            .select('*', { count: 'exact', head: true });

        return res.status(200).json({
            success: true,
            settings: settings || { ai_auto_reply_enabled: false, ai_confidence_threshold: 0.6 },
            trainingDataCount: count || 0
        });
    }

    // POST — update settings
    if (req.method === 'POST') {
        const { action, data } = req.body;

        switch (action) {
            case 'toggle': {
                const { data: current } = await supabase
                    .from('app_settings')
                    .select('ai_auto_reply_enabled')
                    .eq('id', 'default')
                    .single();

                const newValue = !(current?.ai_auto_reply_enabled);
                await supabase
                    .from('app_settings')
                    .upsert({ id: 'default', ai_auto_reply_enabled: newValue, updated_at: new Date().toISOString() });

                console.log(`🤖 AI Auto-reply toggled to ${newValue ? 'ON' : 'OFF'}`);
                return res.status(200).json({ success: true, enabled: newValue });
            }

            case 'setEnabled': {
                const enabled = !!data?.enabled;
                await supabase
                    .from('app_settings')
                    .upsert({ id: 'default', ai_auto_reply_enabled: enabled, updated_at: new Date().toISOString() });

                console.log(`🤖 AI Auto-reply set to ${enabled ? 'ON' : 'OFF'}`);
                return res.status(200).json({ success: true, enabled });
            }

            case 'updateSettings': {
                const updates: any = { id: 'default', updated_at: new Date().toISOString() };
                if (data?.confidenceThreshold !== undefined) {
                    updates.ai_confidence_threshold = data.confidenceThreshold;
                }
                await supabase.from('app_settings').upsert(updates);
                return res.status(200).json({ success: true });
            }

            default:
                return res.status(400).json({ error: 'Unknown action' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
