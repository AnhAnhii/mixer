import { GoogleGenAI } from '@google/genai';

export async function analyzeProductAttachments(normalizedMessage, options = {}) {
  const attachments = normalizedMessage?.attachments || [];
  const imageAttachments = attachments.filter((attachment) => attachment?.type === 'image' && attachment?.payload?.url);

  if (!imageAttachments.length) {
    return {
      attempted: false,
      used_vision: false,
      summary: null,
      items: []
    };
  }

  const apiKey = options.geminiApiKey
    || process.env.GEMINI_API_KEY_2
    || process.env.GEMINI_API_KEY_3
    || process.env.GEMINI_API_KEY
    || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return {
      attempted: false,
      used_vision: false,
      summary: 'Khách có gửi ảnh sản phẩm nhưng hệ thống chưa có vision key để mô tả ảnh.',
      items: imageAttachments.map(toLightweightAttachmentInfo),
      reason: 'missing_gemini_api_key'
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
      'Bạn đang hỗ trợ phân tích ảnh sản phẩm khách gửi cho fanpage thời trang.',
      'Hãy mô tả ngắn gọn, thực dụng bằng tiếng Việt để phục vụ CSKH.',
      'Tập trung vào: loại sản phẩm, màu sắc, chi tiết nhận diện nổi bật, và nếu chưa chắc thì nói là chưa chắc.',
      'Không bịa mã sản phẩm, không khẳng định tồn kho, không suy đoán quá mức.',
      'Trả về JSON hợp lệ với keys: summary, likely_product_type, dominant_color, notable_details, confidence_note.'
    ].join('\n');

    const contents = [
      { text: prompt },
      ...imageAttachments.slice(0, 3).map((attachment) => ({
        inlineData: null,
        fileData: {
          fileUri: attachment.payload.url,
          mimeType: attachment.payload.mime_type || 'image/jpeg'
        }
      }))
    ];

    const response = await ai.models.generateContent({
      model: options.visionModel || process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
      contents
    });

    const rawText = response?.text || '{}';
    const parsed = safeParseJson(rawText);

    return {
      attempted: true,
      used_vision: true,
      model: options.visionModel || process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
      summary: parsed?.summary || null,
      likely_product_type: parsed?.likely_product_type || null,
      dominant_color: parsed?.dominant_color || null,
      notable_details: Array.isArray(parsed?.notable_details) ? parsed.notable_details : [],
      confidence_note: parsed?.confidence_note || null,
      items: imageAttachments.map(toLightweightAttachmentInfo)
    };
  } catch (error) {
    return {
      attempted: true,
      used_vision: false,
      summary: 'Khách có gửi ảnh sản phẩm nhưng vision analysis chưa chạy thành công.',
      items: imageAttachments.map(toLightweightAttachmentInfo),
      reason: String(error.message || error)
    };
  }
}

function toLightweightAttachmentInfo(attachment) {
  return {
    type: attachment?.type || null,
    url: attachment?.payload?.url || null,
    mime_type: attachment?.payload?.mime_type || null
  };
}

function safeParseJson(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(rawText.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
