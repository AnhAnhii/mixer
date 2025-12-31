// api/facebook/posts.ts
// API endpoint to fetch Facebook Page posts AND Instagram posts
// Use ?platform=instagram to get Instagram posts

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID || 'me';

interface FacebookAttachment {
    media?: { image?: { src: string } };
    subattachments?: { data: Array<{ media?: { image?: { src: string } } }> };
}

interface FacebookPost {
    id: string;
    message?: string;
    full_picture?: string;
    attachments?: { data: FacebookAttachment[] };
    created_time: string;
    reactions?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
}

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

    const platform = req.query.platform as string || 'facebook';
    const limit = parseInt(req.query.limit as string) || 20;

    try {
        // Handle Instagram posts
        if (platform === 'instagram') {
            return await handleInstagramPosts(req, res, limit);
        }

        // Handle Facebook posts (default)
        return await handleFacebookPosts(req, res, limit);

    } catch (error) {
        console.error('❌ Error fetching posts:', error);
        return res.status(500).json({ error: 'Failed to fetch posts' });
    }
}

async function handleFacebookPosts(req: VercelRequest, res: VercelResponse, limit: number) {
    console.log('📰 Fetching Facebook posts...');
    console.log('   PAGE_ID:', PAGE_ID);
    console.log('   Limit:', limit);

    const url = `https://graph.facebook.com/v21.0/${PAGE_ID}/published_posts?` +
        `fields=id,message,full_picture,attachments{media,subattachments},created_time,reactions.summary(true),comments.summary(true)` +
        `&limit=${limit}` +
        `&access_token=${PAGE_ACCESS_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error('❌ Facebook API error:', data.error);
        return res.status(400).json({ error: data.error.message });
    }

    console.log('📊 Facebook returned', data.data?.length || 0, 'posts');

    const getImageUrl = (post: FacebookPost): string | null => {
        const attachments = post.attachments?.data;
        if (!attachments || attachments.length === 0) return null;
        const firstAttachment = attachments[0];
        if (firstAttachment.media?.image?.src) return firstAttachment.media.image.src;
        if (firstAttachment.subattachments?.data?.[0]?.media?.image?.src) {
            return firstAttachment.subattachments.data[0].media.image.src;
        }
        return null;
    };

    const allPosts = (data.data || []).map((post: FacebookPost) => {
        const imageUrl = getImageUrl(post) || post.full_picture;
        return {
            id: post.id,
            content: post.message || 'Bài viết không có nội dung text',
            imageUrl: imageUrl || 'https://via.placeholder.com/400x300?text=No+Image',
            createdAt: post.created_time,
            likesCount: post.reactions?.summary?.total_count || 0,
            commentsCount: post.comments?.summary?.total_count || 0
        };
    });

    return res.status(200).json({
        posts: allPosts,
        platform: 'facebook',
        debug: { pageId: PAGE_ID, totalFetched: data.data?.length || 0 }
    });
}

async function handleInstagramPosts(req: VercelRequest, res: VercelResponse, limit: number) {
    console.log('📸 Fetching Instagram posts...');

    // First get Instagram Business Account ID from the Page
    const pageResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=instagram_business_account&access_token=${PAGE_ACCESS_TOKEN}`
    );
    const pageData = await pageResponse.json();

    if (pageData.error) {
        console.error('❌ Error getting Instagram account:', pageData.error);
        return res.status(400).json({ error: pageData.error.message });
    }

    const instagramAccountId = pageData.instagram_business_account?.id;

    if (!instagramAccountId) {
        return res.status(400).json({
            error: 'No Instagram Business Account connected to this Page',
            hint: 'Connect Instagram Business Account to Facebook Page first'
        });
    }

    console.log('   Instagram Account ID:', instagramAccountId);

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

    const posts = (data.data || []).map((post: InstagramPost) => ({
        id: post.id,
        content: post.caption || 'Bài viết không có caption',
        imageUrl: post.media_url || '',
        createdAt: post.timestamp,
        likesCount: post.like_count || 0,
        commentsCount: post.comments_count || 0,
        mediaType: post.media_type
    }));

    return res.status(200).json({
        posts,
        platform: 'instagram',
        instagramAccountId,
        debug: { totalFetched: data.data?.length || 0 }
    });
}
