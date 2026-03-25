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
  const orderStatusFollowup = buildOrderStatusFollowupContext(threadMemory, latestCustomerMessage, missingInfo);
  const complaintFollowup = buildComplaintFollowupContext(threadMemory, latestCustomerMessage, missingInfo);
  const exchangeReturnFollowup = buildExchangeReturnFollowupContext(threadMemory, latestCustomerMessage, missingInfo);
  const stockFollowup = buildStockFollowupContext(threadMemory, latestCustomerMessage, missingInfo);

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
        buildLowRiskFaqReply({
          primaryCaseType: caseType,
          latestCustomerMessage,
          policyEntries,
          recommendedBlocks
        }),
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
        buildLowRiskFaqReply({
          primaryCaseType: caseType,
          latestCustomerMessage,
          policyEntries,
          recommendedBlocks
        }),
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
        buildLowRiskFaqReply({
          primaryCaseType: caseType,
          latestCustomerMessage,
          policyEntries,
          recommendedBlocks
        }),
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
        orderStatusFollowup.replyText
          || pickFirstString(recommendedBlocks, 'handoff_safe_shapes.order_status')
          || pickFirstString(recommendedBlocks, 'ask_for_info.order_identifier')
          || 'Dạ anh/chị gửi giúp em mã đơn hoặc số điện thoại nhận hàng để bên em kiểm tra nhanh hơn nha.',
        'handoff',
        orderStatusFollowup.lookupSatisfied ? 0.92 : 0.9,
        true,
        orderStatusFollowup.missingInfo,
        orderStatusFollowup.lookupSatisfied ? 'ready_for_manual_lookup' : 'requires_internal_order_check',
        buildPolicyRefs(policyEntries, caseType),
        ['requires_internal_data', ...(orderStatusFollowup.continuityApplied ? ['order_status_followup_continuity'] : [])]
      );
    case 'exchange_return_specific':
      return draft(
        exchangeReturnFollowup.replyText
          || pickFirstString(recommendedBlocks, 'ask_for_info.return_context')
          || 'Dạ anh/chị cho em xin mã đơn, ngày nhận hàng và lý do đổi/trả để bên em hỗ trợ mình chuẩn hơn ạ.',
        'handoff',
        exchangeReturnFollowup.detailsReceived ? 0.9 : 0.88,
        true,
        exchangeReturnFollowup.missingInfo,
        exchangeReturnFollowup.detailsReceived ? 'exchange_return_followup_context_received' : 'exchange_return_case_needs_human',
        buildPolicyRefs(policyEntries, caseType),
        ['policy_risk', ...(exchangeReturnFollowup.continuityApplied ? ['exchange_return_followup_continuity'] : [])]
      );
    case 'stock_or_product_availability':
      return draft(
        stockFollowup.replyText
          || pickFirstString(recommendedBlocks, 'ask_for_info.stock_context')
          || 'Anh/chị giúp em gửi tên mẫu kèm size/màu mình cần để bên em kiểm tra lại chính xác hơn nha.',
        'handoff',
        stockFollowup.detailsReceived ? 0.84 : 0.78,
        true,
        stockFollowup.missingInfo,
        stockFollowup.detailsReceived ? 'ready_for_inventory_check' : 'requires_stock_verification',
        ['case:stock_or_product_availability'],
        ['stock_unverified', ...(stockFollowup.continuityApplied ? ['stock_followup_continuity'] : [])]
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
        complaintFollowup.replyText
          || pickFirstString(recommendedBlocks, 'handoff_safe_shapes.complaint')
          || pickFirstString(recommendedBlocks, 'de_escalation.fragments')
          || 'Dạ em xin lỗi anh/chị về trải nghiệm này ạ. Anh/chị chia sẻ thêm giúp em tình huống cụ thể hoặc mã đơn để bên em kiểm tra kỹ hơn nhé.',
        'handoff',
        complaintFollowup.identifierReceived ? 0.93 : 0.92,
        true,
        complaintFollowup.missingInfo,
        complaintFollowup.identifierReceived ? 'complaint_identifier_received_waiting_manual_review' : 'negative_feedback_needs_human',
        buildPolicyRefs(policyEntries, caseType),
        ['negative_sentiment', 'policy_risk', ...(complaintFollowup.continuityApplied ? ['complaint_followup_continuity'] : [])]
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
  const unresolvedAskedSlotNames = unresolvedAskedSlots.map((item) => item.slot);
  const alreadyAskedForProduct = unresolvedAskedSlots.some((item) => item.slot === 'product_name');
  const referencedProductDeictically = mentionsUnspecifiedProduct(latestCustomerMessage);
  const hasStrongBuyerIntent = String(salesAssist?.buyer_intent_hint || '') === 'present'
    || String(salesAssist?.lead_strength_hint || '') === 'high';
  const providedContext = extractStockContext(latestCustomerMessage, unresolvedAskedSlotNames);
  const normalizedMissingInfo = normalizeStringArray(missingInfo);
  const resolvableProductReference = providedContext.product_name && !looksLikeWeakPricingProductReference(latestCustomerMessage);
  const hasProvidedSlotValue = (slot) => {
    if (slot === 'product_name') {
      return Boolean(resolvableProductReference);
    }

    return Boolean(providedContext[slot]);
  };
  const remainingMissing = normalizedMissingInfo.length
    ? normalizedMissingInfo.filter((slot) => !hasProvidedSlotValue(slot))
    : unresolvedAskedSlotNames.length
      ? unresolvedAskedSlotNames.filter((slot) => !hasProvidedSlotValue(slot))
      : ['product_name'];
  const missingProductReference = remainingMissing.includes('product_name');
  const remainingVariantSlots = remainingMissing.filter((slot) => ['size', 'size_or_variant', 'desired_size_or_variant_if_applicable', 'color', 'color_if_relevant'].includes(slot));
  const productReferenceResolved = !missingProductReference;
  const providedProductName = providedContext.product_name || readResolvedSlotValue(threadMemory, 'product_name');
  const providedVariantSummary = summarizeProvidedVariantContext(providedContext);
  const remainingProductlessMissing = remainingMissing.filter((slot) => slot !== 'product_name');

  if (!missingProductReference) {
    const acknowledgedProductLine = providedProductName
      ? `Dạ bên em đã nhận mẫu ${providedProductName} rồi ạ.`
      : 'Dạ bên em đã nhận thông tin mẫu anh/chị quan tâm rồi ạ.';

    if (remainingVariantSlots.length > 0) {
      return draft(
        `${acknowledgedProductLine} Nếu anh/chị đang quan tâm size/màu cụ thể thì nhắn thêm giúp em để bên em kiểm tra giá/ưu đãi sát hơn cho mình nha.`,
        'draft_only',
        0.87,
        false,
        remainingMissing,
        'pricing_or_promotion_waiting_variant_details',
        ['case:pricing_or_promotion'],
        ['pricing_unverified', 'promotion_unverified', 'pricing_product_context_received']
      );
    }

    return draft(
      `${acknowledgedProductLine} Để bên em kiểm tra lại giá/ưu đãi hiện có và phản hồi mình sớm nhất nha.`,
      'handoff',
      0.86,
      true,
      [],
      'pricing_or_promotion_waiting_manual_grounded_check',
      ['case:pricing_or_promotion'],
      ['pricing_unverified', 'promotion_unverified', 'pricing_product_context_received']
    );
  }

  const replyText = alreadyAskedForProduct
    ? buildProductlessPricingFollowupReply({
        providedVariantSummary,
        remainingMissing: remainingProductlessMissing,
        defaultReply: 'Dạ để em kiểm tra đúng giá/ưu đãi hiện có cho mình, anh/chị gửi giúp em tên mẫu cụ thể hoặc ảnh/link sản phẩm nha. Nếu mình chốt luôn thì nhắn thêm size/màu đang cần, bên em sẽ kiểm tra đúng hơn cho mình ạ.'
      })
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
  if (providedVariantSummary) {
    safetyFlags.push('pricing_variant_context_received');
  }

  return draft(
    replyText,
    'draft_only',
    alreadyAskedForProduct ? 0.86 : 0.82,
    false,
    remainingMissing,
    'pricing_or_promotion_needs_grounded_product_data',
    ['case:pricing_or_promotion'],
    safetyFlags
  );
}

function readResolvedSlotValue(threadMemory, slotName) {
  const match = normalizeAskedSlots(threadMemory?.asked_slots).find((item) => item.slot === slotName && item.status === 'resolved' && item.resolved_value_preview);
  return match?.resolved_value_preview || null;
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

function buildLowRiskFaqReply({ primaryCaseType, latestCustomerMessage, policyEntries, recommendedBlocks }) {
  const detectedIntents = detectLowRiskFaqIntents(latestCustomerMessage);
  if (!detectedIntents.length) {
    detectedIntents.push(primaryCaseType);
  }

  const orderedIntents = [
    primaryCaseType,
    ...detectedIntents.filter((intent) => intent !== primaryCaseType)
  ];

  const replyParts = orderedIntents
    .map((intent) => buildLowRiskFaqSegment(intent, policyEntries, recommendedBlocks, latestCustomerMessage))
    .filter(Boolean);

  return replyParts.join(' ');
}

function buildLowRiskFaqSegment(caseType, policyEntries, recommendedBlocks, latestCustomerMessage = '') {
  switch (caseType) {
    case 'shipping_eta_general':
      return interpolateTemplate(
        pickFirstString(recommendedBlocks, 'faq_answer_shapes.shipping_eta') || 'Dạ thời gian giao hàng bên em thường khoảng {eta_summary} ạ.',
        {
          eta_summary: summarizeShippingEta(policyEntries, latestCustomerMessage)
        }
      );
    case 'shipping_carrier':
      return interpolateTemplate(
        pickFirstString(recommendedBlocks, 'faq_answer_shapes.shipping_carrier') || 'Hiện bên em gửi hàng qua {carrier} nha anh/chị.',
        {
          carrier: extractCarrierName(policyEntries)
        }
      );
    case 'support_hours':
      return interpolateTemplate(
        pickFirstString(recommendedBlocks, 'faq_answer_shapes.support_hours') || 'Bên em hỗ trợ trong khung giờ {support_hours} hằng ngày ạ.',
        {
          support_hours: extractSupportHours(policyEntries)
        }
      );
    default:
      return null;
  }
}

function detectLowRiskFaqIntents(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return [];

  const intents = [];

  if (/đơn vị vận chuyển|đơn vị nào|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào|ship đơn vị nào|giao qua đơn vị nào|bên vận chuyển nào|ship bên nào/.test(text)) {
    intents.push('shipping_carrier');
  }

  if (/giờ hỗ trợ|mấy giờ|khi nào làm việc|shop làm việc mấy giờ|shop hỗ trợ mấy giờ/.test(text)) {
    intents.push('support_hours');
  }

  if (/ship|giao hàng|bao lâu|mấy ngày|khi nào nhận/.test(text)) {
    intents.push('shipping_eta_general');
  }

  return [...new Set(intents)];
}

function interpolateTemplate(template, values) {
  return String(template || '').replace(/\{([^}]+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

function summarizeShippingEta(policyEntries, latestCustomerMessage = '') {
  const etaPolicy = policyEntries.find((entry) => entry.policy_id === 'shipping_eta_general');
  const defaultSummary = '2-3 ngày với đơn nội thành Hà Nội, 3-5 ngày với ngoại thành Hà Nội, và 4-7 ngày với các tỉnh/thành khác';
  if (!etaPolicy?.facts?.length) {
    return selectEtaSegment(defaultSummary, latestCustomerMessage) || defaultSummary;
  }

  const preferredFact = etaPolicy.facts.find((fact) => fact.fact_id === 'eta_canonical_v1') || etaPolicy.facts[0];
  const canonicalSummary = cleanupStatement(preferredFact.statement)
    .replace(/^/u, '')
    .replace(/\.$/, '');

  return selectEtaSegment(canonicalSummary, latestCustomerMessage) || canonicalSummary;
}

function selectEtaSegment(canonicalSummary, latestCustomerMessage = '') {
  const text = String(latestCustomerMessage || '').trim().toLowerCase();
  if (!text) return null;

  const segments = String(canonicalSummary || '')
    .split(/;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  const rules = [
    {
      match: /(nội thành hà nội|hn nội thành|hà nội nội thành|trong nội thành)/,
      segment: (value) => /nội thành hà nội/i.test(value)
    },
    {
      match: /(ngoại thành hà nội|hn ngoại thành|hà nội ngoại thành|ngoại thành)/,
      segment: (value) => /ngoại thành hà nội/i.test(value)
    },
    {
      match: /(hà nội|hn|ở hà nội|giao hà nội)/,
      segment: (value) => /hà nội/i.test(value)
    },
    {
      match: /(tỉnh|tỉnh khác|ngoài hà nội|miền nam|miền trung|miền bắc|sài gòn|hồ chí minh|hcm|đà nẵng|cần thơ)/,
      segment: (value) => /(các tỉnh|tỉnh\/thành khác|ngoài hà nội)/i.test(value)
    }
  ];

  for (const rule of rules) {
    if (!rule.match.test(text)) continue;
    const matched = segments.find((segment) => rule.segment(segment));
    if (matched) {
      return matched.replace(/^(và\s+)/i, '').trim();
    }
  }

  return null;
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

function looksLikeWeakPricingProductReference(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  if (!/^mẫu\s+/.test(text)) return false;
  return !/^mẫu\s+(áo|quần|váy|đầm|set|combo|hoodie|tee|thun|sơ mi|polo|jacket|blazer)\b/.test(text);
}

function buildExchangeReturnFollowupContext(threadMemory, latestCustomerMessage, triageMissingInfo = []) {
  const activeCaseType = normalizeCaseType(threadMemory?.active_issue?.case_type || 'unknown');
  const unresolvedAskedSlots = normalizeAskedSlots(threadMemory?.asked_slots).filter((item) => item.status !== 'resolved');
  const pendingExchangeReturn = activeCaseType === 'exchange_return_specific' && unresolvedAskedSlots.length > 0;
  const extracted = extractExchangeReturnContext(latestCustomerMessage, unresolvedAskedSlots.map((item) => item.slot));
  const remainingMissingInfo = unresolvedAskedSlots
    .map((item) => item.slot)
    .filter((slot) => !extracted[slot]);
  const detailsReceived = pendingExchangeReturn && Object.keys(extracted).length > 0;

  if (detailsReceived && remainingMissingInfo.length === 0) {
    return {
      continuityApplied: true,
      detailsReceived: true,
      missingInfo: [],
      replyText: 'Dạ em đã nhận đủ thông tin đổi/trả hoặc lỗi sản phẩm của mình rồi ạ. Bên em sẽ kiểm tra và hỗ trợ anh/chị sớm nhất nha.'
    };
  }

  if (pendingExchangeReturn) {
    const effectiveMissingInfo = remainingMissingInfo.length ? remainingMissingInfo : normalizeStringArray(triageMissingInfo.length ? triageMissingInfo : unresolvedAskedSlots.map((item) => item.slot));
    return {
      continuityApplied: true,
      detailsReceived,
      missingInfo: effectiveMissingInfo,
      replyText: buildExchangeReturnFollowupReply(effectiveMissingInfo)
    };
  }

  return {
    continuityApplied: false,
    detailsReceived: false,
    missingInfo: normalizeStringArray(triageMissingInfo.length ? triageMissingInfo : ['order_code', 'date_received', 'reason_for_exchange_or_return']),
    replyText: null
  };
}

function buildStockFollowupContext(threadMemory, latestCustomerMessage, triageMissingInfo = []) {
  const activeCaseType = normalizeCaseType(threadMemory?.active_issue?.case_type || 'unknown');
  const unresolvedAskedSlots = normalizeAskedSlots(threadMemory?.asked_slots).filter((item) => item.status !== 'resolved');
  const pendingStockCheck = activeCaseType === 'stock_or_product_availability' && unresolvedAskedSlots.length > 0;
  const extracted = extractStockContext(latestCustomerMessage, unresolvedAskedSlots.map((item) => item.slot));
  const remainingMissingInfo = unresolvedAskedSlots
    .map((item) => item.slot)
    .filter((slot) => !extracted[slot]);
  const detailsReceived = pendingStockCheck && Object.keys(extracted).length > 0;
  const providedSummary = summarizeProvidedVariantContext(extracted);

  if (detailsReceived && remainingMissingInfo.length === 0) {
    return {
      continuityApplied: true,
      detailsReceived: true,
      missingInfo: [],
      replyText: 'Dạ em đã nhận mẫu/size mình cần rồi ạ. Bên em sẽ kiểm tra lại tồn kho và phản hồi anh/chị sớm nhất nha.'
    };
  }

  if (pendingStockCheck) {
    return {
      continuityApplied: true,
      detailsReceived,
      missingInfo: remainingMissingInfo.length ? remainingMissingInfo : normalizeStringArray(triageMissingInfo.length ? triageMissingInfo : unresolvedAskedSlots.map((item) => item.slot)),
      replyText: detailsReceived
        ? buildStockPartialFollowupReply(providedSummary, remainingMissingInfo)
        : null
    };
  }

  return {
    continuityApplied: false,
    detailsReceived: false,
    missingInfo: normalizeStringArray(triageMissingInfo.length ? triageMissingInfo : unresolvedAskedSlots.map((item) => item.slot)),
    replyText: null
  };
}

function summarizeProvidedVariantContext(context = {}) {
  const parts = [];

  if (context.product_name) {
    parts.push(`mẫu ${context.product_name}`);
  }
  if (context.color_if_relevant || context.color) {
    parts.push(`màu ${context.color_if_relevant || context.color}`);
  }
  if (context.desired_size_or_variant_if_applicable || context.size_or_variant) {
    parts.push(`size ${context.desired_size_or_variant_if_applicable || context.size_or_variant}`);
  }

  return parts.join(', ');
}

function buildStockPartialFollowupReply(providedSummary, remainingMissingInfo = []) {
  const ask = buildRemainingInfoPrompt(remainingMissingInfo, 'để bên em kiểm tra lại tồn kho chính xác hơn cho mình nha.');
  if (providedSummary) {
    return `Dạ em đã nhận ${providedSummary} rồi ạ. ${ask}`;
  }
  return ask;
}

function buildProductlessPricingFollowupReply({ providedVariantSummary, remainingMissing = [], defaultReply }) {
  const ask = buildRemainingInfoPrompt(['product_name', ...remainingMissing], 'để bên em kiểm tra đúng giá/ưu đãi hiện có cho mình nha.');
  if (providedVariantSummary) {
    return `Dạ em đã nhận ${providedVariantSummary} mình quan tâm rồi ạ. ${ask} Nếu có ảnh/link sản phẩm thì anh/chị gửi kèm giúp em luôn nha.`;
  }
  return defaultReply;
}

function buildRemainingInfoPrompt(missingInfo = [], trailing = '') {
  const labels = normalizeMissingInfoLabels(missingInfo);
  if (!labels.length) {
    return `Anh/chị nhắn thêm giúp em thông tin còn thiếu ${trailing}`.trim();
  }

  if (labels.length === 1) {
    return `Anh/chị nhắn thêm giúp em ${labels[0]} ${trailing}`.trim();
  }

  if (labels.length === 2) {
    return `Anh/chị nhắn thêm giúp em ${labels[0]} và ${labels[1]} ${trailing}`.trim();
  }

  return `Anh/chị nhắn thêm giúp em ${labels.slice(0, -1).join(', ')} và ${labels.at(-1)} ${trailing}`.trim();
}

function normalizeMissingInfoLabels(missingInfo = []) {
  const labelMap = {
    product_name: 'tên mẫu',
    size: 'size',
    size_or_variant: 'size/biến thể',
    desired_size_or_variant_if_applicable: 'size/biến thể',
    color: 'màu',
    color_if_relevant: 'màu'
  };

  return [...new Set(normalizeStringArray(missingInfo).map((slot) => labelMap[slot] || slot).filter(Boolean))];
}

function extractExchangeReturnContext(message, relevantSlots = []) {
  const text = String(message || '').trim();
  if (!text) return {};

  const slotSet = new Set(relevantSlots || []);
  const extracted = {};

  if (!slotSet.size || slotSet.has('order_code')) {
    const orderCode = extractOrderCode(text);
    if (orderCode) {
      extracted.order_code = orderCode;
    }
  }

  if (!slotSet.size || slotSet.has('date_received')) {
    const dateReceived = extractDateReceived(text);
    if (dateReceived) {
      extracted.date_received = dateReceived;
    }
  }

  if (!slotSet.size || slotSet.has('reason_for_exchange_or_return') || slotSet.has('product_issue_detail')) {
    const issueDetail = extractIssueDetail(text);
    if (issueDetail) {
      extracted.reason_for_exchange_or_return = issueDetail;
      extracted.product_issue_detail = issueDetail;
    }
  }

  return extracted;
}

function buildExchangeReturnFollowupReply(remainingMissingInfo = []) {
  const missing = new Set(normalizeStringArray(remainingMissingInfo));

  if (missing.has('order_code') && missing.has('date_received') && (missing.has('reason_for_exchange_or_return') || missing.has('product_issue_detail'))) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị gửi giúp em mã đơn, ngày nhận hàng và mô tả lỗi/lý do đổi trả để bên em hỗ trợ mình chuẩn hơn nha.';
  }

  if (missing.has('order_code') && (missing.has('reason_for_exchange_or_return') || missing.has('product_issue_detail'))) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị gửi giúp em mã đơn và mô tả lỗi/lý do đổi trả để bên em hỗ trợ mình chuẩn hơn nha.';
  }

  if (missing.has('order_code')) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị gửi giúp em mã đơn để bên em kiểm tra và hỗ trợ mình nhanh hơn nha.';
  }

  if (missing.has('date_received') && (missing.has('reason_for_exchange_or_return') || missing.has('product_issue_detail'))) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị cho em xin ngày nhận hàng và mô tả lỗi/lý do đổi trả để bên em hỗ trợ đúng hơn nha.';
  }

  if (missing.has('date_received')) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị cho em xin ngày nhận hàng giúp em để bên em hỗ trợ mình đúng hơn nha.';
  }

  if (missing.has('reason_for_exchange_or_return') || missing.has('product_issue_detail')) {
    return 'Dạ em đã nhận thêm thông tin rồi ạ. Anh/chị mô tả giúp em tình trạng lỗi hoặc lý do đổi/trả để bên em hỗ trợ mình chuẩn hơn nha.';
  }

  return 'Dạ em đã nhận thêm thông tin rồi ạ. Bên em sẽ kiểm tra và hỗ trợ anh/chị sớm nhất nha.';
}

function extractStockContext(message, relevantSlots = []) {
  const text = String(message || '').trim();
  if (!text) return {};

  const slotSet = new Set(relevantSlots || []);
  const extracted = {};

  if (!slotSet.size || slotSet.has('product_name')) {
    const productName = extractProductName(text);
    if (productName) {
      extracted.product_name = productName;
    }
  }

  if (!slotSet.size || slotSet.has('size_or_variant') || slotSet.has('desired_size_or_variant_if_applicable')) {
    const size = extractSizeOrVariant(text);
    if (size) {
      extracted.size_or_variant = size;
      extracted.desired_size_or_variant_if_applicable = size;
    }
  }

  if (!slotSet.size || slotSet.has('color_if_relevant') || slotSet.has('color')) {
    const color = extractColor(text);
    if (color) {
      extracted.color_if_relevant = color;
      extracted.color = color;
    }
  }

  return extracted;
}

function buildComplaintFollowupContext(threadMemory, latestCustomerMessage, triageMissingInfo = []) {
  const latestText = String(latestCustomerMessage || '').trim();
  const pendingComplaint = threadMemory?.active_issue?.case_type === 'complaint_or_negative_feedback';
  const unresolvedAskedSlots = normalizeStringArray(
    (threadMemory?.asked_slots || []).filter((item) => item?.status !== 'resolved').map((item) => item?.slot)
  );
  const hasIdentifierInMessage = /(?:mã\s*đơn|madon|ma don|order\s*code|mã\s*vận\s*đơn|tracking\s*code)\s*[:#\-]?\s*[a-z0-9][a-z0-9\-_.]{4,}/iu.test(latestText)
    || /^[a-z0-9\-_.]{5,32}$/iu.test(latestText)
    || /(?:\+?84|0)(?:[\s.-]*\d){8,10}/u.test(latestText);
  const continuityApplied = pendingComplaint && Boolean(latestText) && (threadMemory?.pending_customer_reply || hasIdentifierInMessage);
  const missingInfo = continuityApplied && hasIdentifierInMessage
    ? unresolvedAskedSlots.filter((slot) => !['order_code', 'phone', 'receiver_phone'].includes(slot))
    : normalizeStringArray(triageMissingInfo.length ? triageMissingInfo : unresolvedAskedSlots);

  return {
    continuityApplied,
    identifierReceived: continuityApplied && hasIdentifierInMessage,
    missingInfo,
    replyText: continuityApplied && hasIdentifierInMessage
      ? 'Dạ em đã nhận thông tin đơn của anh/chị rồi ạ. Bên em xin lỗi về trải nghiệm này và sẽ kiểm tra kỹ để phản hồi mình sớm nhất nha.'
      : null
  };
}

function buildOrderStatusFollowupContext(threadMemory, latestCustomerMessage, triageMissingInfo = []) {
  const activeCaseType = normalizeCaseType(threadMemory?.active_issue?.case_type || 'unknown');
  const unresolvedAskedSlots = normalizeAskedSlots(threadMemory?.asked_slots).filter((item) => item.status !== 'resolved');
  const pendingOrderLookup = activeCaseType === 'order_status_request' && unresolvedAskedSlots.some((item) => ['order_code', 'phone', 'receiver_phone'].includes(item.slot));
  const extracted = extractOrderLookupIdentifiers(latestCustomerMessage);
  const lookupSatisfied = Boolean(extracted.order_code || extracted.phone || extracted.receiver_phone);
  const continuityApplied = pendingOrderLookup;

  if (lookupSatisfied) {
    const identifierLabel = extracted.order_code
      ? 'mã đơn'
      : extracted.receiver_phone || extracted.phone
        ? 'số điện thoại'
        : 'thông tin tra cứu';
    return {
      continuityApplied,
      lookupSatisfied: true,
      missingInfo: [],
      replyText: `Dạ em đã nhận ${identifierLabel} của mình rồi ạ. Bên em sẽ kiểm tra đơn và phản hồi anh/chị sớm nhé.`
    };
  }

  const requestedLookupSlots = continuityApplied
    ? unresolvedAskedSlots.map((item) => item.slot).filter((slot) => ['order_code', 'phone', 'receiver_phone'].includes(slot))
    : [];
  const normalizedMissing = normalizeOrderLookupMissingInfo(requestedLookupSlots.length ? requestedLookupSlots : triageMissingInfo);

  return {
    continuityApplied,
    lookupSatisfied: false,
    missingInfo: normalizedMissing,
    replyText: continuityApplied
      ? 'Dạ để em kiểm tra đúng đơn của mình, anh/chị gửi giúp em mã đơn hoặc số điện thoại nhận hàng nha.'
      : null
  };
}

function extractOrderLookupIdentifiers(message) {
  const text = String(message || '').trim();
  if (!text) return {};

  const orderCode = extractOrderCode(text);
  const phone = extractPhoneNumber(text);
  return {
    order_code: orderCode,
    phone,
    receiver_phone: phone
  };
}

function extractOrderCode(text) {
  const directMatch = String(text || '').match(/(?:mã\s*đơn|madon|ma don|order\s*code|mã\s*vận\s*đơn|tracking\s*code)\s*[:#\-]?\s*([a-z0-9][a-z0-9\-_.]{4,})/iu);
  if (directMatch?.[1]) {
    return sanitizeToken(directMatch[1], 32);
  }

  const compactOnlyCode = String(text || '').replace(/\s+/g, ' ').trim();
  if (/^[a-z0-9\-_.]{5,20}$/iu.test(compactOnlyCode) && /[a-z]/iu.test(compactOnlyCode) && /\d/.test(compactOnlyCode)) {
    return sanitizeToken(compactOnlyCode, 32);
  }

  const fallbackToken = compactOnlyCode.match(/\b([a-z]{1,6}[0-9][a-z0-9\-_.]{3,})\b/iu);
  if (fallbackToken?.[1] && !/^ship$/iu.test(fallbackToken[1])) {
    return sanitizeToken(fallbackToken[1], 32);
  }

  return null;
}

function extractPhoneNumber(text) {
  const match = String(text || '').match(/(?:\+?84|0)(?:[\s.-]*\d){8,10}/u);
  if (!match?.[0]) {
    return null;
  }

  const digits = match[0].replace(/\D+/g, '');
  if (digits.length < 9 || digits.length > 11) {
    return null;
  }

  return digits;
}

function extractIssueDetail(text) {
  const compact = String(text || '').trim();
  if (!compact) return null;

  const explicitMatch = compact.match(/(?:lý do|vấn đề|bị|lỗi|rách|hỏng|sai hàng|sai size)\s*[:\-]?\s*([^\n]{3,120})/iu);
  if (explicitMatch?.[1]) {
    return sanitizeIssueDetail(explicitMatch[1]);
  }

  if (extractOrderCode(compact) || extractPhoneNumber(compact)) {
    return null;
  }

  if (/^(dạ|vâng|ok|oke|oki|rồi|đây|nè|shop check|check giúp|kiểm tra giúp)[.!?…~\s]*$/iu.test(compact)) {
    return null;
  }

  if (compact.length >= 6 && /(lỗi|rách|hỏng|sai hàng|sai size|bung|tuột|bể|nứt|không lên|không chạy|không quay|không dùng được|móp|méo|gãy|vỡ|rung mạnh)/iu.test(compact)) {
    return sanitizeIssueDetail(compact);
  }

  return null;
}

function extractDateReceived(text) {
  const compact = String(text || '').trim();
  if (!compact) return null;

  const directDate = compact.match(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\b/u);
  if (directDate?.[1]) {
    return sanitizeFreeText(directDate[1], 20);
  }

  const relative = compact.match(/\b(hôm nay|hôm qua|hôm kia|mới nhận(?: hôm qua| hôm nay)?|vừa nhận(?: hôm qua| hôm nay)?|nhận hôm qua|nhận hôm nay)\b/iu);
  if (relative?.[1]) {
    return sanitizeFreeText(relative[1], 30);
  }

  return null;
}

function extractProductName(text) {
  const compactText = String(text || '').trim();
  if (!compactText) return null;

  const productPatterns = [
    /(?:mẫu|áo|quần|set|váy|đầm|item|sp|sản phẩm|product)(?:\s+này|\s+đó|\s+kia)?\s*(?:là|mã|tên)?\s*[:\-]?\s*([\p{L}\p{N}][\p{L}\p{N}\s\-_/]{2,60})/iu,
    /(?:em lấy|mình lấy|cho mình|cho em|muốn lấy|chốt|đặt)(?:\s+mẫu)?\s+([\p{L}\p{N}][\p{L}\p{N}\s\-_/]{2,60})/iu
  ];

  for (const pattern of productPatterns) {
    const match = compactText.match(pattern);
    const value = sanitizeProductName(match?.[1] || match?.[0]);
    if (value && !looksLikeOnlyVariantInfo(value) && !looksLikePricingOrPromoFragment(value) && !looksLikeNonProductFragment(value)) {
      return value;
    }
  }

  return null;
}

function normalizeOrderLookupMissingInfo(value) {
  const slots = normalizeStringArray(value).filter((slot) => ['order_code', 'phone', 'receiver_phone'].includes(slot));
  return slots.length ? [...new Set(slots)] : ['order_code', 'receiver_phone'];
}

function sanitizeProductName(value) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/g, '');
  if (!cleaned) return null;
  return cleaned
    .replace(/(màu|color).*$/iu, '')
    .replace(/(size|sz|cỡ).*$/iu, '')
    .replace(/\s+(nha|nhé|ạ|giúp em|giúp mình)$/iu, '')
    .trim()
    .slice(0, 60) || null;
}

function looksLikeOnlyVariantInfo(value) {
  const normalized = String(value || '').toLowerCase().trim();
  return /^(size\s+|màu\s+|color\s+|đen|trắng|xám|ghi|be|kem|nâu|xanh|đỏ|hồng|tím|vàng|xs|s|m|l|xl|xxl|xxxl|2xl|3xl|28|29|30|31|32|33|34|35|36)(\s|$)/.test(normalized);
}

function looksLikePricingOrPromoFragment(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (!normalized) return false;
  return /(giá|bao nhiêu|bao tiền|sale|khuyến mãi|ưu đãi|voucher|mã giảm giá|freeship)/.test(normalized);
}

function looksLikeNonProductFragment(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (!normalized) return false;
  return /^(này|đó|kia|cái này|mẫu này|sp này|sản phẩm này|không|không shop|còn không|còn hàng không|check giúp mình|kiểm tra giúp mình)$/i.test(normalized)
    || /(không shop|còn không shop)/i.test(normalized);
}

function sanitizeToken(value, maxLength) {
  return String(value || '').trim().replace(/[.,;:!?]+$/g, '').slice(0, maxLength) || null;
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

  if (activeCaseType === 'pricing_or_promotion') {
    if (threadMemory?.pending_customer_reply || mentionsUnspecifiedProduct(latestCustomerMessage) || isGenericPricingFollowup(latestCustomerMessage)) {
      return 'pricing_or_promotion';
    }
    return requestedCaseType;
  }

  if (activeCaseType === 'order_status_request') {
    const hasOrderLookupSlot = unresolvedAskedSlots.some((item) => ['order_code', 'phone', 'receiver_phone'].includes(item.slot));
    if (hasOrderLookupSlot && (threadMemory?.pending_customer_reply || looksLikeOrderLookupFollowup(latestCustomerMessage) || extractOrderCode(latestCustomerMessage) || extractPhoneNumber(latestCustomerMessage))) {
      return 'order_status_request';
    }
  }

  const lowRiskShippingFollowup = resolveLowRiskShippingFollowup(activeCaseType, latestCustomerMessage);
  if (lowRiskShippingFollowup) {
    return lowRiskShippingFollowup;
  }

  if (!unresolvedAskedSlots.length) {
    return requestedCaseType;
  }

  return requestedCaseType;
}

function resolveLowRiskShippingFollowup(activeCaseType, latestCustomerMessage) {
  const text = String(latestCustomerMessage || '').trim().toLowerCase();
  if (!text) return null;

  if (activeCaseType === 'shipping_eta_general') {
    if (looksLikeShippingEtaRefinement(text)) {
      return 'shipping_eta_general';
    }
    if (looksLikeShippingCarrierRefinement(text)) {
      return 'shipping_carrier';
    }
  }

  if (activeCaseType === 'shipping_carrier' && looksLikeShippingEtaRefinement(text)) {
    return 'shipping_eta_general';
  }

  return null;
}

function looksLikeShippingEtaRefinement(text) {
  return /(hà nội|hn|nội thành|ngoại thành|tỉnh|ngoài hà nội|miền nam|miền trung|miền bắc|sài gòn|hồ chí minh|hcm|đà nẵng|cần thơ)/.test(text)
    || /^(còn|thế|vậy|nếu|ở)\b.*(sao|shop|ạ|nha|nhé)?/.test(text);
}

function looksLikeShippingCarrierRefinement(text) {
  return /^(còn|với|thế|vậy|tiện)\b.*(đơn vị|hãng|bên vận chuyển|carrier|viettel|ghtk|ghn)/.test(text)
    || /(đơn vị nào|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào|ship đơn vị nào|giao qua đơn vị nào|bên vận chuyển nào|ship bên nào)/.test(text);
}

function isGenericPricingFollowup(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return /^(dạ\s*)?(shop\s*)?(check|kiểm tra|coi|xem|báo|tư vấn)(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(text)
    || /^(dạ\s*)?(vậy|thế)(\s+(shop|bên mình|bên em))?(\s+(check|kiểm tra|báo|tư vấn))(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(text);
}

function looksLikeOrderLookupFollowup(message) {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return /^(dạ\s*)?(ok|oke|oki|vâng|dạ vâng|ừm|uhm|uk|yes|rồi|đây|nè|nha|nhé|ạ)[.!?…~]*$/iu.test(text)
    || /^(dạ\s*)?(shop\s*)?(check|kiểm tra|coi|xem)(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(text)
    || /^(sđt|sdt|sdt nè|số điện thoại|mã đơn)(\s*[:\-].*)?$/iu.test(text);
}

function extractSizeOrVariant(text) {
  const directMatch = String(text || '').match(/(?:size|sz|cỡ|co)\s*[:\-]?\s*([a-z0-9]{1,6}(?:\s*[\/\-]\s*[a-z0-9]{1,6})?)/iu);
  if (directMatch?.[1]) {
    return sanitizeFreeText(directMatch[1].toUpperCase(), 24);
  }

  const standaloneSize = String(text || '').match(/(?:^|\s)(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|28|29|30|31|32|33|34|35|36)(?=\s|$|[.,!?])/iu);
  if (standaloneSize?.[1]) {
    return sanitizeFreeText(standaloneSize[1].toUpperCase(), 24);
  }

  return null;
}

function extractColor(text) {
  const directMatch = String(text || '').match(/(?:màu|mau|color)\s*[:\-]?\s*([\p{L}\s]{2,30})/iu);
  if (directMatch?.[1]) {
    return sanitizeColor(directMatch[1]);
  }

  const commonColor = String(text || '').match(/\b(đen|trắng|xám|ghi|be|kem|nâu|xanh|xanh nhạt|xanh đậm|xanh da trời|xanh navy|đỏ|hồng|tím|vàng)\b/iu);
  if (commonColor?.[1]) {
    return sanitizeColor(commonColor[1]);
  }

  return null;
}

function sanitizeFreeText(value, maxLength = 60) {
  const cleaned = String(value || '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/g, '');
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function sanitizeColor(value) {
  const cleaned = sanitizeFreeText(value, 30);
  if (!cleaned) return null;
  return cleaned
    .replace(/^(màu|color)\s+/iu, '')
    .replace(/\b(size|sz|cỡ)\b.*$/iu, '')
    .replace(/\s+(nha|nhé|ạ|giúp em|giúp mình)$/iu, '')
    .trim() || null;
}

function sanitizeIssueDetail(value) {
  const cleaned = sanitizeFreeText(value, 120);
  if (!cleaned) return null;
  if (/^(dạ|vâng|ok|oke|oki|rồi|đây|nè)$/iu.test(cleaned)) return null;
  return cleaned;
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
