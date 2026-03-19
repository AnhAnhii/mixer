import { ClassificationResult, NormalizedMessage } from './types';

export function classifyMessage(normalizedMessage: NormalizedMessage): ClassificationResult {
const text = normalizedMessage.message_text.toLowerCase().trim();

if (!text) {
return {
case_type: 'unknown',
risk_level: 'low',
needs_human: false,
confidence: 0.2,
missing_info: [],
reason: 'empty_or_non_text_message',
suggested_tags: ['non_text']
};
}

if (/xin chào|chào shop|shop ơi|hello|hi|alo/.test(text)) {
return {
case_type: 'greeting_or_opening',
risk_level: 'low',
needs_human: false,
confidence: 0.95,
missing_info: [],
reason: 'matched_opening_rule',
suggested_tags: ['faq', 'opening']
};
}

if (/ship|giao hàng|bao lâu|mấy ngày|khi nào nhận/.test(text)) {
return {
case_type: 'shipping_eta_general',
risk_level: 'low',
needs_human: false,
confidence: 0.9,
missing_info: [],
reason: 'matched_shipping_eta_rule',
suggested_tags: ['faq', 'shipping']
};
}

if (/đơn vị vận chuyển|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào/.test(text)) {
return {
case_type: 'shipping_carrier',
risk_level: 'low',
needs_human: false,
confidence: 0.92,
missing_info: [],
reason: 'matched_shipping_carrier_rule',
suggested_tags: ['faq', 'shipping']
};
}

if (/đổi|trả|lỗi|rách|hỏng|sai hàng|sai size/.test(text)) {
return {
case_type: 'exchange_return_specific',
risk_level: 'high',
needs_human: true,
confidence: 0.88,
missing_info: ['order_code', 'product_issue_detail'],
reason: 'matched_exchange_or_defect_rule',
suggested_tags: ['exchange', 'defect', 'handoff']
};
}

if (/mã đơn|kiểm tra đơn|đơn của mình|đơn đến đâu/.test(text)) {
return {
case_type: 'order_status_request',
risk_level: 'medium',
needs_human: true,
confidence: 0.9,
missing_info: ['order_code'],
reason: 'matched_order_status_rule',
suggested_tags: ['order_status', 'handoff']
};
}

if (/còn hàng|còn size|còn sz|hết hàng|available|còn không/.test(text)) {
return {
case_type: 'stock_or_product_availability',
risk_level: 'medium',
needs_human: true,
confidence: 0.78,
missing_info: ['product_name', 'size_or_variant'],
reason: 'matched_stock_check_rule',
suggested_tags: ['stock', 'handoff']
};
}

return {
case_type: 'unknown',
risk_level: 'medium',
needs_human: true,
confidence: 0.45,
missing_info: [],
reason: 'fallback_unknown_case',
suggested_tags: ['unknown', 'needs_review']
};
}
