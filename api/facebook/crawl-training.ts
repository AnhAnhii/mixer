// api/facebook/crawl-training.ts
// API endpoint để crawl conversation history và extract training pairs

import type { VercelRequest, VercelResponse } from '@vercel/node';

const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID || '105265398928721';

interface TrainingPair {
    id: string;
    customerMessage: string;
    employeeResponse: string;
    context?: string;
    category?: 'greeting' | 'product' | 'order' | 'shipping' | 'payment' | 'other';
    createdAt: string;
}

interface Message {
    id: string;
    message?: string;
    from: { id: string; name: string };
    created_time: string;
}

// Phân loại câu hỏi
const categorizeMessage = (message: string): TrainingPair['category'] => {
    const lower = message.toLowerCase();

    if (/chào|hello|hi|xin chào|alo/.test(lower)) return 'greeting';
    if (/ship|giao|vận chuyển|bao lâu|mấy ngày/.test(lower)) return 'shipping';
    if (/giá|bao nhiêu|tiền|vnđ|vnd|đồng|k\b|tr\b/.test(lower)) return 'product';
    if (/đơn|order|mua|đặt|check|tracking/.test(lower)) return 'order';
    if (/thanh toán|chuyển khoản|ck|cod|stk|bank/.test(lower)) return 'payment';
    if (/size|màu|còn|hết|stock|có không/.test(lower)) return 'product';

    return 'other';
};

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

    const limit = parseInt(req.query.limit as string) || 50; // Số conversation tối đa

    try {
        // 1. Lấy danh sách conversation
        const convoResponse = await fetch(
            `${FB_GRAPH_URL}/${PAGE_ID}/conversations?fields=id,participants,updated_time&limit=${limit}&access_token=${PAGE_ACCESS_TOKEN}`
        );
        const convoData = await convoResponse.json();

        if (convoData.error) {
            return res.status(400).json({ error: convoData.error.message });
        }

        const trainingPairs: TrainingPair[] = [];
        const conversations = convoData.data || [];

        // 2. Với mỗi conversation, lấy messages và extract training pairs
        for (const conv of conversations) {
            try {
                const msgResponse = await fetch(
                    `${FB_GRAPH_URL}/${conv.id}/messages?fields=id,message,from,created_time&limit=50&access_token=${PAGE_ACCESS_TOKEN}`
                );
                const msgData = await msgResponse.json();

                if (msgData.error) continue;

                const messages: Message[] = msgData.data || [];

                // Messages được sắp xếp từ mới đến cũ, cần đảo ngược
                messages.reverse();

                // 3. Extract training pairs (khách hỏi → nhân viên trả lời)
                for (let i = 0; i < messages.length - 1; i++) {
                    const current = messages[i];
                    const next = messages[i + 1];

                    // Nếu current là từ khách và next là từ Page
                    if (current.from.id !== PAGE_ID && next.from.id === PAGE_ID) {
                        if (current.message && next.message) {
                            // Lấy context (tin nhắn trước đó nếu có)
                            let context = '';
                            if (i > 0 && messages[i - 1].message) {
                                context = messages[i - 1].message || '';
                            }

                            trainingPairs.push({
                                id: `${current.id}_${next.id}`,
                                customerMessage: current.message,
                                employeeResponse: next.message,
                                context: context || undefined,
                                category: categorizeMessage(current.message),
                                createdAt: current.created_time
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing conversation ${conv.id}:`, error);
                continue;
            }
        }

        // 4. Thống kê
        const stats = {
            totalConversations: conversations.length,
            totalPairs: trainingPairs.length,
            byCategory: {
                greeting: trainingPairs.filter(p => p.category === 'greeting').length,
                product: trainingPairs.filter(p => p.category === 'product').length,
                order: trainingPairs.filter(p => p.category === 'order').length,
                shipping: trainingPairs.filter(p => p.category === 'shipping').length,
                payment: trainingPairs.filter(p => p.category === 'payment').length,
                other: trainingPairs.filter(p => p.category === 'other').length,
            }
        };

        return res.status(200).json({
            success: true,
            stats,
            trainingPairs
        });

    } catch (error) {
        console.error('Error crawling training data:', error);
        return res.status(500).json({ error: 'Failed to crawl training data' });
    }
}
