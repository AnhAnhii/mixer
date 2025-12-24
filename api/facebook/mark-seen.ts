// api/facebook/mark-seen.ts
// API endpoint để đánh dấu tin nhắn đã đọc trên Facebook

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

interface MarkSeenRequest {
    recipientId: string;
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

    const { recipientId } = req.body as MarkSeenRequest;

    if (!recipientId) {
        return res.status(400).json({ error: 'recipientId is required' });
    }

    if (!PAGE_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'PAGE_ACCESS_TOKEN not configured' });
    }

    try {
        // Gọi Facebook API để đánh dấu đã đọc
        const response = await fetch(
            `${FB_GRAPH_URL}/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    sender_action: 'mark_seen',
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

        console.log('Marked as seen:', recipientId);

        return res.status(200).json({
            success: true,
            recipientId,
        });
    } catch (error) {
        console.error('Error marking as seen:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to mark as seen'
        });
    }
}
