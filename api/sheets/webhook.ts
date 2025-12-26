// api/sheets/webhook.ts
// Receive updates from Google Sheets (2-way sync)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { orderId, field, value } = req.body;

        if (!orderId || !field) {
            return res.status(400).json({
                success: false,
                error: 'orderId and field are required',
            });
        }

        // Map sheet field names to database column names
        const fieldMapping: Record<string, string> = {
            'status': 'status',
            'trackingCode': 'tracking_code',
            'notes': 'notes',
            'paymentStatus': 'payment_status',
        };

        const dbField = fieldMapping[field];
        if (!dbField) {
            return res.status(400).json({
                success: false,
                error: `Unknown field: ${field}`,
            });
        }

        // Update Supabase
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({
                success: false,
                error: 'Supabase not configured',
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find order by short ID (first 8 characters)
        const { data: orders, error: findError } = await supabase
            .from('orders')
            .select('id')
            .ilike('id', `${orderId}%`)
            .limit(1);

        if (findError || !orders || orders.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
            });
        }

        const fullOrderId = orders[0].id;

        // Update the order
        const { error: updateError } = await supabase
            .from('orders')
            .update({ [dbField]: value })
            .eq('id', fullOrderId);

        if (updateError) {
            return res.status(500).json({
                success: false,
                error: updateError.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: `Updated ${field} for order ${orderId}`,
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
