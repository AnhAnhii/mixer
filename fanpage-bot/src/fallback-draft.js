import { normalizeCaseType, normalizeDraftAction } from './types.js';

export function buildFallbackDraft(input) {
  const triage = input?.triage || input?.triage_hint || {};
  const selected = input?.grounding?.selected || input?.grounding_bundle?.grounding?.selected || {};
  const requestedCaseType = normalizeCaseType(input?.case_type || triage.case_type_hint || triage.case_type || 'unknown');
  const threadMemory = input?.thread_memory || input?.grounding_bundle?.customer_context?.thread_memory || null;
  const latestCustomerMessage = input?.latest_customer_message || input?.message?.text || '';
  const caseType = resolveFallbackCaseType(requestedCaseType, threadMemory, latestCustomerMessage);
  const policyEntries = normalizePolicyEntries(selected.policy_entries || []);
  const recommendedBlocks = normalizeRecommendedBlocks(selected.response_patterns?.recommended_blocks || []);
  const missingInfo = normalizeStringArray(input?.missing_info || triage.missing_info_hint || triage.missing_info || []);

  switch (caseType) {
    case 'greeting_or_opening':
      return draft(
        pickFirstString(recommendedBlocks, 'acknowledgements.neutral') || 'Dạ em chào anh/chị nhé ạ. Anh/chị cần Mixer hỗ trợ gì cứ nhắn bên em nha ✨',
        'draft_only',
        0.94,
        false,
        [],
        'knowledge_bank_fallback',
        ['case:greeting_or_opening', 'tone:greeting_or_opening'],
        []
      );
    case 'shipping_eta_general':
      return draft(
        interpolateTemplate(
          pickFirstString(recommendedBlocks, 'faq_answer_shapes.shipping_eta') || 'Dạ thời gian giao hàng bên em thường khoảng {eta_summary} ạ.',
          {
            eta_summary: summarizeShippingEta(policyEntries)
          }
        ),
        'draft_only',
        0.91,
        false,
        [],
        'knowledge_bank_faq_answer',
        buildPolicyRefs(policyEntries, caseType),
        []
      );
    case 'shipping_carrier':
      return draft(
        interpolateTemplate(
          pickFirstString(recommendedBlocks, 'faq_answer_shapes.shipping_carrier') || 'Dạ hiện bên em gửi hàng qua {carrier} nha anh/chị.',
          {
            carrier: extractCarrierName(policyEntries)
          }
        ),
        'draft_only',
        0.92,
        false,
        [],
        'knowledge_bank_faq_answer',
        buildPolicyRefs(policyEntries, caseType),
        []
      );
    case 'support_hours':
      return draft(
        interpolateTemplate(
          pickFirstString(recommendedBlocks, 'faq_answer_shapes.support_hours') || 'Dạ bên em hỗ trợ trong khung giờ {support_hours} hằng ngày ạ.',
          {
            support_hours: extractSupportHours(policyEntries)
          }
        ),
        'draft_only',
        0.93,
        false,
        [],
        'knowledge_bank_faq_answer',
        buildPolicyRefs(policyEntries, caseType),
        []
      );
    case 'order_status_request':
      return draft(
        pickFirstString(recommendedBlocks, 'handoff_safe_shapes.order_status')
          || pickFirstString(recommendedBlocks, 'ask_for_info.order_identifier')
          || 'Dạ anh/chị gửi giúp em mã đơn hoặc số điện thoại nhận hàng để bên em kiểm tra nhanh hơn nha.',
        'handoff',
        0.9,
        true,
        missingInfo.length ? missingInfo : ['order_code', 'receiver_phone'],
        'requires_internal_order_check',
        buildPolicyRefs(policyEntries, caseType),
        ['requires_internal_data']
      );
    case 'exchange_return_specific':
      return draft(
        pickFirstString(recommendedBlocks, 'ask_for_info.return_context')
          || 'Dạ anh/chị cho em xin mã đơn, ngày nhận hàng và lý do đổi/trả để bên em hỗ trợ mình chuẩn hơn ạ.',
        'handoff',
        0.88,
        true,
        missingInfo.length ? missingInfo : ['order_code', 'date_received', 'reason_for_exchange_or_return'],
        'exchange_return_case_needs_human',
        buildPolicyRefs(policyEntries, caseType),
        ['policy_risk']
      );
    case 'stock_or_product_availability':
      return draft(
        pickFirstString(recommendedBlocks, 'ask_for_info.stock_context')
          || 'Anh/chị giúp em gửi tên mẫu kèm size/màu mình cần để bên em kiểm tra lại chính xác hơn nha.',
        'handoff',
        0.78,
        true,
        missingInfo.length ? missingInfo : ['product_name', 'size_or_variant'],
        'requires_stock_verification',
        ['case:stock_or_product_availability'],
        ['stock_unverified']
      );
    case 'pricing_or_promotion':
      return buildPricingPromotionDraft({
        latestCustomerMessage: input?.latest_customer_message,
        threadMemory: input?.thread_memory,
        salesAssist: input?.grounding?.sales_assist || input?.grounding_bundle?.grounding?.sales_assist || {},
        missingInfo: missingInfo.length ? missingInfo : ['product_name']
      });
    case 'complaint_or_negative_feedback':
      return draft(
        pickFirstString(recommendedBlocks, 'handoff_safe_shapes.complaint')
          || pickFirstString(recommendedBlocks, 'de_escalation.fragments')
          || 'Dạ em xin lỗi anh/chị về trải nghiệm này ạ. Anh/chị chia sẻ thêm giúp em tình huống cụ thể hoặc mã đơn để bên em kiểm tra kỹ hơn nhé.',
        'handoff',
        0.92,
        true,
        missingInfo,
        'negative_feedback_needs_human',
        buildPolicyRefs(policyEntries, caseType),
        ['negative_sentiment', 'policy_risk']
      );
    default:
      return draft(
        'Dạ anh/chị chia sẻ thêm giúp em nội dung cần hỗ trợ để bên em kiểm tra và hỗ trợ mình đúng hơn nhé ạ.',
        'handoff',
        0.4,
        true,
        missingInfo,
        'insufficient_information',
        buildPolicyRefs(policyEntries, caseType),
        ['needs_review']
      );
  }
}

function draft(replyText, action, confidence, needsHuman, missingInfo, reason, policyRefs, safetyFlags) {
  const normalizedAction = normalizeDraftAction(action);
  const normalizedMissingInfo = normalizeStringArray(missingInfo);
  const normalizedPolicyRefs = normalizeStringArray(policyRefs);
  const normalizedSafetyFlags = normalizeStringArray(safetyFlags);
  const intent = normalizeCaseType(normalizedPolicyRefs.find((entry) => entry.startsWith('case:'))?.slice(5) || 'unknown');
  const sentiment = inferSentiment(intent, normalizedSafetyFlags);
  const strategy = inferStrategy(normalizedAction, intent, normalizedMissingInfo, normalizedSafetyFlags);
  const safeReplyText = typeof replyText === 'string' && replyText.trim()
    ? replyText.trim()
    : 'Dạ anh/chị chia sẻ thêm giúp em nội dung cần hỗ trợ để bên em kiểm tra và hỗ trợ mình đúng hơn nhé ạ.';

  return {
    understanding: {
      intent,
      sentiment,
      missing_info: normalizedMissingInfo
    },
    decision: {
      action: normalizedAction,
      strategy,
      reason: String(reason || 'insufficient_information').trim()
    },
    reply: {
      reply_text: safeReplyText,
      tone_profile: 'mixer_support_default'
    },
    ops_meta: {
      needs_human: Boolean(needsHuman),
      confidence: normalizeConfidence(confidence),
      policy_refs: normalizedPolicyRefs,
      safety_flags: normalizedSafetyFlags
    },
    reply_text: safeReplyText,
    action: normalizedAction,
    confidence: normalizeConfidence(confidence),
    needs_human: Boolean(needsHuman),
    missing_info: normalizedMissingInfo,
    reason: String(reason || 'insufficient_information').trim(),
    policy_refs: normalizedPolicyRefs,
    safety_flags: normalizedSafetyFlags
  };
}

function inferStrategy(action, intent, missingInfo, safetyFlags) {
  if (action === 'handoff' && safetyFlags.includes('negative_sentiment')) {
    return 'brief_empathy_then_collect_context';
  }
  if (action === 'handoff' && missingInfo.length) {
    return 'collect_required_info_then_handoff';
  }
  if (action === 'handoff') {
    return 'safe_handoff';
  }
  if (intent === 'greeting_or_opening') {
    return 'warm_opening_and_invite_question';
  }
  return 'direct_grounded_answer';
}

function buildPricingPromotionDraft({ latestCustomerMessage, threadMemory, salesAssist, missingInfo }) {
  const unresolvedAskedSlots = normalizeAskedSlots(threadMemory?.asked_slots).filter((item) => item.status !== 'resolved');
  const alreadyAskedForProduct = unresolvedAskedSlots.some((item) => item.slot === 'product_name');
  const referencedProductDeictically = mentionsUnspecifiedProduct(latestCustomerMessage);
  const hasStrongBuyerIntent = String(salesAssist?.buyer_intent_hint || '') === 'present'
    || String(salesAssist?.lead_strength_hint || '') === 'high';

  const replyText = alreadyAskedForProduct
    ? 'Dạ để em kiểm tra đúng giá/ưu đãi hiện có cho mình, anh/chị gửi giúp em tên mẫu cụ thể hoặc ảnh/link sản phẩm nha. Nếu mình chốt luôn thì nhắn thêm size/màu đang cần, bên em sẽ kiểm tra đúng hơn cho mình ạ.'
    : referencedProductDeictically || hasStrongBuyerIntent
      ? 'Dạ để em báo đúng giá/ưu đãi hiện có, anh/chị gửi giúp em tên mẫu hoặc ảnh/link sản phẩm mình đang xem nha. Nếu có size/màu mình quan tâm thì nhắn kèm giúp em luôn ạ.'
      : 'Dạ anh/chị nhắn giúp em tên mẫu hoặc ảnh/link sản phẩm mình quan tâm để bên em kiểm tra đúng giá/ưu đãi hiện có cho mình nha. Em chưa dám báo giá hay khuyến mãi nếu chưa có dữ liệu xác nhận ạ.';

  const safetyFlags = ['pricing_unverified', 'promotion_unverified'];
  if (alreadyAskedForProduct) {
    safetyFlags.push('repeat_info_request_refined');
  }
  if (referencedProductDeictically) {
    safetyFlags.push('product_reference_ambiguous');
  }

  return draft(
    replyText,
    'draft_only',
    alreadyAskedForProduct ? 0.86 : 0.82,
    false,
    missingInfo,
    'pricing_or_promotion_needs_grounded_product_data',
    ['case:pricing_or_promotion'],
    safetyFlags
  );
}

function inferSentiment(intent, safetyFlags) {
  if (safetyFlags.includes('negative_sentiment')) return 'frustrated';
  if (intent === 'greeting_or_opening') return 'positive';
  if (intent === 'order_status_request') return 'impatient';
  return 'neutral';
}

function pickFirstString(recommendedBlocks, expectedPath) {
  const match = recommendedBlocks.find((entry) => entry.block_path === expectedPath);
  if (Array.isArray(match?.value) && match.value.length > 0) {
    return String(match.value[0] || '').trim() || null;
  }
  return null;
}

function interpolateTemplate(template, values) {
  return String(template || '').replace(/\{([^}]+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

function summarizeShippingEta(policyEntries) {
  const etaPolicy = policyEntries.find((entry) => entry.policy_id === 'shipping_eta_general');
  if (!etaPolicy?.facts?.length) {
    return '2-3 ngày với đơn nội thành Hà Nội, 3-5 ngày với ngoại thành Hà Nội, và 4-7 ngày với các tỉnh/thành khác';
  }

  const preferredFact = etaPolicy.facts.find((fact) => fact.fact_id === 'eta_canonical_v1') || etaPolicy.facts[0];
  return cleanupStatement(preferredFact.statement)
    .replace(/^/u, '')
    .replace(/\.$/, '');
}

function extractSupportHours(policyEntries) {
  const raw = getFactStatement(policyEntries, 'support_hours_window') || '08:00 đến 23:00';
  const match = raw.match(/(\d{1,2}:\d{2}\s*(?:đến|-)+\s*\d{1,2}:\d{2})/i);
  return match?.[1]?.replace(/\s*-\s*/g, ' - ') || '08:00-23:00';
}

function getFactStatement(policyEntries, factId) {
  for (const policy of policyEntries) {
    const fact = (policy.facts || []).find((entry) => entry.fact_id === factId);
    if (fact?.statement) {
      return String(fact.statement);
    }
  }
  return null;
}

function extractCarrierName(policyEntries) {
  const raw = getFactStatement(policyEntries, 'carrier_primary') || 'Viettel Post';
  const match = raw.match(/là\s+(.+?)\.?$/i);
  return match?.[1]?.trim() || raw.replace(/\.$/, '').trim();
}

function cleanupStatement(statement) {
  return String(statement || '')
    .replace(/^Dạ\s+/i, '')
    .replace(/^Bên em\s+/i, 'bên em ')
    .trim();
}

function buildPolicyRefs(policyEntries, caseType) {
  const ids = policyEntries.map((entry) => `policy:${entry.policy_id}`);
  if (caseType) {
    ids.unshift(`case:${caseType}`);
  }
  return normalizeStringArray(ids);
}

function normalizePolicyEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object');
}

function normalizeAskedSlots(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object' && typeof entry.slot === 'string');
}

function mentionsUnspecifiedProduct(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return /(áo này|quần này|item này|mẫu này|sp này|sản phẩm này|cái này|em này|bộ này|áo kia|quần kia|mẫu kia)/.test(text);
}

function normalizeRecommendedBlocks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry && typeof entry === 'object' && typeof entry.block_path === 'string');
}

function resolveFallbackCaseType(requestedCaseType, threadMemory, latestCustomerMessage) {
  if (requestedCaseType !== 'unknown') {
    return requestedCaseType;
  }

  const activeCaseType = normalizeCaseType(threadMemory?.active_issue?.case_type || 'unknown');
  const unresolvedAskedSlots = normalizeAskedSlots(threadMemory?.asked_slots).filter((item) => item.status !== 'resolved');
  if (activeCaseType !== 'pricing_or_promotion') {
    return requestedCaseType;
  }

  if (!unresolvedAskedSlots.length) {
    return requestedCaseType;
  }

  if (threadMemory?.pending_customer_reply || mentionsUnspecifiedProduct(latestCustomerMessage) || isGenericPricingFollowup(latestCustomerMessage)) {
    return 'pricing_or_promotion';
  }

  return requestedCaseType;
}

function isGenericPricingFollowup(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return /^(dạ\s*)?(shop\s*)?(check|kiểm tra|coi|xem|báo|tư vấn)(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(text)
    || /^(dạ\s*)?(vậy|thế)(\s+(shop|bên mình|bên em))?(\s+(check|kiểm tra|báo|tư vấn))(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(text);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}
