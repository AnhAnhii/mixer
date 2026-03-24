import { extractWebhookEventPairs } from './normalize.js';
import { classifyMessage } from './classify.js';
import { buildGroundedInput } from './grounding.js';
import { generateDraft } from './ai-draft.js';
import { applyPolicyGuard } from './guard.js';
import { appendAuditLog, appendPendingHandoff, appendRawEventLog, buildPendingHandoffRecord } from './store.js';
import { sendFacebookMessage } from './facebook-send.js';
import { buildMessageKey, createMessageDeduper } from './idempotency.js';
import { createThreadStateStore } from './thread-state.js';

const DEFAULT_PIPELINE_VERSION = '0.1.0';

export async function processWebhookBody(body, options = {}) {
  const eventPairs = extractWebhookEventPairs(body);
  const outputs = [];
  const deduper = options.deduper || createMessageDeduper(options);
  const threadStateStore = options.threadStateStore || createThreadStateStore(options);
  const allowedPageIds = readAllowedPageIds(options.allowedPageIds, process.env.FB_ALLOWED_PAGE_IDS || process.env.FB_PAGE_ID);

  for (const { normalized: normalizedMessage, raw: rawEvent } of eventPairs) {
    const rawLogPath = appendRawEventLog(rawEvent, options.rawEventLogPath);

    if (normalizedMessage.event_type !== 'message') {
      const ignoreRecord = buildIgnoredEventRecord(normalizedMessage, options);
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

    const logPath = appendAuditLog(record, options.logPath);
    if (dedupeKey) {
      deduper.mark(dedupeKey, {
        thread_key: normalizedMessage.thread_key,
        message_id: normalizedMessage.message_id,
        decision: record.delivery.decision
      });
    }

    let handoffPath = null;

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

    outputs.push({ ...record, log_path: logPath, raw_log_path: rawLogPath, handoff_path: handoffPath });
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
