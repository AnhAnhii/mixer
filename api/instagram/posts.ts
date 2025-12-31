// api/instagram/posts.ts
// API endpoint to fetch Instagram posts

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

interface InstagramPost {
    id: string;
    caption?: string;
    media_url?: string;
    media_type: string;
    timestamp: string;
    like_count?: number;
    comments_count?: number;
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
        let instagramAccountId = INSTAGRAM_ACCOUNT_ID;

        // If no Instagram ID configured, try to get it from the Page
        if (!instagramAccountId) {
            console.log('📸 Getting Instagram Account ID from Page...');
            const pageResponse = await fetch(
                `https://graph.facebook.com/v21.0/me?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`
            );
            const pageData = await pageResponse.json();

            if (pageData.error) {
                console.error('❌ Error getting Instagram account:', pageData.error);
                return res.status(400).json({ error: pageData.error.message });
            }

            instagramAccountId = pageData.instagram_business_account?.id;

            if (!instagramAccountId) {
                return res.status(400).json({
                    error: 'No Instagram Business Account connected to this Page',
                    hint: 'Connect Instagram Business Account to Facebook Page first'
                });
            }

            console.log('   Instagram Account ID:', instagramAccountId);
        }

        console.log('📸 Fetching Instagram posts...');
        console.log('   Instagram Account ID:', instagramAccountId);
        console.log('   Limit:', limit);

        // Fetch Instagram media
        const url = `https://graph.facebook.com/v21.0/${instagramAccountId}/media?` +
            `fields=id,caption,media_url,media_type,timestamp,like_count,comments_count` +
            `&limit=${limit}` +
            `&access_token=${PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('❌ Instagram API error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        console.log('📊 Instagram returned', data.data?.length || 0, 'posts');

        // Transform to frontend format
        const posts = (data.data || []).map((post: InstagramPost) => ({
            id: post.id,
            content: post.caption || 'Bài viết không có caption',
            imageUrl: post.media_url || '',
            createdAt: post.timestamp,
            likesCount: post.like_count || 0,
            commentsCount: post.comments_count || 0,
            mediaType: post.media_type
        }));

        console.log('✅ Returning', posts.length, 'Instagram posts');

        return res.status(200).json({
            posts,
            instagramAccountId,
            debug: {
                totalFetched: data.data?.length || 0
            }
        });

    } catch (error) {
        console.error('❌ Error fetching Instagram posts:', error);
        return res.status(500).json({ error: 'Failed to fetch Instagram posts' });
    }
}
