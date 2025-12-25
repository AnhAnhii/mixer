// services/aiChatService.ts
// AI Chat Service với Gemini - Xử lý tin nhắn và tạo response

import { GoogleGenerativeAI } from '@google/genai';

interface TrainingPair {
    customerMessage: string;
    employeeResponse: string;
    context?: string;
    category?: string;
}

interface Product {
    id: string;
    name: string;
    price: number;
    sizes?: string[];
    colors?: string[];
    stock: number;
}

interface ChatContext {
    conversationHistory: Array<{ role: 'customer' | 'employee'; message: string }>;
    customerName?: string;
    customerOrders?: any[];
}

interface AIResponse {
    message: string;
    confidence: number; // 0-1
    shouldHandoff: boolean; // Nên chuyển nhân viên không
    suggestedProducts?: string[];
}

// Singleton Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

const getGeminiClient = () => {
    if (!geminiClient) {
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }
        geminiClient = new GoogleGenerativeAI(apiKey);
    }
    return geminiClient;
};

// Tạo prompt với training examples
const buildPrompt = (
    customerMessage: string,
    trainingPairs: TrainingPair[],
    products: Product[],
    context: ChatContext
): string => {
    // Chọn 5-10 training examples phù hợp nhất
    const relevantExamples = trainingPairs
        .slice(0, 10)
        .map(pair => `Khách: "${pair.customerMessage}"\nNhân viên: "${pair.employeeResponse}"`)
        .join('\n\n');

    // Product list ngắn gọn
    const productList = products
        .slice(0, 20)
        .map(p => `- ${p.name}: ${p.price.toLocaleString('vi-VN')}đ ${p.stock > 0 ? '(còn hàng)' : '(hết hàng)'}`)
        .join('\n');

    // Conversation history
    const history = context.conversationHistory
        .slice(-5)
        .map(h => `${h.role === 'customer' ? 'Khách' : 'Shop'}: ${h.message}`)
        .join('\n');

    return `Bạn là nhân viên tư vấn của shop quần áo MIXER trên Facebook Messenger.

═══════════════════════════════════════════════════════
📌 PHONG CÁCH TRẢ LỜI (HỌC TỪ CÁC VÍ DỤ THỰC TẾ):
═══════════════════════════════════════════════════════
${relevantExamples}

═══════════════════════════════════════════════════════
📌 QUY TẮC QUAN TRỌNG:
═══════════════════════════════════════════════════════
1. Trả lời NGẮN GỌN (1-3 câu), thân thiện
2. Dùng "mình/bạn" hoặc "em/anh/chị" tùy ngữ cảnh
3. Thêm 1-2 emoji phù hợp (♥ 😊 🙏)
4. Nếu không hiểu → hỏi lại lịch sự
5. Nếu khách hỏi giá/size → tra cứu sản phẩm và trả lời
6. Nếu khách phàn nàn hoặc yêu cầu đổi trả → chuyển nhân viên
7. KHÔNG trả lời về chính trị, tôn giáo, các chủ đề nhạy cảm

═══════════════════════════════════════════════════════
📌 TỪ VIẾT TẮT THƯỜNG GẶP:
═══════════════════════════════════════════════════════
ib = inbox | sz = size | đt = điện thoại | sđt = số điện thoại
ship = giao hàng | cod = thanh toán khi nhận | ck = chuyển khoản
check = kiểm tra | tk = tài khoản | add = địa chỉ
k/ko/kg = không | đc = được | vs = với | nx = nữa | j = gì

═══════════════════════════════════════════════════════
📌 THÔNG TIN SHOP:
═══════════════════════════════════════════════════════
- Tên shop: MIXER
- Bán: Quần áo thời trang
- Ship: 2-4 ngày tùy khu vực
- Thanh toán: COD hoặc chuyển khoản
- Giờ làm việc: 8h-22h hàng ngày

═══════════════════════════════════════════════════════
📌 SẢN PHẨM HIỆN CÓ:
═══════════════════════════════════════════════════════
${productList}

═══════════════════════════════════════════════════════
📌 LỊCH SỬ CUỘC TRÒ CHUYỆN:
═══════════════════════════════════════════════════════
${history || '(Cuộc trò chuyện mới)'}

═══════════════════════════════════════════════════════
📌 TIN NHẮN KHÁCH VỪA GỬI:
═══════════════════════════════════════════════════════
"${customerMessage}"

═══════════════════════════════════════════════════════
📌 YÊU CẦU:
═══════════════════════════════════════════════════════
Trả lời tin nhắn của khách theo phong cách ở trên.
Nếu cần chuyển nhân viên, bắt đầu với "[HANDOFF]".
Chỉ trả lời NỘI DUNG tin nhắn, không giải thích thêm.`;
};

// Phân tích response và xác định confidence
const analyzeResponse = (response: string): { message: string; confidence: number; shouldHandoff: boolean } => {
    const shouldHandoff = response.startsWith('[HANDOFF]');
    const message = response.replace('[HANDOFF]', '').trim();

    // Tính confidence dựa trên các yếu tố
    let confidence = 0.8;

    // Giảm confidence nếu response quá ngắn hoặc quá dài
    if (message.length < 10) confidence -= 0.2;
    if (message.length > 500) confidence -= 0.1;

    // Giảm confidence nếu có dấu hiệu không chắc chắn
    if (/không biết|không rõ|để.*hỏi|chờ.*kiểm tra/i.test(message)) {
        confidence -= 0.2;
    }

    // Tăng confidence nếu response giống với training examples
    // (simplified - trong thực tế có thể dùng semantic similarity)

    return {
        message,
        confidence: Math.max(0, Math.min(1, confidence)),
        shouldHandoff
    };
};

// Main function: Generate AI response
export const generateAIResponse = async (
    customerMessage: string,
    trainingPairs: TrainingPair[],
    products: Product[],
    context: ChatContext
): Promise<AIResponse> => {
    try {
        const client = getGeminiClient();
        const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = buildPrompt(customerMessage, trainingPairs, products, context);

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        const analysis = analyzeResponse(responseText);

        return {
            message: analysis.message,
            confidence: analysis.confidence,
            shouldHandoff: analysis.shouldHandoff,
        };

    } catch (error) {
        console.error('AI Chat Service Error:', error);

        // Fallback response
        return {
            message: 'Dạ mình xin lỗi, hiện tại hệ thống đang bận. Bạn vui lòng chờ nhân viên hỗ trợ nhé! 🙏',
            confidence: 0,
            shouldHandoff: true
        };
    }
};

// Export for testing
export const buildPromptForTesting = buildPrompt;
