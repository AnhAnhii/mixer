export async function notifyTelegramDraft(record, options = {}) {
  const enabled = readBool(options.enabled, process.env.TELEGRAM_DRAFT_NOTIFICATIONS_ENABLED, true);
  if (!enabled) {
    return { attempted: false, status: 'disabled' };
  }

  const botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return { attempted: false, status: 'missing_config' };
  }

  const decision = record?.delivery?.decision || null;
  const allowedDecisions = readAllowedDecisions(options.allowedDecisions, process.env.TELEGRAM_NOTIFY_DECISIONS);
  if (allowedDecisions && !allowedDecisions.has(decision)) {
    return { attempted: false, status: 'decision_filtered', decision };
  }

  const message = buildTelegramSummary(record);
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    return {
      attempted: true,
      status: 'failed',
      http_status: response.status,
      error: payload?.description || 'telegram_send_failed'
    };
  }

  return {
    attempted: true,
    status: 'sent',
    message_id: payload?.result?.message_id || null,
    chat_id: payload?.result?.chat?.id || null
  };
}

function buildTelegramSummary(record) {
  const normalized = record?.normalized_message || {};
  const triage = record?.triage || {};
  const guarded = record?.guarded_draft || {};
  const delivery = record?.delivery || {};
  const sendResult = record?.send_result || {};
  const text = normalized.text || '(trống)';
  const draft = guarded.reply_text || '(không có draft)';
  const decisionLine = summarizeDecision(delivery.decision, delivery.reason || sendResult.reason);
  const supportLine = summarizeSupportWindow(delivery);
  const missingInfo = formatList(guarded.missing_info);
  const flags = formatList(guarded.safety_flags);
  const policyRefs = formatList(guarded.policy_refs);

  const lines = [
    '<b>📩 Fanpage draft update</b>',
    '',
    '<b>Khách nhắn</b>',
    escapeHtml(truncate(text, 600)),
    '',
    '<b>Bot dự kiến trả lời</b>',
    escapeHtml(truncate(draft, 900)),
    '',
    `<b>Case</b>: <code>${escapeHtml(triage.case_type || 'n/a')}</code>`,
    `<b>Risk</b>: <code>${escapeHtml(triage.risk_level || 'n/a')}</code>`,
    `<b>Quyết định</b>: ${escapeHtml(decisionLine)}`
  ];

  if (supportLine) {
    lines.push(`<b>Khung giờ hỗ trợ</b>: ${escapeHtml(supportLine)}`);
  }

  if (missingInfo) {
    lines.push(`<b>Còn thiếu</b>: ${escapeHtml(missingInfo)}`);
  }

  if (flags) {
    lines.push(`<b>Cờ an toàn</b>: ${escapeHtml(flags)}`);
  }

  if (policyRefs) {
    lines.push(`<b>Policy refs</b>: ${escapeHtml(policyRefs)}`);
  }

  if (normalized.message_id) {
    lines.push(`<b>MID</b>: <code>${escapeHtml(normalized.message_id)}</code>`);
  }

  return lines.join('\n');
}

function summarizeDecision(decision, reason) {
  const map = {
    draft_only: 'draft_only — chờ Saram duyệt/gửi tay',
    handoff: 'handoff — nên để người xử lý',
    would_auto_send: 'would_auto_send — đủ điều kiện nhưng đang shadow mode',
    auto_send: 'auto_send — đã cho phép gửi thật',
    ignore: 'ignore — bỏ qua event không cần xử lý'
  };

  const base = map[decision] || (decision || 'n/a');
  if (!reason || reason === decision) {
    return base;
  }

  return `${base} (${reason})`;
}

function summarizeSupportWindow(delivery) {
  if (delivery?.within_support_hours == null) {
    return null;
  }

  return delivery.within_support_hours
    ? 'đang trong giờ hỗ trợ'
    : 'ngoài giờ hỗ trợ';
}

function formatList(value) {
  if (!Array.isArray(value) || !value.length) {
    return null;
  }

  return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readBool(explicitValue, envValue, defaultValue) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  if (typeof envValue === 'string') return envValue.toLowerCase() === 'true';
  return defaultValue;
}

function readAllowedDecisions(explicitValue, envValue) {
  if (explicitValue instanceof Set) return explicitValue.size ? explicitValue : null;
  if (Array.isArray(explicitValue)) {
    const values = explicitValue.map((v) => String(v).trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }
  if (typeof explicitValue === 'string') {
    const values = explicitValue.split(',').map((v) => v.trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }
  if (typeof envValue === 'string') {
    const values = envValue.split(',').map((v) => v.trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }
  return new Set(['draft_only', 'handoff', 'would_auto_send']);
}

function truncate(text, max = 280) {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
