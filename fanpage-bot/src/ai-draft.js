import { buildFallbackDraft } from './fallback-draft.js';
import { normalizeCaseType, normalizeDraftAction } from './types.js';

export async function generateDraft(input, options = {}) {
  const fallbackDraft = normalizeDraftContract(
    buildFallbackDraft({
      triage: {
        case_type_hint: input?.triage_hint?.case_type || input?.triage?.case_type_hint,
        missing_info_hint: input?.triage_hint?.missing_info || input?.triage?.missing_info_hint || []
      },
      grounding: input?.grounding_bundle?.grounding || input?.grounding || {},
      thread_memory: input?.grounding_bundle?.customer_context?.thread_memory || input?.thread_memory || null,
      latest_customer_message: input?.message?.text || input?.latest_customer_message,
      reasoning_summary: buildFallbackReasoningSummary(input)
    }),
    input
  );

  const apiKey = process.env.OPENAI_API_KEY;
  const hasMockOpenAIResponse = Object.prototype.hasOwnProperty.call(options, 'mockOpenAIResponse');
  if (!hasMockOpenAIResponse && (!apiKey || apiKey.includes('__OPENCL') || apiKey.toLowerCase().includes('redacted'))) {
    return {
      draft: fallbackDraft,
      meta: { provider: 'fallback', source: 'fallback', used_fallback: true, reason: 'missing_openai_api_key', validation: fallbackDraft.contract_meta }
    };
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const prompt = buildPrompt(input);

  try {
    const payload = options.mockOpenAIResponse ?? await fetchOpenAIResponse({ apiKey, model, prompt });
    const raw = extractResponseText(payload);
    const parsed = JSON.parse(raw);
    const normalizedDraft = normalizeDraftContract(parsed, input, fallbackDraft);

    return {
      draft: normalizedDraft,
      meta: {
        provider: 'openai',
        source: 'openai',
        model,
        used_fallback: false,
        raw_response_present: Boolean(raw?.trim()),
        validation: normalizedDraft.contract_meta
      }
    };
  } catch (error) {
    return {
      draft: fallbackDraft,
      meta: { provider: 'fallback', source: 'fallback', used_fallback: true, reason: String(error), validation: fallbackDraft.contract_meta }
    };
  }
}

async function fetchOpenAIResponse({ apiKey, model, prompt }) {
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

  return response.json();
}

function buildPrompt(input) {
  return [
    'Bạn là trợ lý inbox Facebook Fanpage của Mixer.',
    'Flow bắt buộc: đọc triage_hint -> đọc grounding_bundle -> suy luận ngắn gọn -> tạo draft trả lời khách.',
    'Không bịa thông tin ngoài grounding_bundle. Nếu thiếu dữ liệu hoặc có rủi ro thì needs_human=true và action=handoff.',
    'Nếu grounding_bundle có sales_assist thì chỉ dùng nó như hint về buyer intent/ưu tiên tư vấn; tuyệt đối không biến các hint đó thành claim về giá, tồn kho, sản phẩm hay khuyến mãi.',
    'Chỉ trả về JSON hợp lệ.',
    'Ưu tiên contract reasoning-first với các khóa: understanding, decision, reply, ops_meta.',
    'Trong đó tối thiểu phải có: understanding.intent, understanding.sentiment, understanding.missing_info, decision.action, decision.strategy, decision.reason, reply.reply_text, ops_meta.needs_human, ops_meta.confidence, ops_meta.policy_refs, ops_meta.safety_flags.',
    'Để tương thích pipeline hiện tại, hãy mirror lại thêm các khóa top-level: reply_text, action, confidence, needs_human, missing_info, reason, policy_refs, safety_flags.',
    'Nếu có reasoning_summary thì phải ngắn, an toàn, không lộ chain-of-thought chi tiết.',
    '',
    JSON.stringify(input, null, 2)
  ].join('\n');
}

export function normalizeDraftContract(parsed = {}, input = {}, fallbackDraft = null) {
  const triageHint = input?.triage_hint || {};
  const base = fallbackDraft || {};
  const contractIssues = [];
  const source = isPlainObject(parsed) ? parsed : {};
  if (!isPlainObject(parsed)) {
    contractIssues.push('draft_not_plain_object');
  }

  const understanding = isPlainObject(source.understanding) ? source.understanding : {};
  const decision = isPlainObject(source.decision) ? source.decision : {};
  const reply = isPlainObject(source.reply) ? source.reply : {};
  const opsMeta = isPlainObject(source.ops_meta) ? source.ops_meta : {};

  const fallbackIntent = normalizeCaseType(base.understanding?.intent || triageHint.case_type || 'unknown');
  const intent = normalizeCaseType(
    pickFirstString(understanding.intent, source.intent, base.understanding?.intent, triageHint.case_type, 'unknown'),
    fallbackIntent
  );
  if (intent !== normalizeCaseType(pickFirstString(understanding.intent, source.intent, intent), intent)) {
    contractIssues.push('intent_normalized_to_known_case');
  }

  const initialActionCandidate = pickFirstString(source.action, decision.action, base.action, base.decision?.action, 'handoff');
  const action = normalizeDraftAction(initialActionCandidate, normalizeDraftAction(base.action || base.decision?.action || 'handoff'));
  if (action !== normalizeDraftAction(initialActionCandidate, action)) {
    contractIssues.push('action_normalized_to_allowed_value');
  }

  const normalizedMissingInfo = normalizeArray(source.missing_info ?? understanding.missing_info ?? base.missing_info ?? triageHint.missing_info ?? []);
  const normalizedPolicyRefs = normalizeArray(source.policy_refs ?? opsMeta.policy_refs ?? base.policy_refs ?? base.ops_meta?.policy_refs ?? []);
  const normalizedSafetyFlags = normalizeArray(source.safety_flags ?? opsMeta.safety_flags ?? base.safety_flags ?? base.ops_meta?.safety_flags ?? []);

  let needsHuman = normalizeBoolean(source.needs_human ?? opsMeta.needs_human ?? base.needs_human ?? base.ops_meta?.needs_human ?? true);
  let confidence = normalizeConfidence(source.confidence ?? opsMeta.confidence ?? base.confidence ?? base.ops_meta?.confidence ?? 0);
  let replyText = pickFirstString(source.reply_text, reply.reply_text, base.reply_text, base.reply?.reply_text, '');

  const reason = pickFirstString(source.reason, decision.reason, base.reason, base.decision?.reason, triageHint.reason, 'ai_draft_generated');
  const responseStrategy = pickFirstString(
    source.response_strategy,
    decision.strategy,
    base.response_strategy,
    base.decision?.strategy,
    needsHuman ? 'handoff_or_collect_info' : 'grounded_faq_reply'
  );

  if (!replyText) {
    replyText = base.reply_text || base.reply?.reply_text || 'Dạ anh/chị chia sẻ thêm giúp em nội dung cần hỗ trợ để bên em kiểm tra và hỗ trợ mình đúng hơn nhé ạ.';
    contractIssues.push('reply_text_missing_used_fallback');
  }

  if (action === 'handoff' && !needsHuman) {
    needsHuman = true;
    contractIssues.push('needs_human_forced_true_for_handoff');
  }

  if (action === 'auto_send' && (needsHuman || normalizedMissingInfo.length || normalizedSafetyFlags.length)) {
    contractIssues.push('unsafe_auto_send_downgraded_to_draft_only');
    needsHuman = needsHuman || normalizedMissingInfo.length > 0;
    confidence = Math.min(confidence, 0.51);
  }

  const safeAction = action === 'auto_send' && (needsHuman || normalizedMissingInfo.length || normalizedSafetyFlags.length)
    ? 'draft_only'
    : action;

  const draft = {
    ...base,
    ...source,
    reasoning_summary: typeof source.reasoning_summary === 'string' && source.reasoning_summary.trim()
      ? source.reasoning_summary.trim()
      : base.reasoning_summary || buildFallbackReasoningSummary(input),
    response_strategy: responseStrategy,
    reply_text: replyText,
    action: safeAction,
    confidence,
    needs_human: needsHuman,
    missing_info: normalizedMissingInfo,
    reason,
    policy_refs: normalizedPolicyRefs,
    safety_flags: normalizedSafetyFlags
  };

  draft.understanding = {
    intent,
    sentiment: pickFirstString(understanding.sentiment, source.sentiment, base.understanding?.sentiment, inferFallbackSentiment(intent, normalizedSafetyFlags), 'neutral'),
    missing_info: draft.missing_info
  };

  draft.decision = {
    action: draft.action,
    strategy: pickFirstString(decision.strategy, source.response_strategy, base.decision?.strategy, base.response_strategy, draft.action === 'handoff' ? 'review_and_reply' : 'direct_grounded_answer'),
    reason: draft.reason
  };

  draft.reply = {
    reply_text: draft.reply_text,
    tone_profile: pickFirstString(reply.tone_profile, source.tone_profile, base.reply?.tone_profile, 'mixer_support_default')
  };

  draft.ops_meta = {
    needs_human: draft.needs_human,
    confidence: draft.confidence,
    policy_refs: draft.policy_refs,
    safety_flags: draft.safety_flags
  };

  draft.sales_assist_meta = normalizeSalesAssistMeta(source.sales_assist_meta, input?.grounding_bundle?.grounding?.sales_assist, base.sales_assist_meta);

  draft.contract_meta = {
    normalized: true,
    used_fallback_fields: contractIssues.length > 0,
    issues: [...new Set(contractIssues)]
  };

  return draft;
}

function extractResponseText(payload) {
  const candidates = [];

  if (typeof payload?.output_text === 'string') {
    candidates.push(payload.output_text);
  }

  if (Array.isArray(payload?.output)) {
    for (const item of payload.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === 'string') candidates.push(content.text);
          if (typeof content?.output_text === 'string') candidates.push(content.output_text);
          if (typeof content?.value === 'string') candidates.push(content.value);
        }
      }
    }
  }

  const joined = candidates.map((entry) => String(entry || '').trim()).filter(Boolean).join('\n').trim();
  if (!joined) {
    throw new Error('openai_empty_output_text');
  }

  return joined;
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return values.at(-1) ?? '';
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
  }
  return Boolean(value);
}

function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const percentMatch = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
    if (percentMatch) {
      return Math.max(0, Math.min(1, Number(percentMatch[1]) / 100));
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 1 && numeric <= 100 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, scaled));
}

function buildFallbackReasoningSummary(input = {}) {
  const triageHint = input?.triage_hint || input?.triage || {};
  const caseType = triageHint.case_type || triageHint.case_type_hint || 'unknown';
  const needsHuman = triageHint.needs_human ?? triageHint.should_handoff_hint;
  return needsHuman
    ? `Ưu tiên an toàn cho case ${caseType}; cần người xử lý hoặc cần thu thập thêm thông tin.`
    : `Case ${caseType} thuộc nhóm rủi ro thấp; có thể trả lời theo grounding nếu không có cờ an toàn khác.`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function inferFallbackSentiment(intent, safetyFlags = []) {
  if (safetyFlags.includes('negative_sentiment')) return 'frustrated';
  if (intent === 'greeting_or_opening') return 'positive';
  if (intent === 'order_status_request') return 'impatient';
  return 'neutral';
}

function normalizeSalesAssistMeta(candidate, groundedSalesAssist, fallbackValue = null) {
  const source = isPlainObject(candidate)
    ? candidate
    : isPlainObject(fallbackValue)
      ? fallbackValue
      : {};

  const grounded = isPlainObject(groundedSalesAssist) ? groundedSalesAssist : {};
  const signals = normalizeArray(source.signals ?? grounded.signals ?? []);

  return {
    enabled: normalizeBoolean(source.enabled ?? grounded.enabled ?? signals.length > 0),
    buyer_intent_hint: pickFirstString(source.buyer_intent_hint, grounded.buyer_intent_hint, 'not_detected'),
    lead_strength_hint: pickFirstString(source.lead_strength_hint, grounded.lead_strength_hint, signals.length >= 2 ? 'high' : signals.length === 1 ? 'medium' : 'low'),
    signals,
    recommended_sales_motion: pickFirstString(
      source.recommended_sales_motion,
      grounded.recommended_sales_motion,
      'no special sales motion'
    ),
    product_grounding_status: pickFirstString(
      source.product_grounding_status,
      grounded.product_grounding_status,
      'unknown'
    ),
    guardrails: normalizeArray(source.guardrails ?? grounded.guardrails ?? [])
  };
}
