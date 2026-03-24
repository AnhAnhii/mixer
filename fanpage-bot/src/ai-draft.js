import { buildFallbackDraft } from './fallback-draft.js';

export async function generateDraft(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('__OPENCL') || apiKey.toLowerCase().includes('redacted')) {
    return {
      draft: buildFallbackDraft({
        case_type: input.triage.case_type_hint,
        missing_info: input.triage.missing_info_hint
      }),
      meta: { provider: 'fallback', used_fallback: true, reason: 'missing_openai_api_key' }
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const prompt = buildPrompt(input);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: { format: { type: 'json_object' } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`openai_http_${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const raw = payload.output_text || payload.output?.map((item) => item?.content?.map((c) => c.text || '').join('')).join('') || '{}';
    const parsed = JSON.parse(raw);

    return {
      draft: parsed,
      meta: { provider: 'openai', model, used_fallback: false }
    };
  } catch (error) {
    return {
      draft: buildFallbackDraft({
        case_type: input.triage.case_type_hint,
        missing_info: input.triage.missing_info_hint
      }),
      meta: { provider: 'fallback', used_fallback: true, reason: String(error) }
    };
  }
}

function buildPrompt(input) {
  return [
    'Bạn là trợ lý inbox Facebook Fanpage của Mixer.',
    'Mục tiêu: tự suy nghĩ để viết draft trả lời tự nhiên, hữu ích, đúng ngữ cảnh thật của khách; không chỉ lặp lại case_type_hint một cách máy móc.',
    'case_type_hint, risk_level_hint và missing_info_hint chỉ là gợi ý để tham khảo, không phải mệnh lệnh tuyệt đối. Hãy đọc kỹ latest_customer_message và recent_messages để tự suy luận.',
    'Ưu tiên giọng văn CSKH của Mixer: lịch sự, trẻ, rõ ràng, không cứng, không quá robot.',
    'Xưng hô ưu tiên: gọi khách là "bạn"; tự xưng là "mình" hoặc "Mixer". Tránh xưng hô bị ngược vai như "em" khi không cần.',
    'Không bịa chính sách, không bịa trạng thái đơn, không bịa tồn kho, không bịa thông tin nội bộ.',
    'Nếu cần dữ liệu nội bộ hoặc còn thiếu thông tin quan trọng thì phải needs_human=true, action=handoff hoặc draft_only tùy mức độ, và liệt kê missing_info rõ ràng.',
    'Nếu câu hỏi đơn giản, low-risk, đã có grounding rõ thì có thể trả lời ngắn gọn, thân thiện, sát câu hỏi của khách.',
    'Chỉ trả về JSON hợp lệ với các khóa: reply_text, action, confidence, needs_human, missing_info, reason, policy_refs, safety_flags.',
    'reply_text phải là câu hoàn chỉnh, tự nhiên, thực sự có thể gửi cho khách nếu cần.',
    '',
    JSON.stringify(input, null, 2)
  ].join('\n');
}
