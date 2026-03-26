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

  if (/(scam|lừa đảo|lừa tiền|lừa lấy tiền|fake|giả mạo|mạo danh|uy tín không|có uy tín không|có phải lừa đảo không|shop thật không|page thật không|page chính chủ không|thanh toán trước có an toàn không|chuyển khoản trước có an toàn không|ck trước có an toàn không|chuyển khoản trước có bị lừa không|đã chuyển khoản.*(chưa thấy|không thấy)|đã thanh toán.*(chưa thấy|không thấy)|bị trừ tiền|trừ tiền rồi|thanh toán lỗi nhưng bị trừ|quét qr.*(bị|mà chưa)|chuyển khoản.*nhầm|báo scam|sợ bị lừa)/.test(text)) {
    return buildResult('payment_or_scam_concern', 'high', true, 0.95, ['brief_context_of_concern_if_not_clear'], 'matched_payment_or_scam_concern_rule', ['payment_risk', 'trust_concern', 'handoff']);
  }

  if (/bực|khó chịu|thất vọng|tệ quá|quá tệ|lừa đảo|phốt|không hài lòng|bực mình|chán shop|dịch vụ chán|dịch vụ tệ|khiếu nại|complain/.test(text)) {
    return buildResult('complaint_or_negative_feedback', 'high', true, 0.92, [], 'matched_negative_feedback_rule', ['complaint', 'negative_sentiment', 'handoff']);
  }

  if (/(huỷ|hủy|cancel đơn|huy don|huy đơn|sửa đơn|đổi địa chỉ|đổi sđt|đổi số điện thoại|đổi người nhận|thay đổi địa chỉ|thay đổi số điện thoại|chỉnh địa chỉ|chỉnh sđt|chỉnh số điện thoại|chỉnh thông tin nhận hàng|đổi thông tin nhận hàng)/.test(text)) {
    return buildResult('order_modification_or_cancel', 'high', true, 0.9, ['order_code', 'requested_change'], 'matched_order_modification_or_cancel_rule', ['order_modification', 'cancel', 'handoff']);
  }

  if (looksLikeGeneralDefectPolicyQuestion(text)) {
    return buildResult('defective_product_policy_general', 'medium', false, 0.86, [], 'matched_defective_product_policy_general_rule', ['faq', 'defect_policy']);
  }

  if (looksLikeGeneralReturnPolicyQuestion(text)) {
    return buildResult('return_policy_general', 'medium', false, 0.84, [], 'matched_return_policy_general_rule', ['faq', 'returns_policy']);
  }

  if (looksLikeConcreteDefectClaim(text) || /đổi|trả|lỗi|rách|hỏng|sai hàng|sai size/.test(text)) {
    return buildResult('exchange_return_specific', 'high', true, 0.88, ['order_code', 'product_issue_detail'], 'matched_exchange_or_defect_rule', ['exchange', 'defect', 'handoff']);
  }

  if (/mã đơn|kiểm tra đơn|đơn của mình|đơn đến đâu/.test(text) || looksLikeOrderSpecificShippingQuestion(text)) {
    return buildResult('order_status_request', 'medium', true, 0.9, ['order_code'], 'matched_order_status_rule', ['order_status', 'handoff']);
  }

  if (/còn hàng|còn size|còn sz|hết hàng|available|còn không/.test(text)) {
    return buildResult('stock_or_product_availability', 'medium', true, 0.78, ['product_name', 'size_or_variant'], 'matched_stock_check_rule', ['stock', 'handoff']);
  }

  if (/giá bao nhiêu|bao nhiêu tiền|giá sao|giá ntn|giá thế nào|bao tiền|giá áo|giá quần|giá item|giá mẫu|giá sản phẩm|sale không|khuyến mãi|voucher|mã giảm giá|giảm giá|freeship|ưu đãi/.test(text)) {
    return buildResult('pricing_or_promotion', 'medium', false, 0.84, ['product_name'], 'matched_pricing_or_promotion_rule', ['pricing', 'promotion', 'buyer_intent']);
  }

  if (looksLikePaymentOrScamConcern(text)) {
    return buildResult('payment_or_scam_concern', 'high', true, 0.91, [], 'matched_payment_or_scam_concern_rule', ['payment', 'trust_safety', 'handoff']);
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

function looksLikeOrderSpecificShippingQuestion(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const hasOrderReference = /(đơn\s*(mình|em|anh|chị|của mình|của em|của anh|của chị)|đơn này|đơn đó|đơn kia|đơn rồi|đơn đang)/.test(normalized);
  const hasStatusOrEtaQuestion = /(bao lâu|mấy ngày|khi nào nhận|khi nào tới|đến chưa|tới đâu|đến đâu|đang ở đâu|bao giờ nhận)/.test(normalized);

  return hasOrderReference && hasStatusOrEtaQuestion;
}

function looksLikeGeneralReturnPolicyQuestion(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return /(chính sách đổi trả|shop có hỗ trợ đổi trả không|có hỗ trợ đổi trả không|đổi hàng trong mấy ngày|đổi trả trong mấy ngày|đổi trả sao vậy|đổi trả như nào|đổi trả thế nào)/.test(normalized)
    && !/(mã đơn|đơn của|đơn này|đơn mình|mình muốn đổi|mình muốn trả|đổi giúp|trả giúp|đổi size|trả hàng đơn|đã nhận hàng|nhận rồi)/.test(normalized);
}

function looksLikeGeneralDefectPolicyQuestion(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return /(nếu .*lỗi thì sao|hàng lỗi có được đổi không|sản phẩm lỗi shop xử lý thế nào|đồ lỗi shop xử lý sao|lỗi sản phẩm thì sao|bị lỗi có được đổi không)/.test(normalized)
    && !/(mã đơn|đơn của|đơn này|mình bị lỗi|mình nhận hàng bị|áo bị|quạt bị|rách|hỏng|sai hàng|sai size|ảnh|video)/.test(normalized);
}

function looksLikeConcreteDefectClaim(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (looksLikeGeneralDefectPolicyQuestion(normalized)) {
    return false;
  }

  const defectPatterns = [
    /\bbung\s*chỉ\b/,
    /\bsứt\s*cúc\b/,
    /\bgãy\b/,
    /\bvỡ\b/,
    /\bbể\b/,
    /\bnứt\b/,
    /\bmóp\b/,
    /\bméo\b/,
    /\btuột\b/,
    /\bkêu\s*to\b/,
    /\brung\s*mạnh\b/,
    /\bkhông\s*(lên|chạy|quay|dùng được)\b/,
    /\bđường\s*may\b/,
    /\bsứt\s*chỉ\b/
  ];

  return defectPatterns.some((pattern) => pattern.test(normalized))
    && !/(chính sách|được đổi không|xử lý thế nào|xử lý sao|thì sao)/.test(normalized);
}

function looksLikePaymentOrScamConcern(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const trustRiskPatterns = [
    /lừa(?:\s*đảo)?/,
    /scam/,
    /fake/,
    /mạo danh/,
    /giả mạo/,
    /uy tín không/,
    /có uy tín không/,
    /page này thật không/,
    /fanpage này thật không/,
    /page(?:\s*này)?\s*có\s*chính\s*thức\s*không/,
    /fanpage(?:\s*này)?\s*có\s*chính\s*thức\s*không/,
    /page chính thức/,
    /trang chính thức/,
    /có phải page thật/,
    /bill này có phải giả không/,
    /bill giả không/
  ];

  const paymentRiskPatterns = [
    /chuyển\s*khoản.*(đúng|ok|ổn|an toàn|được không)/,
    /(đúng|ok|ổn|an toàn|được không).*chuyển\s*khoản/,
    /chuyển\s*khoản\s*rồi.*(chưa thấy|không thấy|chưa lên đơn|chưa xác nhận|chưa nhận được)/,
    /đã\s*chuyển\s*khoản.*(chưa thấy|không thấy|chưa lên đơn|chưa xác nhận|chưa nhận được)/,
    /ck\s*rồi.*(chưa thấy|không thấy|chưa lên đơn|chưa xác nhận|chưa nhận được)/,
    /đã\s*ck.*(chưa thấy|không thấy|chưa lên đơn|chưa xác nhận|chưa nhận được)/,
    /cọc\s*trước/,
    /thanh\s*toán\s*trước/,
    /stk\b/,
    /số\s*tài\s*khoản/,
    /qr\s*(thanh toán|chuyển khoản|ck)?/,
    /bill\s*giả/,
    /fake\s*bill/,
    /ck\s*cho\s*shop/,
    /ck\s*trước/
  ];

  return [...trustRiskPatterns, ...paymentRiskPatterns].some((pattern) => pattern.test(normalized));
}
