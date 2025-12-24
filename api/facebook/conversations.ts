// api/facebook/conversations.ts
// API endpoint để lấy danh sách conversations với pagination

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

    if (!PAGE_ACCESS_TOKEN) {
        return res.status(500).json({ error: 'PAGE_ACCESS_TOKEN not configured' });
    }

    // Get pagination cursor from query params
    const { after, limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    try {
        // Build URL with pagination
        let url = `${FB_GRAPH_URL}/${PAGE_ID}/conversations?fields=id,participants,updated_time,snippet,unread_count&limit=${limitNum}&access_token=${PAGE_ACCESS_TOKEN}`;

        // Add cursor for pagination
        if (after && typeof after === 'string') {
            url += `&after=${after}`;
        }

        const conversationsResponse = await fetch(url);
        const conversationsData = await conversationsResponse.json();

        if (conversationsData.error) {
            console.error('Facebook API Error:', conversationsData.error);
            return res.status(400).json({ error: conversationsData.error.message });
        }

        // Format conversations
        const conversations = (conversationsData.data || []).map((conv: any) => {
            const customer = conv.participants?.data?.find(
                (p: any) => p.id !== PAGE_ID
            );

            return {
                id: conv.id,
                recipientId: customer?.id || '',
                customerName: customer?.name || 'Khách hàng',
                lastMessage: conv.snippet || '',
                lastMessageTime: conv.updated_time,
                isUnread: (conv.unread_count || 0) > 0,
                unreadCount: conv.unread_count || 0,
            };
        });

        // Get pagination info
        const paging = conversationsData.paging || {};
        const nextCursor = paging.cursors?.after || null;
        const hasMore = !!paging.next;

        return res.status(200).json({
            success: true,
            conversations,
            count: conversations.length,
            pagination: {
                nextCursor,
                hasMore,
            }
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
}
