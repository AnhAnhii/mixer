import { extractWebhookEventPairs } from './normalize.js';
import { classifyMessage } from './classify.js';
import { buildGroundedInput } from './grounding.js';
import { generateDraft } from './ai-draft.js';
import { applyPolicyGuard } from './guard.js';
import { appendAuditLog, appendPendingHandoff, appendRawEventLog, buildPendingHandoffRecord } from './store.js';
import { sendFacebookMessage } from './facebook-send.js';
import { buildMessageKey, createMessageDeduper } from './idempotency.js';
import { createThreadStateStore, detectProvidedSlots } from './thread-state.js';

const DEFAULT_PIPELINE_VERSION = '0.1.0';
const PIPELINE_DEBUG_MARKER = 'pipeline-checkpoints-v1';
const DEBUG_ENV_NAME = 'FANPAGE_BOT_DEBUG';

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

    const threadMemoryBefore = threadStateStore.getMemory(normalizedMessage.thread_key);
    const triage = recoverThreadAwareTriage(classifyMessage(normalizedMessage), threadMemoryBefore, normalizedMessage);
    const triageHint = buildTriageHint(normalizedMessage, triage);
    const groundedInput = buildGroundedInput(normalizedMessage, triage, options.recentMessages || [], {
      threadMemory: threadMemoryBefore
    });
    const groundingBundle = buildGroundingBundle(groundedInput, triageHint, threadMemoryBefore);
    const reasoningInput = buildReasoningInput(normalizedMessage, triageHint, groundingBundle);
    const { draft, meta } = await generateDraft(reasoningInput);
    const guarded = applyPolicyGuard(normalizedMessage, triage, draft, {
      ...options,
      threadStateStore
    });
    const sendResult = await maybeDeliverMessage(normalizedMessage, guarded, options);

    threadStateStore.updateMemory(normalizedMessage.thread_key, {
      normalizedMessage,
      triage,
      guarded,
      delivery: guarded.delivery,
      draft,
      sentiment: draft?.understanding?.sentiment || null
    });
    const threadMemoryAfter = threadStateStore.getMemory(normalizedMessage.thread_key);

    const record = {
      logged_at: new Date().toISOString(),
      processing_meta: buildProcessingMeta(options, meta),
      pipeline_flow: [
        'normalize',
        'triage_hint',
        'grounding_bundle',
        'ai_reasoning_draft',
        'guard',
        'audit_handoff_send'
      ],
      normalized_message: normalizedMessage,
      triage_hint: triageHint,
      triage,
      thread_memory_before: threadMemoryBefore,
      thread_memory_after: threadMemoryAfter,
      grounding_bundle: groundingBundle,
      grounded_input: groundedInput,
      ai_reasoning_input: reasoningInput,
      ai_meta: meta,
      ai_reasoning_draft: draft,
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

  logDebug('FANPAGE BOT PIPELINE CHECKPOINT', {
    marker: PIPELINE_DEBUG_MARKER,
    stage: 'PIPELINE_RETURN',
    outputs: outputs.length
  });
  return outputs;
}

function recoverThreadAwareTriage(triage, threadMemory = null, normalizedMessage = null) {
  const activeCaseType = threadMemory?.active_issue?.case_type;
  const unresolvedAskedSlots = Array.isArray(threadMemory?.asked_slots)
    ? threadMemory.asked_slots.filter((item) => item?.slot && item.status !== 'resolved').map((item) => item.slot)
    : [];
  const latestText = String(normalizedMessage?.text || '').trim();
  const isGenericFollowup = detectGenericFollowup(latestText);
  const providedSlots = detectProvidedSlots(normalizedMessage, threadMemory || {}, triage, {
    missing_info: unresolvedAskedSlots
  });
  const remainingMissingInfo = unresolvedAskedSlots.filter((slot) => !providedSlots?.[slot]);
  const hasProvidedIdentifier = Boolean(providedSlots.order_code || providedSlots.phone || providedSlots.receiver_phone);
  const isPricingContinuation = activeCaseType === 'pricing_or_promotion'
    && (threadMemory?.pending_customer_reply || unresolvedAskedSlots.length > 0 || isGenericFollowup);
  const isComplaintContinuation = activeCaseType === 'complaint_or_negative_feedback'
    && (threadMemory?.pending_customer_reply || hasProvidedIdentifier || isGenericFollowup);
  const lowRiskFaqContinuationCase = detectLowRiskFaqContinuation(activeCaseType, latestText);
  const escalatedThreadCase = detectEscalatedThreadCase(activeCaseType, latestText);

  if (escalatedThreadCase) {
    return {
      ...triage,
      case_type: escalatedThreadCase,
      risk_level: escalatedThreadCase === 'order_status_request' ? 'medium' : (triage?.risk_level || 'medium'),
      needs_human: true,
      auto_reply_allowed: false,
      confidence: Math.max(Number(triage?.confidence || 0), 0.82),
      missing_info: ['order_code'],
      reason: `cross_followup_from_${activeCaseType}_to_${escalatedThreadCase}`,
      suggested_tags: [...new Set([...(triage?.suggested_tags || []), 'thread_followup', 'cross_followup_escalation'])]
    };
  }

  if (activeCaseType === 'complaint_or_negative_feedback' && triage?.case_type === 'order_status_request' && hasProvidedIdentifier && isComplaintContinuation) {
    return {
      ...triage,
      case_type: activeCaseType,
      risk_level: 'high',
      needs_human: true,
      auto_reply_allowed: false,
      confidence: Math.max(Number(triage?.confidence || 0), 0.8),
      missing_info: remainingMissingInfo,
      reason: `followup_to_active_${activeCaseType}`,
      suggested_tags: [...new Set([...(triage?.suggested_tags || []), 'thread_followup', 'complaint_followup_continuity'])]
    };
  }

  if (triage?.case_type !== 'unknown') {
    return triage;
  }

  if (lowRiskFaqContinuationCase) {
    return {
      ...triage,
      case_type: lowRiskFaqContinuationCase,
      risk_level: 'low',
      needs_human: false,
      auto_reply_allowed: true,
      confidence: Math.max(Number(triage?.confidence || 0), 0.8),
      missing_info: [],
      reason: `followup_to_active_${activeCaseType}`,
      suggested_tags: [...new Set([...(triage?.suggested_tags || []), 'thread_followup', 'low_risk_faq_continuity'])]
    };
  }

  if (!threadMemory?.pending_customer_reply && !isPricingContinuation && !isComplaintContinuation) {
    return triage;
  }

  if (!activeCaseType || (!unresolvedAskedSlots.length && !isComplaintContinuation)) {
    return triage;
  }

  return {
    ...triage,
    case_type: activeCaseType,
    risk_level: activeCaseType === 'pricing_or_promotion' ? 'medium' : (triage?.risk_level || 'medium'),
    needs_human: activeCaseType === 'pricing_or_promotion' ? false : true,
    auto_reply_allowed: false,
    confidence: Math.max(Number(triage?.confidence || 0), activeCaseType === 'pricing_or_promotion' ? 0.78 : 0.72),
    missing_info: isComplaintContinuation ? remainingMissingInfo : unresolvedAskedSlots,
    reason: isComplaintContinuation ? `followup_to_active_${activeCaseType}` : `followup_to_pending_${activeCaseType}`,
    suggested_tags: [...new Set([...(triage?.suggested_tags || []), 'thread_followup', ...(isComplaintContinuation ? ['complaint_followup_continuity'] : ['slot_fill_expected'])])]
  };
}

function detectGenericFollowup(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return /^(dạ\s*)?(shop\s*)?(check|kiểm tra|coi|xem)(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(normalized)
    || /^(dạ\s*)?(shop\s*)?(báo|tư vấn)(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(normalized)
    || /^(dạ\s*)?(vậy|thế)(\s+(shop|bên mình|bên em))?(\s+(check|kiểm tra|báo|tư vấn))(\s+giúp)?(\s+(em|mình|anh|chị))?(\s+nha|\s+nhé|\s+ạ|\s+với)?[.!?…~]*$/iu.test(normalized);
}

function detectLowRiskFaqContinuation(activeCaseType, latestText) {
  const normalized = String(latestText || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (activeCaseType === 'shipping_eta_general') {
    if (/(đơn vị nào|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào|ship đơn vị nào|giao qua đơn vị nào|bên vận chuyển nào|ship bên nào|carrier|viettel|ghtk|ghn)/.test(normalized)) {
      return 'shipping_carrier';
    }

    if (/(hà nội|hn|nội thành|ngoại thành|tỉnh|ngoài hà nội|miền nam|miền trung|miền bắc|sài gòn|hồ chí minh|hcm|đà nẵng|cần thơ)/.test(normalized)
      || /^(còn|thế|vậy|nếu|ở)\b.*(sao|shop|ạ|nha|nhé)?/.test(normalized)) {
      return 'shipping_eta_general';
    }
  }

  if (activeCaseType === 'shipping_carrier' && /(ship|giao hàng|bao lâu|mấy ngày|khi nào nhận|hà nội|hn|nội thành|ngoại thành|tỉnh|ngoài hà nội)/.test(normalized)) {
    return 'shipping_eta_general';
  }

  return null;
}

function detectEscalatedThreadCase(activeCaseType, latestText) {
  const normalized = String(latestText || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (activeCaseType === 'shipping_eta_general' || activeCaseType === 'shipping_carrier') {
    const hasOrderReference = /(đơn\s*(mình|em|anh|chị|của mình|của em|của anh|của chị)|đơn này|đơn đó|đơn kia|đơn rồi|đơn đang)/.test(normalized);
    const hasOrderStatusAsk = /(bao lâu|mấy ngày|khi nào nhận|khi nào tới|đến chưa|tới đâu|đến đâu|đang ở đâu|bao giờ nhận|bao giờ tới|kiểm tra đơn)/.test(normalized);
    if (hasOrderReference && hasOrderStatusAsk) {
      return 'order_status_request';
    }
  }

  return null;
}

function buildTriageHint(normalizedMessage, triage) {
  return {
    case_type: triage.case_type,
    risk_level: triage.risk_level,
    needs_human: triage.needs_human,
    auto_reply_allowed: triage.auto_reply_allowed,
    confidence: triage.confidence,
    missing_info: triage.missing_info,
    reason: triage.reason,
    suggested_tags: triage.suggested_tags,
    customer_message: normalizedMessage.text || '',
    attachments_count: (normalizedMessage.attachments || []).length
  };
}

function buildGroundingBundle(groundedInput, triageHint, threadMemory = null) {
  return {
    channel: groundedInput.channel,
    customer_context: {
      page_id: groundedInput.page_id,
      psid: groundedInput.psid,
      message_id: groundedInput.message_id,
      timestamp: groundedInput.timestamp,
      latest_customer_message: groundedInput.latest_customer_message,
      recent_messages: groundedInput.recent_messages,
      thread_memory: threadMemory
    },
    triage_hint: triageHint,
    grounding: groundedInput.grounding
  };
}

function buildReasoningInput(normalizedMessage, triageHint, groundingBundle) {
  return {
    channel: normalizedMessage.source,
    message: {
      page_id: normalizedMessage.page_id,
      thread_key: normalizedMessage.thread_key,
      message_id: normalizedMessage.message_id,
      sender_psid: normalizedMessage.sender_psid,
      timestamp: normalizedMessage.timestamp,
      text: normalizedMessage.text,
      attachments_count: (normalizedMessage.attachments || []).length
    },
    triage_hint: triageHint,
    grounding_bundle: groundingBundle
  };
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
    ai_mode: aiMeta?.source || aiMeta?.provider || 'n/a',
    ai_model: aiMeta?.model || process.env.OPENAI_MODEL || null
  };
}

function logDebug(message, payload) {
  if (!isDebugEnabled()) {
    return;
  }

  console.info(message, payload);
}

function isDebugEnabled() {
  return parseBooleanEnv(process.env[DEBUG_ENV_NAME]);
}

function parseBooleanEnv(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
