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
        const limit = parseInt(req.query.limit as string) || 20;

        console.log('📰 Fetching Facebook posts...');
        console.log('   PAGE_ID:', PAGE_ID);
        console.log('   Limit:', limit);

        // Fetch posts from Facebook Graph API
        // Using /feed instead of /posts to get all posts including shared posts
        const url = `https://graph.facebook.com/v18.0/${PAGE_ID}/feed?` +
            `fields=id,message,full_picture,created_time,likes.summary(true),comments.summary(true),type` +
            `&limit=${limit}` +
            `&access_token=${PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('❌ Facebook API error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        console.log('📊 Facebook returned', data.data?.length || 0, 'posts');

        // Transform to frontend format - filter to only show posts with images
        const posts = (data.data || [])
            .filter((post: FacebookPost) => post.full_picture) // Chỉ lấy bài có ảnh
            .map((post: FacebookPost) => ({
                id: post.id,
                content: post.message || 'Bài viết không có nội dung text',
                imageUrl: post.full_picture || '',
                createdAt: post.created_time,
                likesCount: post.likes?.summary?.total_count || 0,
                commentsCount: post.comments?.summary?.total_count || 0
            }));

        console.log('✅ Returning', posts.length, 'posts with images');

        return res.status(200).json({
            posts,
            debug: {
                pageId: PAGE_ID,
                totalFetched: data.data?.length || 0,
                withImages: posts.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching posts:', error);
        return res.status(500).json({ error: 'Failed to fetch posts' });
    }
}

