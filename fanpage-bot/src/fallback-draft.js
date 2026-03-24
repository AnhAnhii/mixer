export function buildFallbackDraft(triage) {
  switch (triage.case_type) {
    case 'greeting_or_opening':
      return draft('Dạ em chào bạn ạ, bạn cần Mixer hỗ trợ gì cứ nhắn em nhé ✨', 'draft_only', 0.94, false, [], 'faq_answer_from_grounding', ['opening_macro'], []);
    case 'shipping_eta_general':
      return draft('Dạ thời gian giao hàng bên em thường khoảng 2-3 ngày với đơn nội thành Hà Nội, 3-5 ngày với ngoại thành Hà Nội, và 4-7 ngày với các tỉnh/thành khác ạ. Nếu quá thời gian dự kiến bạn chưa nhận được hàng thì nhắn bên em hoặc gọi hotline 0559131315 giúp em nhé.', 'draft_only', 0.91, false, [], 'faq_answer_from_grounding', ['shipping_eta_policy'], []);
    case 'shipping_carrier':
      return draft('Dạ đơn hàng bên em hiện đang được giao qua Viettel Post ạ.', 'draft_only', 0.92, false, [], 'faq_answer_from_grounding', ['carrier_policy'], []);
    case 'support_hours':
      return draft('Dạ bên em hỗ trợ trong khung giờ 08:00-23:00 hằng ngày ạ.', 'draft_only', 0.93, false, [], 'faq_answer_from_grounding', ['support_hours_policy'], []);
    case 'order_status_request':
      return draft('Dạ bạn đợi chút để mình báo nhân viên kho kiểm tra tình trạng đơn cho bạn nha.', 'handoff', 0.9, true, ['order_code'], 'requires_internal_order_check', ['order_check_macro'], ['requires_internal_data']);
    case 'exchange_return_specific':
      return draft('Dạ bạn giúp em gửi mã đơn và tình trạng sản phẩm cụ thể để bên em kiểm tra và hỗ trợ mình nhanh nhất nha ạ.', 'handoff', 0.88, true, ['order_code', 'product_issue_detail'], 'defect_case_needs_human', ['exchange_defect_policy'], ['policy_risk']);
    case 'stock_or_product_availability':
      return draft('Dạ bạn giúp em gửi tên sản phẩm kèm size/màu bạn cần để bên em kiểm tra tình trạng hàng giúp mình nha ạ.', 'handoff', 0.78, true, ['product_name', 'size_or_variant'], 'requires_stock_verification', [], ['stock_unverified']);
    case 'complaint_or_negative_feedback':
      return draft('Dạ em xin lỗi bạn vì trải nghiệm chưa tốt ạ. Bạn giúp em gửi thêm tình huống cụ thể để bên em kiểm tra và hỗ trợ mình nhanh nhất nhé.', 'handoff', 0.92, true, [], 'negative_feedback_needs_human', [], ['negative_sentiment', 'policy_risk']);
    default:
      return draft('Dạ bạn đợi em kiểm tra thêm thông tin rồi phản hồi mình ngay nhé ạ.', 'handoff', 0.4, true, triage.missing_info || [], 'insufficient_information', [], ['needs_review']);
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
