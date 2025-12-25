// api/webhook/facebook.ts
// Facebook Messenger Webhook Handler với AI Auto-Reply

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment Variables
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'mixer_verify_token_2024';
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Auto-reply settings (có thể chuyển sang database sau)
let AUTO_REPLY_ENABLED = process.env.AI_AUTO_REPLY === 'true';

// Training data cache (trong thực tế nên lưu database)
let trainingDataCache: Array<{ customerMessage: string; employeeResponse: string }> = [];

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

    console.log('📨 Webhook event received');

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
    }

    // Facebook requires 200 response within 20 seconds
    return res.status(200).json({ status: 'EVENT_RECEIVED' });
}

// ==================== AI MESSAGE HANDLER ====================

async function handleMessage(event: MessagingEvent) {
    const senderId = event.sender.id;
    const messageText = event.message?.text || '';

    console.log(`💬 New message from ${senderId}: ${messageText}`);

    // Bỏ qua tin nhắn trống hoặc chỉ có attachments
    if (!messageText.trim()) {
        console.log('⏭️ Empty message, skipping AI response');
        return;
    }

    // Kiểm tra xem có bật auto-reply không
    if (!AUTO_REPLY_ENABLED) {
        console.log('⏸️ Auto-reply is disabled');
        return;
    }

    // Kiểm tra xem có Gemini API key không
    if (!GEMINI_API_KEY) {
        console.log('⚠️ Gemini API key not configured, using fallback');
        await sendFallbackResponse(senderId, messageText);
        return;
    }

    try {
        // Gọi AI để tạo response
        const aiResponse = await generateAIResponse(messageText);

        if (aiResponse.shouldHandoff) {
            console.log('🔀 AI suggests handoff to human');
            await sendMessage(senderId, 'Dạ bạn chờ mình xíu, nhân viên sẽ hỗ trợ bạn ngay ạ! 🙏');
            return;
        }

        if (aiResponse.confidence < 0.5) {
            console.log(`⚠️ Low confidence (${aiResponse.confidence}), skipping auto-reply`);
            return;
        }

        // Gửi response
        await sendMessage(senderId, aiResponse.message);
        console.log(`🤖 AI replied: ${aiResponse.message.substring(0, 50)}...`);

    } catch (error) {
        console.error('❌ AI processing error:', error);
    }
}

// ==================== AI RESPONSE GENERATOR ====================

async function generateAIResponse(customerMessage: string): Promise<{
    message: string;
    confidence: number;
    shouldHandoff: boolean;
}> {
    // Dynamic import để tránh lỗi module
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });

    // Build training examples
    const examples = trainingDataCache
        .slice(0, 8)
        .map(p => `Khách: "${p.customerMessage}"\nShop: "${p.employeeResponse}"`)
        .join('\n\n');

    const prompt = `Bạn là nhân viên shop MIXER trên Facebook.

📌 CÁCH TRẢ LỜI (học từ ví dụ):
${examples || `Khách: "còn hàng k"
Shop: "Dạ bên mình còn nha bạn ơi! Bạn cần size gì ạ? ♥"

Khách: "ship bao lâu"
Shop: "Dạ ship 2-4 ngày tùy khu vực bạn nhé! ♥"

Khách: "giá bao nhiêu"
Shop: "Dạ bạn cho mình biết sản phẩm cụ thể để mình báo giá nhé ạ! 😊"`}

📌 QUY TẮC:
- Trả lời NGẮN (1-3 câu), thân thiện
- Dùng "mình/bạn" hoặc "em/anh/chị"
- Thêm 1-2 emoji (♥ 😊 🙏)
- Không hiểu → hỏi lại lịch sự
- Phàn nàn/đổi trả/khiếu nại → bắt đầu với "[HANDOFF]"
- KHÔNG nói về chính trị, tôn giáo

📌 TỪ VIẾT TẮT:
ib=inbox, sz=size, đt=điện thoại, ship=giao hàng, cod=thanh toán khi nhận, ck=chuyển khoản, k/ko=không

📌 THÔNG TIN SHOP:
- Tên: MIXER - Quần áo thời trang
- Ship: 2-4 ngày
- Thanh toán: COD/Chuyển khoản

📌 KHÁCH HỎI: "${customerMessage}"

Trả lời ngắn gọn:`;

    const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt
    });

    const responseText = (response.text || '').trim();

    // Phân tích response
    const shouldHandoff = responseText.startsWith('[HANDOFF]');
    const message = responseText.replace('[HANDOFF]', '').trim();

    // Tính confidence
    let confidence = 0.8;
    if (message.length < 10) confidence -= 0.2;
    if (message.length > 300) confidence -= 0.1;
    if (/không biết|không rõ|chờ.*kiểm tra/i.test(message)) confidence -= 0.2;

    return {
        message,
        confidence: Math.max(0.1, confidence),
        shouldHandoff
    };
}

// ==================== FALLBACK RESPONSE ====================

async function sendFallbackResponse(senderId: string, messageText: string) {
    const lowerText = messageText.toLowerCase();

    if (/chào|hello|hi|hey/.test(lowerText)) {
        await sendMessage(senderId, 'Chào bạn! 👋 Cảm ơn bạn đã liên hệ với shop. Mình sẽ phản hồi sớm nhất có thể ạ! 🛍️');
    } else if (/giá|bao nhiêu|bn/.test(lowerText)) {
        await sendMessage(senderId, 'Dạ bạn cho mình biết sản phẩm cụ thể để mình báo giá nhé ạ! 💰');
    } else if (/size|màu|còn/.test(lowerText)) {
        await sendMessage(senderId, 'Dạ bạn cho mình biết chiều cao cân nặng để tư vấn size phù hợp nhé! 📏');
    }
}

// ==================== POSTBACK HANDLER ====================

async function handlePostback(event: MessagingEvent) {
    const senderId = event.sender.id;
    const payload = event.postback?.payload || '';

    console.log(`🔘 Postback from ${senderId}: ${payload}`);

    switch (payload) {
        case 'GET_STARTED':
            await sendMessage(
                senderId,
                'Chào mừng bạn đến với shop! 🎉\n\nBạn có thể nhắn tin để hỏi về:\n• Sản phẩm & giá cả\n• Size & màu sắc\n• Ship & thanh toán\n\nMình sẽ phản hồi sớm nhất có thể ạ!'
            );
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
        return true;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

// ==================== UTILITY FUNCTIONS ====================

// Update training data cache (gọi từ UI)
export function updateTrainingData(data: Array<{ customerMessage: string; employeeResponse: string }>) {
    trainingDataCache = data;
    console.log(`📚 Training data updated: ${data.length} pairs`);
}

// Toggle auto-reply
export function setAutoReplyEnabled(enabled: boolean) {
    AUTO_REPLY_ENABLED = enabled;
    console.log(`🤖 Auto-reply ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

// Lấy thông tin user profile
export async function getUserProfile(userId: string): Promise<{
    first_name?: string;
    last_name?: string;
    profile_pic?: string;
} | null> {
    if (!PAGE_ACCESS_TOKEN) return null;

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
