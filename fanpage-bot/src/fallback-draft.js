export function buildFallbackDraft(triage) {
  switch (triage.case_type) {
    case 'greeting_or_opening':
      return draft('Dạ chào bạn nha, bạn cần Mixer hỗ trợ gì thì nhắn mình biết nhé ✨', 'draft_only', 0.94, false, [], 'faq_answer_from_grounding', ['opening_macro'], []);
    case 'shipping_eta_general':
      return draft('Dạ bên mình giao hàng dự kiến khoảng 2-5 ngày với khu vực miền Bắc và 5-7 ngày với miền Trung hoặc miền Nam bạn nhé. Nếu quá thời gian dự kiến mà bạn chưa nhận được hàng thì nhắn lại Mixer để mình kiểm tra thêm cho bạn nha.', 'draft_only', 0.91, false, [], 'faq_answer_from_grounding', ['shipping_eta_policy'], []);
    case 'shipping_carrier':
      return draft('Dạ bên mình hiện gửi hàng qua Viettel Post bạn nha.', 'draft_only', 0.92, false, [], 'faq_answer_from_grounding', ['carrier_policy'], []);
    case 'support_hours':
      return draft('Dạ Mixer hỗ trợ trong khung giờ 08:00-23:00 hằng ngày bạn nhé.', 'draft_only', 0.93, false, [], 'faq_answer_from_grounding', ['support_hours_policy'], []);
    case 'order_status_request':
      return draft('Dạ bạn gửi giúp mình mã đơn để Mixer kiểm tra tình trạng đơn hàng cho bạn nhanh hơn nha.', 'handoff', 0.9, true, ['order_code'], 'requires_internal_order_check', ['order_check_macro'], ['requires_internal_data']);
    case 'exchange_return_specific':
      return draft('Dạ bạn giúp mình gửi mã đơn và tình trạng sản phẩm cụ thể để Mixer kiểm tra rồi hỗ trợ bạn nhanh nhất nha.', 'handoff', 0.88, true, ['order_code', 'product_issue_detail'], 'defect_case_needs_human', ['exchange_defect_policy'], ['policy_risk']);
    case 'stock_or_product_availability':
      return draft('Dạ bạn gửi giúp mình tên sản phẩm kèm size hoặc màu bạn cần để Mixer kiểm tra tồn kho cho bạn nha.', 'handoff', 0.78, true, ['product_name', 'size_or_variant'], 'requires_stock_verification', [], ['stock_unverified']);
    case 'complaint_or_negative_feedback':
      return draft('Dạ Mixer xin lỗi bạn vì trải nghiệm chưa tốt. Bạn giúp mình gửi thêm tình huống cụ thể hoặc mã đơn để bên mình kiểm tra và hỗ trợ bạn kỹ hơn nha.', 'handoff', 0.92, true, [], 'negative_feedback_needs_human', [], ['negative_sentiment', 'policy_risk']);
    default:
      return draft('Dạ bạn đợi mình kiểm tra thêm thông tin rồi phản hồi bạn ngay nha.', 'handoff', 0.4, true, triage.missing_info || [], 'insufficient_information', [], ['needs_review']);
  }
}

function draft(replyText, action, confidence, needsHuman, missingInfo, reason, policyRefs, safetyFlags) {
  return {
    reply_text: replyText,
    action,
    confidence,
    needs_human: needsHuman,
    missing_info: missingInfo,
    reason,
    policy_refs: policyRefs,
    safety_flags: safetyFlags
  };
}
