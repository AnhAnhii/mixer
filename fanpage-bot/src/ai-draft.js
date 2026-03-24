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
    'Nhiệm vụ: viết draft trả lời khách hàng theo đúng policy, không bịa.',
    'Chỉ trả về JSON hợp lệ với các khóa: reply_text, action, confidence, needs_human, missing_info, reason, policy_refs, safety_flags.',
    '',
    JSON.stringify(input, null, 2)
  ].join('\n');
}
