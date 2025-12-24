// api/facebook/messages.ts
// API endpoint để lấy tin nhắn trong một conversation

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID || '105265398928721';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { conversationId } = req.query;

    if (!conversationId || typeof conversationId !== 'string') {
        return res.status(400).json({ error: 'conversationId is required' });
    }

    if (!PAGE_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'PAGE_ACCESS_TOKEN not configured' });
    }

    try {
        // Lấy tin nhắn trong conversation
        const messagesResponse = await fetch(
            `${FB_GRAPH_URL}/${conversationId}/messages?fields=id,message,from,to,created_time&access_token=${PAGE_ACCESS_TOKEN}`
        );

        const messagesData = await messagesResponse.json();

        if (messagesData.error) {
            console.error('Facebook API Error:', messagesData.error);
            return res.status(400).json({ error: messagesData.error.message });
        }

        // Format messages
        const messages = (messagesData.data || []).map((msg: any) => ({
            id: msg.id,
            text: msg.message || '',
            senderId: msg.from?.id || '',
            senderName: msg.from?.name || '',
            isFromPage: msg.from?.id === PAGE_ID,
            timestamp: msg.created_time,
        }));

        return res.status(200).json({
            success: true,
            messages,
            conversationId,
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to fetch messages' });
    }
}
