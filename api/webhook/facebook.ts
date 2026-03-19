import type { VercelRequest, VercelResponse } from '@vercel/node';

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'mixer_verify_token_2024';

interface MessagingAttachment {
  type: string;
  payload?: {
    url?: string;
  };
}

interface MessagingMessage {
  mid?: string;
  text?: string;
  attachments?: MessagingAttachment[];
  is_echo?: boolean;
}

interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: MessagingMessage;
  postback?: {
    title?: string;
    payload?: string;
  };
}

interface WebhookEntry {
  id?: string;
  time?: number;
  messaging?: MessagingEvent[];
}

interface WebhookBody {
  object?: string;
  entry?: WebhookEntry[];
}

interface NormalizedMessage {
  page_id: string | null;
  psid: string | null;
  message_id: string | null;
  timestamp: number | null;
  message_text: string;
  attachments: MessagingAttachment[];
  event_type: 'message' | 'postback' | 'unknown';
}

interface DraftOutput {
  case_type: string;
  risk_level: 'low' | 'medium' | 'high';
  needs_human: boolean;
  auto_reply_allowed: boolean;
  confidence: number;
  missing_info: string[];
  reply_text: string;
  action: 'draft_only' | 'handoff';
  reason: string;
  suggested_tags: string[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`📥 ${req.method} /api/webhook/facebook`);

  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  if (req.method === 'POST') {
    return handleWebhookEvent(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Verification request received');
  console.log('   Mode:', mode);
  console.log('   Token matched:', token === VERIFY_TOKEN);

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.log('❌ Verification failed');
  return res.status(403).json({ error: 'Verification failed' });
}

async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
  const body = req.body as WebhookBody;

  console.log('📨 RAW FACEBOOK EVENT:');
  console.log(JSON.stringify(body, null, 2));

  if (body.object !== 'page') {
    console.log('⚠️ Unsupported object type:', body.object);
    return res.status(404).json({ error: 'Unsupported object type' });
  }

  try {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        // Bỏ qua echo message do page tự gửi
        if (event.message?.is_echo) {
          console.log('⏭️ Skip echo message');
          continue;
        }

        const normalizedMessage = normalizeMessagingEvent(entry, event);

        console.log('🧩 NORMALIZED MESSAGE:');
        console.log(JSON.stringify(normalizedMessage, null, 2));

        if (normalizedMessage.event_type === 'unknown') {
          console.log('⏭️ Unknown event type, skip draft pipeline');
          continue;
        }

        const draftOutput = buildDraftOutput(normalizedMessage);

        console.log('📝 MVP DRAFT OUTPUT:');
        console.log(JSON.stringify(draftOutput, null, 2));

        console.log('📦 PIPELINE BUNDLE:');
        console.log(JSON.stringify({
          normalizedMessage,
          draftOutput
        }, null, 2));
      }
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
  }

  return res.status(200).json({ status: 'EVENT_RECEIVED' });
}

function normalizeMessagingEvent(entry: WebhookEntry, event: MessagingEvent): NormalizedMessage {
  if (event.message) {
    return {
      page_id: entry.id || event.recipient?.id || null,
      psid: event.sender?.id || null,
      message_id: event.message.mid || null,
      timestamp: event.timestamp || null,
      message_text: event.message.text || '',
      attachments: event.message.attachments || [],
      event_type: 'message'
    };
  }

  if (event.postback) {
    return {
      page_id: entry.id || event.recipient?.id || null,
      psid: event.sender?.id || null,
      message_id: null,
      timestamp: event.timestamp || null,
      message_text: event.postback.payload || event.postback.title || '',
      attachments: [],
      event_type: 'postback'
    };
  }

  return {
    page_id: entry.id || event.recipient?.id || null,
    psid: event.sender?.id || null,
    message_id: null,
    timestamp: event.timestamp || null,
    message_text: '',
    attachments: [],
    event_type: 'unknown'
  };
}

function buildDraftOutput(normalizedMessage: NormalizedMessage): DraftOutput {
  const text = normalizedMessage.message_text.toLowerCase().trim();

  if (!text) {
    return {
      case_type: 'unknown',
      risk_level: 'low',
      needs_human: false,
      auto_reply_allowed: false,
      confidence: 0.2,
      missing_info: [],
      reply_text: '',
      action: 'draft_only',
      reason: 'empty_or_non_text_message',
      suggested_tags: ['non_text']
    };
  }

  if (/xin chào|chào shop|shop ơi|hello|hi|alo/.test(text)) {
    return {
      case_type: 'greeting_or_opening',
      risk_level: 'low',
      needs_human: false,
      auto_reply_allowed: false,
      confidence: 0.95,
      missing_info: [],
      reply_text: 'Dạ em chào bạn ạ, bạn cần Mixer hỗ trợ gì cứ nhắn em nhé ✨',
      action: 'draft_only',
      reason: 'matched_opening_rule',
      suggested_tags: ['faq', 'opening']
    };
  }

  if (/ship|giao hàng|bao lâu|mấy ngày|khi nào nhận/.test(text)) {
    return {
      case_type: 'shipping_eta_general',
      risk_level: 'low',
      needs_human: false,
      auto_reply_allowed: false,
      confidence: 0.9,
      missing_info: [],
      reply_text: 'Dạ thời gian giao hàng bên em thường khoảng 2-3 ngày với nội thành Hà Nội, 3-5 ngày với ngoại thành Hà Nội, và 4-7 ngày với các tỉnh/thành khác ạ. Nếu quá thời gian dự kiến bạn chưa nhận được hàng thì nhắn bên em hoặc gọi hotline 0559131315 giúp em nhé.',
      action: 'draft_only',
      reason: 'matched_shipping_eta_rule',
      suggested_tags: ['faq', 'shipping']
    };
  }

  if (/đổi|trả|lỗi|rách|hỏng|sai hàng|sai size/.test(text)) {
    return {
      case_type: 'exchange_return_specific',
      risk_level: 'high',
      needs_human: true,
      auto_reply_allowed: false,
      confidence: 0.88,
      missing_info: ['order_code', 'product_issue_detail'],
      reply_text: 'Dạ bạn giúp em gửi mã đơn và tình trạng sản phẩm cụ thể để bên em kiểm tra và hỗ trợ mình nhanh nhất nha ạ.',
      action: 'handoff',
      reason: 'matched_exchange_or_defect_rule',
      suggested_tags: ['exchange', 'defect', 'handoff']
    };
  }

  if (/mã đơn|kiểm tra đơn|đơn của mình|đơn đến đâu/.test(text)) {
    return {
      case_type: 'order_status_request',
      risk_level: 'medium',
      needs_human: true,
      auto_reply_allowed: false,
      confidence: 0.9,
      missing_info: ['order_code'],
      reply_text: 'Dạ bạn đợi chút để mình báo nhân viên kho kiểm tra tình trạng đơn cho bạn nha.',
      action: 'handoff',
      reason: 'matched_order_status_rule',
      suggested_tags: ['order_status', 'handoff']
    };
  }

  return {
    case_type: 'unknown',
    risk_level: 'medium',
    needs_human: true,
    auto_reply_allowed: false,
    confidence: 0.45,
    missing_info: [],
    reply_text: 'Dạ bạn đợi em kiểm tra thông tin rồi phản hồi mình ngay nhé ạ.',
    action: 'handoff',
    reason: 'fallback_unknown_case',
    suggested_tags: ['unknown', 'needs_review']
  };
}
