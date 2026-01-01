// api/sheets/webhook.ts
// Receive updates from Google Sheets (2-way sync)
// Tự động gửi thông báo cho khách khi cập nhật tracking code

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// Gửi tin nhắn qua Facebook Messenger
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
            'shippingProvider': 'shipping_provider',
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
            .select('id, facebook_user_id, shipping_provider, tracking_code')
            .ilike('id', `${orderId}%`)
            .limit(1);

        if (findError || !orders || orders.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Order not found',
            });
        }

        const order = orders[0];
        const fullOrderId = order.id;

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

        // 🔔 TỰ ĐỘNG GỬI THÔNG BÁO KHI CẬP NHẬT TRACKING CODE
        let notificationSent = false;
        if (field === 'trackingCode' && value && order.facebook_user_id) {
            const shippingProvider = order.shipping_provider || 'Viettel Post';
            const trackingCode = value;

            const message = `🎉 Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi!
🚚 Đơn vị vận chuyển: ${shippingProvider}
📋 Mã vận đơn: ${trackingCode}
📞 Bạn vui lòng để ý điện thoại để nhận hàng nhé. Cảm ơn bạn! 💕`;

            notificationSent = await sendFacebookMessage(order.facebook_user_id, message);
            console.log(`📲 Notification sent: ${notificationSent} for order ${orderId}`);
        }

        return res.status(200).json({
            success: true,
            message: `Updated ${field} for order ${orderId}`,
            notificationSent,
        });

    } catch (error) {
        console.error('Error processing webhook:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
