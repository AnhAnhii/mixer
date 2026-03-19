import { ClassificationResult, DraftOutput, NormalizedMessage } from './types';

export function buildDraftOutput(
normalizedMessage: NormalizedMessage,
classification: ClassificationResult
): DraftOutput {
const text = normalizedMessage.message_text.toLowerCase().trim();

let replyText = 'Dạ bạn đợi em kiểm tra thông tin rồi phản hồi mình ngay nhé ạ.';
let action: 'draft_only' | 'handoff' = classification.needs_human ? 'handoff' : 'draft_only';

switch (classification.case_type) {
case 'greeting_or_opening':
replyText = 'Dạ em chào bạn ạ, bạn cần Mixer hỗ trợ gì cứ nhắn em nhé ✨';
action = 'draft_only';
break;

case 'shipping_eta_general':
replyText =
'Dạ thời gian giao hàng bên em thường khoảng 2-3 ngày với nội thành Hà Nội, 3-5 ngày với ngoại thành Hà Nội, và 4-7 ngày với các tỉnh/thành khác ạ. Nếu quá thời gian dự kiến bạn chưa nhận được hàng thì nhắn bên em hoặc gọi hotline 0559131315 giúp em nhé.';
action = 'draft_only';
break;

case 'shipping_carrier':
replyText = 'Dạ đơn hàng bên em hiện đang được giao qua Viettel Post ạ.';
action = 'draft_only';
break;

case 'order_status_request':
replyText = 'Dạ bạn đợi chút để mình báo nhân viên kho kiểm tra tình trạng đơn cho bạn nha.';
action = 'handoff';
break;

case 'exchange_return_specific':
replyText =
'Dạ bạn giúp em gửi mã đơn và tình trạng sản phẩm cụ thể để bên em kiểm tra và hỗ trợ mình nhanh nhất nha ạ.';
action = 'handoff';
break;

case 'stock_or_product_availability':
replyText =
'Dạ bạn giúp em gửi tên sản phẩm kèm size/màu bạn cần để bên em kiểm tra tình trạng hàng giúp mình nha ạ.';
action = 'handoff';
break;

default:
if (/giờ hỗ trợ|mấy giờ|khi nào làm việc/.test(text)) {
replyText = 'Dạ bên em hỗ trợ trong khung giờ 08:00-23:00 hằng ngày ạ.';
action = 'draft_only';
} else {
replyText = 'Dạ bạn đợi em kiểm tra thông tin rồi phản hồi mình ngay nhé ạ.';
action = 'handoff';
}
break;
}

return {
case_type: classification.case_type,
risk_level: classification.risk_level,
needs_human: classification.needs_human,
auto_reply_allowed: false,
confidence: classification.confidence,
missing_info: classification.missing_info,
reply_text: replyText,
action,
reason: classification.reason,
suggested_tags: classification.suggested_tags
};
}
