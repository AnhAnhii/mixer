import { extractWebhookEventPairs } from './normalize.js';
import { classifyMessage } from './classify.js';
import { buildGroundedInput } from './grounding.js';
import { generateDraft } from './ai-draft.js';
import { applyPolicyGuard } from './guard.js';
import { appendAuditLog, appendPendingHandoff, appendRawEventLog, buildPendingHandoffRecord } from './store.js';
import { sendFacebookMessage } from './facebook-send.js';
import { buildMessageKey, createMessageDeduper } from './idempotency.js';
import { createThreadStateStore } from './thread-state.js';
import { notifyTelegramDraft } from './telegram-notify.js';

const DEFAULT_PIPELINE_VERSION = '0.1.0';

export async function processWebhookBody(body, options = {}) {
  const eventPairs = extractWebhookEventPairs(body);
  const outputs = [];
  const deduper = options.deduper || createMessageDeduper(options);
  const threadStateStore = options.threadStateStore || createThreadStateStore(options);
  const allowedPageIds = readAllowedPageIds(options.allowedPageIds, process.env.FB_ALLOWED_PAGE_IDS || process.env.FB_PAGE_ID);

  for (const { normalized: normalizedMessage, raw: rawEvent } of eventPairs) {
    const rawLogPath = appendRawEventLog(rawEvent, options.rawEventLogPath);
    logPipelineStage('RAW FACEBOOK EVENT', summarizeRawEvent(rawEvent));
    logPipelineStage('NORMALIZED MESSAGE', summarizeNormalizedMessage(normalizedMessage));

    if (normalizedMessage.event_type !== 'message') {
      const ignoreRecord = buildIgnoredEventRecord(normalizedMessage, options);
      logPipelineStage('PIPELINE DECISION', summarizeDecision(ignoreRecord, normalizedMessage));
      const logPath = appendAuditLog(ignoreRecord, options.logPath);
      outputs.push({ ...ignoreRecord, log_path: logPath, raw_log_path: rawLogPath, handoff_path: null });
      continue;
    }

    if (!isAllowedPage(normalizedMessage.page_id, allowedPageIds)) {
      const ignoreRecord = {
        logged_at: new Date().toISOString(),
        processing_meta: buildProcessingMeta(options),
        normalized_message: normalizedMessage,
        delivery: {
          decision: 'ignore',
          reason: 'page_not_allowed',
          allowed_page_ids: allowedPageIds ? [...allowedPageIds] : null
        },
        send_result: {
          attempted: false,
          status: 'ignored_page',
          reason: 'page_not_allowed'
        }
      };

      const logPath = appendAuditLog(ignoreRecord, options.logPath);
      outputs.push({ ...ignoreRecord, log_path: logPath, raw_log_path: rawLogPath, handoff_path: null });
      continue;
    }

    const dedupeKey = buildMessageKey(normalizedMessage);
    if (dedupeKey && deduper.has(dedupeKey)) {
      const duplicateRecord = {
        logged_at: new Date().toISOString(),
        processing_meta: buildProcessingMeta(options),
        normalized_message: normalizedMessage,
        delivery: {
          decision: 'ignore',
          reason: 'duplicate_message',
          dedupe_key: dedupeKey
        },
        send_result: {
          attempted: false,
          status: 'duplicate_ignored',
          reason: 'duplicate_message'
        }
      };

      logPipelineStage('PIPELINE DECISION', summarizeDecision(duplicateRecord, normalizedMessage));
      const logPath = appendAuditLog(duplicateRecord, options.logPath);
      outputs.push({ ...duplicateRecord, log_path: logPath, raw_log_path: rawLogPath, handoff_path: null });
      continue;
    }

    const triage = classifyMessage(normalizedMessage);
    const groundedInput = buildGroundedInput(normalizedMessage, triage, options.recentMessages || []);
    const { draft, meta } = await generateDraft(groundedInput);
    const guarded = applyPolicyGuard(normalizedMessage, triage, draft, {
      ...options,
      threadStateStore
    });
    const sendResult = await maybeDeliverMessage(normalizedMessage, guarded, options);

    const record = {
      logged_at: new Date().toISOString(),
      processing_meta: buildProcessingMeta(options, meta),
      normalized_message: normalizedMessage,
      triage,
      grounded_input: groundedInput,
      ai_meta: meta,
      ai_draft: draft,
      ...guarded,
      send_result: sendResult
    };

    logPipelineStage('PIPELINE DECISION', summarizeDecision(record, normalizedMessage));
    const logPath = appendAuditLog(record, options.logPath);
    if (dedupeKey) {
      deduper.mark(dedupeKey, {
        thread_key: normalizedMessage.thread_key,
        message_id: normalizedMessage.message_id,
        decision: record.delivery.decision
      });
    }

    let handoffPath = null;

    const telegramNotifyResult = await maybeNotifyTelegram(record, options);
    console.log('TELEGRAM NOTIFY RESULT', JSON.stringify({
      message_id: normalizedMessage.message_id || null,
      decision: record?.delivery?.decision || null,
      result: telegramNotifyResult || null
    }));

    if (telegramNotifyResult?.status === 'failed') {
      console.error('fanpage-bot telegram notify failed', telegramNotifyResult);
    }

    if (sendResult.status === 'sent') {
      threadStateStore.markAutoSend(normalizedMessage.thread_key, {
        sentAt: normalizeMessageTimestamp(normalizedMessage.timestamp),
        caseType: triage.case_type,
        messageId: normalizedMessage.message_id,
        replyText: guarded.guarded_draft.reply_text
      });
    }

    if (shouldQueuePendingHandoff(record)) {
      const pendingRecord = buildPendingHandoffRecord({
        normalizedMessage,
        triage,
        guarded,
        sendResult,
        processingMeta: record.processing_meta
      });
      handoffPath = appendPendingHandoff(pendingRecord, options.handoffPath);
    }

    outputs.push({ ...record, log_path: logPath, raw_log_path: rawLogPath, handoff_path: handoffPath, telegram_notify_result: telegramNotifyResult });
  }

  return outputs;
}

function shouldQueuePendingHandoff(record) {
  return ['handoff', 'draft_only'].includes(record.delivery.decision) || record.send_result?.status === 'failed';
}

async function maybeDeliverMessage(normalizedMessage, guarded, options) {
  if (guarded.delivery.decision !== 'auto_send') {
    return {
      attempted: false,
      status: 'not_sent',
      reason: guarded.delivery.decision
    };
  }

  try {
    const response = await sendFacebookMessage({
      recipientId: normalizedMessage.sender_psid,
      messageText: guarded.guarded_draft.reply_text,
      pageAccessToken: options.pageAccessToken,
      fetchImpl: options.fetchImpl,
      markSeenBeforeReply: options.markSeenBeforeReply
    });

    return {
      attempted: true,
      status: 'sent',
      ...response
    };
  } catch (error) {
    return {
      attempted: true,
      status: 'failed',
      error: String(error.message || error),
      error_status: error.status || null,
      error_body: error.responseBody || null,
      attempts: error.attempts || 1,
      retried: Boolean(error.retried)
    };
  }
}

function normalizeMessageTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return new Date().toISOString();
  }

  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  return new Date(millis).toISOString();
}

function readAllowedPageIds(explicitValue, envValue) {
  if (explicitValue instanceof Set) {
    return explicitValue.size ? explicitValue : null;
  }

  if (Array.isArray(explicitValue)) {
    const values = explicitValue.map((value) => String(value).trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }

  if (typeof explicitValue === 'string') {
    const values = explicitValue.split(',').map((value) => value.trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }

  if (typeof envValue === 'string') {
    const values = envValue.split(',').map((value) => value.trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }

  return null;
}

function isAllowedPage(pageId, allowedPageIds) {
  if (!allowedPageIds) {
    return true;
  }

  if (!pageId) {
    return false;
  }

  return allowedPageIds.has(String(pageId));
}

function buildIgnoredEventRecord(normalizedMessage, options = {}) {
  const reasonMap = {
    postback: 'postback_ignored',
    echo: 'echo_ignored',
    read: 'read_ignored',
    delivery: 'delivery_ignored',
    optin: 'optin_ignored',
    referral: 'referral_ignored',
    account_linking: 'account_linking_ignored',
    unknown: 'unknown_event_ignored'
  };

  const reason = reasonMap[normalizedMessage.event_type] || 'unsupported_event_ignored';

  return {
    logged_at: new Date().toISOString(),
    processing_meta: buildProcessingMeta(options),
    normalized_message: normalizedMessage,
    delivery: {
      decision: 'ignore',
      reason
    },
    send_result: {
      attempted: false,
      status: 'ignored_event',
      reason
    }
  };
}

function buildProcessingMeta(options = {}, aiMeta = {}) {
  return {
    pipeline_version:
      options.pipelineVersion ||
      process.env.FANPAGE_BOT_PIPELINE_VERSION ||
      DEFAULT_PIPELINE_VERSION,
    policy_version:
      options.policyVersion ||
      process.env.FANPAGE_BOT_POLICY_VERSION ||
      'mixer-reply-policy-v1',
    prompt_version:
      options.promptVersion ||
      process.env.FANPAGE_BOT_PROMPT_VERSION ||
      'mixer-grounded-ai-prompt-v1',
    grounded_data_version:
      options.groundedDataVersion ||
      process.env.FANPAGE_BOT_GROUNDED_DATA_VERSION ||
      'mixer-grounded-ai-data-v1',
    ai_mode: aiMeta?.source || 'n/a',
    ai_model: aiMeta?.model || process.env.OPENAI_MODEL || null
  };
}


function logPipelineStage(label, payload) {
  try {
    console.log(label, JSON.stringify(payload));
  } catch {
    console.log(label, payload);
  }
}

function summarizeRawEvent(rawEvent) {
  return {
    object: rawEvent?.object || null,
    page_id: rawEvent?.entry?.[0]?.id || rawEvent?.page_id || null,
    event_type: detectRawEventType(rawEvent),
    sender_psid: rawEvent?.entry?.[0]?.messaging?.[0]?.sender?.id || null,
    recipient_psid: rawEvent?.entry?.[0]?.messaging?.[0]?.recipient?.id || null,
    message_mid: rawEvent?.entry?.[0]?.messaging?.[0]?.message?.mid || null,
    text_preview: truncateText(rawEvent?.entry?.[0]?.messaging?.[0]?.message?.text || null)
  };
}

function summarizeNormalizedMessage(normalizedMessage) {
  return {
    event_type: normalizedMessage?.event_type || null,
    page_id: normalizedMessage?.page_id || null,
    thread_key: normalizedMessage?.thread_key || null,
    sender_psid: normalizedMessage?.sender_psid || null,
    message_id: normalizedMessage?.message_id || null,
    text_preview: truncateText(normalizedMessage?.text || null),
    has_attachments: Array.isArray(normalizedMessage?.attachments) && normalizedMessage.attachments.length > 0
  };
}

function summarizeDecision(record, normalizedMessage) {
  return {
    event_type: normalizedMessage?.event_type || null,
    message_id: normalizedMessage?.message_id || null,
    page_id: normalizedMessage?.page_id || null,
    text_preview: truncateText(normalizedMessage?.text || null),
    case_type: record?.triage?.case_type || null,
    risk_level: record?.triage?.risk_level || null,
    decision: record?.delivery?.decision || null,
    reason: record?.delivery?.reason || record?.send_result?.reason || null,
    send_status: record?.send_result?.status || null
  };
}

function detectRawEventType(rawEvent) {
  const messaging = rawEvent?.entry?.[0]?.messaging?.[0];
  if (!messaging) return null;
  if (messaging.message?.is_echo) return 'echo';
  if (messaging.message) return 'message';
  if (messaging.postback) return 'postback';
  if (messaging.delivery) return 'delivery';
  if (messaging.read) return 'read';
  if (messaging.optin) return 'optin';
  if (messaging.referral) return 'referral';
  if (messaging.account_linking) return 'account_linking';
  return 'unknown';
}

function truncateText(text, maxLength = 120) {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}


async function maybeNotifyTelegram(record, options) {
  try {
    return await notifyTelegramDraft(record, options);
  } catch (error) {
    return {
      attempted: true,
      status: 'failed',
      error: String(error.message || error)
    };
  }
}
