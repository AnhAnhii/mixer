// api/facebook/posts.ts
// API endpoint to fetch Facebook Page posts

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
    attachments?: { data: FacebookAttachment[] };
    created_time: string;
    reactions?: { summary: { total_count: number } };
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

        // Fetch posts from Facebook Graph API v21.0
        // Using attachments instead of full_picture (deprecated)
        // Using reactions instead of likes (deprecated)
        const url = `https://graph.facebook.com/v21.0/${PAGE_ID}/feed?` +
            `fields=id,message,attachments{media,subattachments},created_time,reactions.summary(true),comments.summary(true)` +
            `&limit=${limit}` +
            `&access_token=${PAGE_ACCESS_TOKEN}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('❌ Facebook API error:', data.error);
            return res.status(400).json({ error: data.error.message });
        }

        console.log('📊 Facebook returned', data.data?.length || 0, 'posts');

        // Helper function to extract image URL from attachments
        const getImageUrl = (post: FacebookPost): string | null => {
            const attachments = post.attachments?.data;
            if (!attachments || attachments.length === 0) return null;

            // Lấy ảnh từ attachment đầu tiên
            const firstAttachment = attachments[0];
            if (firstAttachment.media?.image?.src) {
                return firstAttachment.media.image.src;
            }

            // Nếu có subattachments (album), lấy ảnh đầu tiên
            if (firstAttachment.subattachments?.data?.[0]?.media?.image?.src) {
                return firstAttachment.subattachments.data[0].media.image.src;
            }

            return null;
        };

        // Transform to frontend format
        const posts = (data.data || [])
            .map((post: FacebookPost) => {
                const imageUrl = getImageUrl(post);
                return {
                    id: post.id,
                    content: post.message || 'Bài viết không có nội dung text',
                    imageUrl: imageUrl || '',
                    createdAt: post.created_time,
                    likesCount: post.reactions?.summary?.total_count || 0,
                    commentsCount: post.comments?.summary?.total_count || 0
                };
            })
            .filter((post: any) => post.imageUrl); // Chỉ lấy bài có ảnh

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
