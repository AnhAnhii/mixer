// api/facebook/posts.ts
// API endpoint to fetch Facebook Page posts

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID || 'me';

interface FacebookPost {
    id: string;
    message?: string;
    full_picture?: string;
    created_time: string;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
}

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
        return res.status(500).json({ error: 'Page access token not configured' });
    }

    try {
        const limit = parseInt(req.query.limit as string) || 10;

        // Fetch posts from Facebook Graph API
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${PAGE_ID}/posts?` +
            `fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true)` +
            `&limit=${limit}` +
            `&access_token=${PAGE_ACCESS_TOKEN}`
        );

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        // Transform to frontend format
        const posts = (data.data || []).map((post: FacebookPost) => ({
            id: post.id,
            content: post.message || '',
            imageUrl: post.full_picture || '',
            createdAt: post.created_time,
            likesCount: post.likes?.summary?.total_count || 0,
            commentsCount: post.comments?.summary?.total_count || 0
        }));

        return res.status(200).json({ posts });

    } catch (error) {
        console.error('Error fetching posts:', error);
        return res.status(500).json({ error: 'Failed to fetch posts' });
    }
}
