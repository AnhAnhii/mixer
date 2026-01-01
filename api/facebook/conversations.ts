// api/facebook/conversations.ts
// API endpoint để lấy danh sách conversations (Facebook + Instagram)

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_API_VERSION = 'v21.0';
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

    const { after, limit = '50', platform = 'facebook' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    try {
        // Handle Instagram conversations
        if (platform === 'instagram') {
            return await handleInstagramConversations(req, res, limitNum, after as string);
        }

        // Handle Facebook conversations (default)
        return await handleFacebookConversations(req, res, limitNum, after as string);

    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
}

async function handleFacebookConversations(
    req: VercelRequest,
    res: VercelResponse,
    limitNum: number,
    after?: string
) {
    let url = `${FB_GRAPH_URL}/${PAGE_ID}/conversations?fields=id,participants,updated_time,snippet,unread_count&limit=${limitNum}&access_token=${PAGE_ACCESS_TOKEN}`;

    if (after) {
        url += `&after=${after}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error('Facebook API Error:', data.error);
        return res.status(400).json({ error: data.error.message });
    }

    const conversations = (data.data || []).map((conv: any) => {
        const customer = conv.participants?.data?.find((p: any) => p.id !== PAGE_ID);
        return {
            id: conv.id,
            recipientId: customer?.id || '',
            customerName: customer?.name || 'Khách hàng',
            lastMessage: conv.snippet || '',
            lastMessageTime: conv.updated_time,
            isUnread: (conv.unread_count || 0) > 0,
            unreadCount: conv.unread_count || 0,
            platform: 'facebook'
        };
    });

    const paging = data.paging || {};
    return res.status(200).json({
        success: true,
        conversations,
        count: conversations.length,
        platform: 'facebook',
        pagination: {
            nextCursor: paging.cursors?.after || null,
            hasMore: !!paging.next,
        }
    });
}

async function handleInstagramConversations(
    req: VercelRequest,
    res: VercelResponse,
    limitNum: number,
    after?: string
) {
    console.log('📸 Fetching Instagram conversations...');

    // First get Instagram Business Account ID
    const pageResponse = await fetch(
        `${FB_GRAPH_URL}/me?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const pageData = await pageResponse.json();

    if (pageData.error) {
        return res.status(400).json({ error: pageData.error.message });
    }

    const instagramAccountId = pageData.instagram_business_account?.id;
    if (!instagramAccountId) {
        return res.status(400).json({
            error: 'No Instagram Business Account connected',
            hint: 'Connect Instagram to Facebook Page first'
        });
    }

    // Get Instagram conversations
    let url = `${FB_GRAPH_URL}/${instagramAccountId}/conversations?fields=id,participants,updated_time&limit=${limitNum}&access_token=${PAGE_ACCESS_TOKEN}`;

    if (after) {
        url += `&after=${after}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error('Instagram API Error:', data.error);
        return res.status(400).json({ error: data.error.message });
    }

    console.log('📊 Instagram returned', data.data?.length || 0, 'conversations');

    const conversations = (data.data || []).map((conv: any) => {
        const customer = conv.participants?.data?.find((p: any) => p.id !== instagramAccountId);
        return {
            id: conv.id,
            recipientId: customer?.id || '',
            customerName: customer?.username || customer?.name || 'Instagram User',
            lastMessage: '', // Instagram doesn't return snippet in the same way
            lastMessageTime: conv.updated_time,
            isUnread: false, // Need separate API call to check
            unreadCount: 0,
            platform: 'instagram'
        };
    });

    const paging = data.paging || {};
    return res.status(200).json({
        success: true,
        conversations,
        count: conversations.length,
        platform: 'instagram',
        instagramAccountId,
        pagination: {
            nextCursor: paging.cursors?.after || null,
            hasMore: !!paging.next,
        }
    });
}
