// api/sheets/index.ts
// Combined Google Sheets handler: sync + webhook (to stay within Vercel 12-function limit)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function sendFacebookMessage(recipientId: string, message: string): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN || !recipientId) return false;
    try {
        const response = await fetch(
            `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: message }
                })
            }
        );
        const result = await response.json();
        if (result.error) {
            console.error('Facebook API error:', result.error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error sending Facebook message:', error);
        return false;
    }
}

async function handleSync(req: VercelRequest, res: VercelResponse) {
    const { action, order, googleScriptUrl, sheetName } = req.body;

    if (!googleScriptUrl) {
        return res.status(400).json({ success: false, error: 'Google Script URL not configured' });
    }
    if (!order) {
        return res.status(400).json({ success: false, error: 'Order data is required' });
    }

    const response = await fetch(googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action || 'create', order, sheetName }),
    });

    const result = await response.json();
    return res.status(200).json({ success: true, message: 'Order synced to Google Sheets', result });
}

async function handleWebhook(req: VercelRequest, res: VercelResponse) {
    const { orderId, field, value } = req.body;

    if (!orderId || !field) {
        return res.status(400).json({ success: false, error: 'orderId and field are required' });
    }

    const fieldMapping: Record<string, string> = {
        'status': 'status',
        'trackingCode': 'tracking_code',
        'shippingProvider': 'shipping_provider',
        'notes': 'notes',
        'paymentStatus': 'payment_status',
    };

    const dbField = fieldMapping[field];
    if (!dbField) {
        return res.status(400).json({ success: false, error: `Unknown field: ${field}` });
    }

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: orders, error: findError } = await supabase
        .from('orders')
        .select('id, facebook_user_id, shipping_provider, tracking_code')
        .ilike('id', `${orderId}%`)
        .limit(1);

    if (findError || !orders || orders.length === 0) {
        return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orders[0];
    const { error: updateError } = await supabase
        .from('orders')
        .update({ [dbField]: value })
        .eq('id', order.id);

    if (updateError) {
        return res.status(500).json({ success: false, error: updateError.message });
    }

    let notificationSent = false;
    if (field === 'trackingCode' && value && order.facebook_user_id) {
        const shippingProvider = order.shipping_provider || 'Viettel Post';
        const message = `🎉 Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi!\n🚚 Đơn vị vận chuyển: ${shippingProvider}\n📋 Mã vận đơn: ${value}\n📞 Bạn vui lòng để ý điện thoại để nhận hàng nhé. Cảm ơn bạn! 💕`;
        notificationSent = await sendFacebookMessage(order.facebook_user_id, message);
    }

    return res.status(200).json({
        success: true,
        message: `Updated ${field} for order ${orderId}`,
        notificationSent,
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const route = (req.query.action as string) || req.body?.route;

        if (route === 'webhook') {
            return handleWebhook(req, res);
        }
        return handleSync(req, res);
    } catch (error) {
        console.error('Error in sheets handler:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
