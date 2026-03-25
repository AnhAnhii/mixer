import { HANDOFF_CASES, LOW_RISK_CASES } from './types.js';

export function classifyMessage(normalizedMessage) {
  const text = (normalizedMessage.text || '').toLowerCase().trim();
  const hasAttachments = (normalizedMessage.attachments || []).length > 0;

  if (!text && hasAttachments) {
    return buildResult('unknown', 'high', true, 0.2, [], 'attachment_only_message', ['attachment', 'needs_review']);
  }

  if (!text) {
    return buildResult('unknown', 'low', false, 0.2, [], 'empty_or_non_text_message', ['non_text']);
  }

  if (/bực|khó chịu|thất vọng|tệ quá|quá tệ|lừa đảo|phốt|không hài lòng|bực mình|chán shop|dịch vụ chán|dịch vụ tệ|khiếu nại|complain/.test(text)) {
    return buildResult('complaint_or_negative_feedback', 'high', true, 0.92, [], 'matched_negative_feedback_rule', ['complaint', 'negative_sentiment', 'handoff']);
  }

  if (/đổi|trả|lỗi|rách|hỏng|sai hàng|sai size/.test(text)) {
    return buildResult('exchange_return_specific', 'high', true, 0.88, ['order_code', 'product_issue_detail'], 'matched_exchange_or_defect_rule', ['exchange', 'defect', 'handoff']);
  }

  if (/mã đơn|kiểm tra đơn|đơn của mình|đơn đến đâu/.test(text)) {
    return buildResult('order_status_request', 'medium', true, 0.9, ['order_code'], 'matched_order_status_rule', ['order_status', 'handoff']);
  }

  if (/còn hàng|còn size|còn sz|hết hàng|available|còn không/.test(text)) {
    return buildResult('stock_or_product_availability', 'medium', true, 0.78, ['product_name', 'size_or_variant'], 'matched_stock_check_rule', ['stock', 'handoff']);
  }

  if (/giá bao nhiêu|bao nhiêu tiền|giá sao|giá ntn|giá thế nào|bao tiền|giá áo|giá quần|giá item|giá mẫu|giá sản phẩm|sale không|khuyến mãi|voucher|mã giảm giá|giảm giá|freeship|ưu đãi/.test(text)) {
    return buildResult('pricing_or_promotion', 'medium', false, 0.84, ['product_name'], 'matched_pricing_or_promotion_rule', ['pricing', 'promotion', 'buyer_intent']);
  }

  if (/đơn vị vận chuyển|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào|ship đơn vị nào|giao qua đơn vị nào|bên vận chuyển nào|ship bên nào/.test(text)) {
    return buildResult('shipping_carrier', 'low', false, 0.92, [], 'matched_shipping_carrier_rule', ['faq', 'shipping']);
  }

  if (/giờ hỗ trợ|mấy giờ|khi nào làm việc|shop làm việc mấy giờ|shop hỗ trợ mấy giờ/.test(text)) {
    return buildResult('support_hours', 'low', false, 0.93, [], 'matched_support_hours_rule', ['faq', 'support_hours']);
  }

  if (/ship|giao hàng|bao lâu|mấy ngày|khi nào nhận/.test(text)) {
    return buildResult('shipping_eta_general', 'low', false, 0.9, [], 'matched_shipping_eta_rule', ['faq', 'shipping']);
  }

  if (/^(xin chào|chào shop|hello|hi|alo)$/.test(text) || /^(shop ơi|shop)([\s.!?,~…]+)?$/.test(text)) {
    return buildResult('greeting_or_opening', 'low', false, 0.95, [], 'matched_opening_rule', ['faq', 'opening']);
  }

  return buildResult('unknown', 'medium', true, 0.45, [], 'fallback_unknown_case', ['unknown', 'needs_review']);
}

export function isLowRiskCase(caseType) {
  return LOW_RISK_CASES.has(caseType);
}

export function isForcedHandoffCase(caseType) {
  return HANDOFF_CASES.has(caseType);
}

function buildResult(caseType, riskLevel, needsHuman, confidence, missingInfo, reason, suggestedTags) {
  return {
    case_type: caseType,
    risk_level: riskLevel,
    needs_human: needsHuman,
    auto_reply_allowed: LOW_RISK_CASES.has(caseType) && !needsHuman,
    confidence,
    missing_info: missingInfo,
    reason,
    suggested_tags: suggestedTags
  };
}
