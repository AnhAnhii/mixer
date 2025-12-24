// api/facebook/send.ts
// API endpoint để gửi tin nhắn

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

interface SendMessageRequest {
    recipientId: string;
    message: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { recipientId, message } = req.body as SendMessageRequest;

    if (!recipientId || !message) {
        return res.status(400).json({ error: 'recipientId and message are required' });
    }

    if (!PAGE_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'PAGE_ACCESS_TOKEN not configured' });
    }

    try {
        // Gửi tin nhắn qua Facebook API
        const response = await fetch(
            `${FB_GRAPH_URL}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: message },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API Error:', data.error);
            return res.status(400).json({
                success: false,
                error: data.error.message
            });
        }

        console.log('Message sent successfully:', data);

        return res.status(200).json({
            success: true,
            messageId: data.message_id,
            recipientId: data.recipient_id,
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send message'
        });
    }
}
