// api/ai/chat.ts
// API endpoint để gọi AI xử lý tin nhắn

import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

interface TrainingPair {
    customerMessage: string;
    employeeResponse: string;
}

interface ChatRequest {
    message: string;
    conversationHistory?: Array<{ role: 'customer' | 'employee'; message: string }>;
    trainingPairs?: TrainingPair[];
    products?: any[];
}

// Build prompt với training examples
const buildPrompt = (
    customerMessage: string,
    trainingPairs: TrainingPair[],
    products: any[],
    history: Array<{ role: string; message: string }>
): string => {
    const examples = trainingPairs
        .slice(0, 8)
        .map(p => `Khách: "${p.customerMessage}"\nShop: "${p.employeeResponse}"`)
        .join('\n\n');

    const productInfo = products
        .slice(0, 15)
        .map(p => `- ${p.name}: ${p.price?.toLocaleString('vi-VN') || '?'}đ`)
        .join('\n');

    const historyText = history
        .slice(-5)
        .map(h => `${h.role === 'customer' ? 'Khách' : 'Shop'}: ${h.message}`)
        .join('\n');

    return `Bạn là nhân viên Gen Z của shop thời trang MIXER trên Facebook Messenger.

📌 PHONG CÁCH (BẮT BUỘC):
- Nói chuyện như BẠN BÈ, ko phải robot
- Ngắn gọn 1-2 câu. KHÔNG dài dòng
- KHÔNG luôn bắt đầu bằng "Dạ" — xen kẽ: "Oke", "Có nha", "Được luôn", "Nè bạn"
- Kéo dài chữ tự nhiên: "nhaaa", "nhaa", "nè", "lắmmm"
- Emoji 1-2 cái thôi: ♥ 😊 🔥 ✨
- Viết tắt ok: ko, đc, r, sz, ib, oke, nha, hen
- Đôi khi trả lời CỤT: "Còn nha!", "Size gì bạn?"

📌 VÍ DỤ:
${examples || 'Trả lời thân thiện, kiểu Gen Z.'}

📌 SẢN PHẨM:
${productInfo || '(Đang cập nhật)'}

📌 LỊCH SỬ:
${historyText || '(Mới)'}

📌 QUY TẮC CỨNG:
- Phàn nàn nặng → "[HANDOFF]"
- Ko biết chắc → "Để mình check r rep nhaa"

📌 KHÁCH NHẮN: "${customerMessage}"

Trả lời (1-2 câu, giọng Gen Z):`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const { message, conversationHistory = [], trainingPairs = [], products = [] } = req.body as ChatRequest;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Dynamic import để tránh lỗi module
        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        const prompt = buildPrompt(message, trainingPairs, products, conversationHistory);

        const response = await client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });

        const responseText = response.text || '';

        // Check for handoff signal
        const shouldHandoff = responseText.includes('[HANDOFF]');
        const cleanResponse = responseText.replace('[HANDOFF]', '').trim();

        // Calculate confidence
        let confidence = 0.85;
        if (cleanResponse.length < 10) confidence -= 0.2;
        if (/không biết|không rõ|chờ/i.test(cleanResponse)) confidence -= 0.2;

        return res.status(200).json({
            success: true,
            response: cleanResponse,
            confidence: Math.max(0.1, confidence),
            shouldHandoff
        });

    } catch (error) {
        console.error('AI Chat Error:', error);
        return res.status(500).json({
            success: false,
            error: 'AI processing failed',
            response: 'Dạ bạn chờ mình xíu, nhân viên sẽ hỗ trợ ngay ạ! 🙏',
            shouldHandoff: true
        });
    }
}
