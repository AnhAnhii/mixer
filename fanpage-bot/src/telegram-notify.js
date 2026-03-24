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

  const lines = [
    '📩 Fanpage draft update',
    `Khách nhắn: ${truncate(normalized.text) || '(trống)'}`,
    `Case: ${triage.case_type || 'n/a'}`,
    `Risk: ${triage.risk_level || 'n/a'}`,
    `Decision: ${delivery.decision || 'n/a'}`,
    `Reason: ${delivery.reason || sendResult.reason || 'n/a'}`,
    `Draft: ${truncate(guarded.reply_text, 500) || '(không có)'}`
  ];

  if (Array.isArray(guarded.missing_info) && guarded.missing_info.length) {
    lines.push(`Missing: ${guarded.missing_info.join(', ')}`);
  }

  if (Array.isArray(guarded.safety_flags) && guarded.safety_flags.length) {
    lines.push(`Flags: ${guarded.safety_flags.join(', ')}`);
  }

  if (normalized.message_id) {
    lines.push(`MID: ${normalized.message_id}`);
  }

  return lines.join('\n');
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
