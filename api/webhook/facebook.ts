// api/webhook/facebook.ts
// Facebook Messenger Webhook Handler for Vercel

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment Variables
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'mixer_verify_token_2024';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

// ==================== TYPES ====================

interface MessagingEvent {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
            type: string;
            payload: { url: string };
        }>;
    };
    postback?: {
        title: string;
        payload: string;
    };
}

interface WebhookEntry {
    id: string;
    time: number;
    messaging: MessagingEvent[];
}

interface WebhookBody {
    object: string;
    entry: WebhookEntry[];
}

// ==================== MAIN HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`📥 ${req.method} /api/webhook/facebook`);

    // GET request = Facebook verification
    if (req.method === 'GET') {
        return handleVerification(req, res);
    }

    // POST request = Actual webhook events
    if (req.method === 'POST') {
        return handleWebhookEvent(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// ==================== VERIFICATION ====================

function handleVerification(req: VercelRequest, res: VercelResponse) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('🔐 Verification request received');
    console.log('   Mode:', mode);
    console.log('   Token:', token);
    console.log('   Expected Token:', VERIFY_TOKEN);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully!');
        return res.status(200).send(challenge);
    }

    console.log('❌ Verification failed - token mismatch');
    return res.status(403).json({ error: 'Verification failed' });
}

// ==================== WEBHOOK EVENTS ====================

async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
    const body = req.body as WebhookBody;

    console.log('📨 Webhook event received:');
    console.log(JSON.stringify(body, null, 2));

    // Validate event type
    if (body.object !== 'page') {
        console.log('⚠️ Not a page event, ignoring');
        return res.status(404).json({ error: 'Not a page event' });
    }

    // Process each entry
    try {
        for (const entry of body.entry) {
            for (const event of entry.messaging) {
                if (event.message) {
                    await handleMessage(event);
                } else if (event.postback) {
                    await handlePostback(event);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        // Still return 200 to acknowledge receipt
    }

    // Facebook requires 200 response within 20 seconds
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
}

// ==================== MESSAGE HANDLER ====================

async function handleMessage(event: MessagingEvent) {
    const senderId = event.sender.id;
    const messageText = event.message?.text || '';
    const timestamp = new Date(event.timestamp).toISOString();

    console.log(`💬 New message`);
    console.log(`   From: ${senderId}`);
    console.log(`   Text: ${messageText}`);
    console.log(`   Time: ${timestamp}`);

    // TODO: Lưu tin nhắn vào database
    // await saveMessage({
    //   senderId,
    //   text: messageText,
    //   timestamp,
    //   direction: 'incoming'
    // });

    // Auto-reply cho một số keywords
    const lowerText = messageText.toLowerCase();

    if (lowerText.includes('xin chào') || lowerText.includes('hello') || lowerText.includes('hi')) {
        await sendMessage(
            senderId,
            'Chào bạn! 👋 Cảm ơn bạn đã liên hệ với shop. Mình sẽ phản hồi sớm nhất có thể ạ! 🛍️'
        );
    } else if (lowerText.includes('giá') || lowerText.includes('bao nhiêu')) {
        await sendMessage(
            senderId,
            'Dạ bạn có thể cho mình biết bạn quan tâm đến sản phẩm nào không ạ? Mình sẽ gửi báo giá chi tiết cho bạn nhé! 💰'
        );
    } else if (lowerText.includes('size') || lowerText.includes('màu')) {
        await sendMessage(
            senderId,
            'Dạ mình cần biết chiều cao và cân nặng của bạn để tư vấn size phù hợp nhất ạ! 📏'
        );
    }

    // Gửi thông báo đến admin (TODO: Implement push notification hoặc email)
    // await notifyAdmin(senderId, messageText);
}

// ==================== POSTBACK HANDLER ====================

async function handlePostback(event: MessagingEvent) {
    const senderId = event.sender.id;
    const payload = event.postback?.payload || '';

    console.log(`🔘 Postback received`);
    console.log(`   From: ${senderId}`);
    console.log(`   Payload: ${payload}`);

    // Handle different button payloads
    switch (payload) {
        case 'GET_STARTED':
            await sendMessage(
                senderId,
                'Chào mừng bạn đến với shop! 🎉\n\nBạn có thể nhắn tin để hỏi về:\n• Sản phẩm & giá cả\n• Size & màu sắc\n• Chính sách đổi trả\n\nMình sẽ phản hồi sớm nhất có thể ạ!'
            );
            break;

        case 'VIEW_PRODUCTS':
            await sendMessage(senderId, 'Dạ bạn muốn xem sản phẩm loại nào ạ? Áo, quần, hay phụ kiện?');
            break;

        default:
            console.log(`⚠️ Unknown postback: ${payload}`);
    }
}

// ==================== SEND MESSAGE ====================

async function sendMessage(recipientId: string, messageText: string): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN) {
        console.error('❌ PAGE_ACCESS_TOKEN is not configured');
        return false;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: messageText },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const result = await response.json();

        if (result.error) {
            console.error('❌ Facebook API error:', result.error);
            return false;
        }

        console.log('📤 Message sent successfully');
        console.log(`   Recipient: ${recipientId}`);
        console.log(`   Message ID: ${result.message_id}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Gửi tin nhắn với template (buttons, images, etc.)
export async function sendTemplateMessage(
    recipientId: string,
    template: {
        type: 'button' | 'generic' | 'media';
        payload: object;
    }
): Promise<boolean> {
    if (!PAGE_ACCESS_TOKEN) {
        console.error('❌ PAGE_ACCESS_TOKEN is not configured');
        return false;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'template',
                            payload: template.payload,
                        },
                    },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const result = await response.json();
        return !result.error;
    } catch (error) {
        console.error('❌ Error sending template:', error);
        return false;
    }
}

// Lấy thông tin user profile
export async function getUserProfile(userId: string): Promise<{
    first_name?: string;
    last_name?: string;
    profile_pic?: string;
} | null> {
    if (!PAGE_ACCESS_TOKEN) {
        return null;
    }

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${userId}?fields=first_name,last_name,profile_pic&access_token=${PAGE_ACCESS_TOKEN}`
        );
        return await response.json();
    } catch (error) {
        console.error('❌ Error fetching user profile:', error);
        return null;
    }
}
