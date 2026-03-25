import fs from 'node:fs';
import path from 'node:path';
import { resolveWritableDataPath } from './runtime-paths.js';

const DEFAULT_MAX_THREADS = 5000;
const DEFAULT_SENTIMENT_WINDOW = 6;

export function createThreadStateStore(options = {}) {
  const storePath = options.threadStatePath
    || process.env.THREAD_STATE_STORE_PATH
    || resolveWritableDataPath('data/logs/thread-state.json');
  const maxThreads = Number(options.threadStateMaxThreads ?? process.env.THREAD_STATE_MAX_THREADS ?? DEFAULT_MAX_THREADS);
  const sentimentWindow = Number(options.threadSentimentWindow ?? process.env.THREAD_STATE_SENTIMENT_WINDOW ?? DEFAULT_SENTIMENT_WINDOW);

  let loaded = false;
  let state = {};

  function ensureLoaded() {
    if (loaded) return;
    loaded = true;

    if (!fs.existsSync(storePath)) {
      state = {};
      return;
    }

    try {
      state = JSON.parse(fs.readFileSync(storePath, 'utf8')) || {};
    } catch {
      state = {};
    }
  }

  function persist() {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(trimState(state, maxThreads), null, 2), 'utf8');
  }

  function getThreadEntry(threadKey) {
    ensureLoaded();
    if (!threadKey) return null;
    return state[threadKey] || null;
  }

  return {
    get(threadKey) {
      return getThreadEntry(threadKey);
    },
    getMemory(threadKey) {
      return normalizeThreadMemorySnapshot(getThreadEntry(threadKey));
    },
    markAutoSend(threadKey, payload = {}) {
      ensureLoaded();
      if (!threadKey) return null;

      const previous = state[threadKey] || {};
      state[threadKey] = {
        ...previous,
        thread_key: threadKey,
        last_auto_sent_at: payload.sentAt || new Date().toISOString(),
        last_case_type: payload.caseType || previous.last_case_type || null,
        last_message_id: payload.messageId || previous.last_message_id || null,
        last_reply_text: payload.replyText || previous.last_reply_text || null,
        updated_at: new Date().toISOString()
      };

      persist();
      return state[threadKey];
    },
    updateMemory(threadKey, payload = {}) {
      ensureLoaded();
      if (!threadKey) return null;

      const previous = state[threadKey] || {};
      const previousMemory = normalizeThreadMemorySnapshot(previous);
      const nextMemory = buildNextThreadMemory(previousMemory, payload, sentimentWindow);

      state[threadKey] = {
        ...previous,
        thread_key: threadKey,
        thread_memory: nextMemory,
        updated_at: new Date().toISOString()
      };

      persist();
      return state[threadKey];
    }
  };
}

function buildNextThreadMemory(previousMemory, payload, sentimentWindow) {
  const normalizedMessage = payload.normalizedMessage || {};
  const triage = payload.triage || {};
  const guarded = payload.guarded || {};
  const draft = guarded.guarded_draft || payload.draft || {};
  const delivery = guarded.delivery || payload.delivery || {};
  const providedSlots = detectProvidedSlots(normalizedMessage, previousMemory, triage, draft);

  const inferredSentiment = coerceSentiment(
    payload.sentiment,
    draft.understanding?.sentiment,
    previousMemory.current_customer_sentiment,
    triage.case_type === 'complaint_or_negative_feedback' ? 'frustrated' : null,
    'neutral'
  );

  const sentimentHistory = [...(previousMemory.sentiment_trend?.recent || []), inferredSentiment]
    .filter(Boolean)
    .slice(-Math.max(1, sentimentWindow));

  const askedSlots = deriveAskedSlots(payload, previousMemory, providedSlots);
  const promisedFollowUp = derivePromisedFollowUp(payload, previousMemory);
  const unresolvedAskedSlots = askedSlots.filter((item) => item.status !== 'resolved');
  const waitingForCustomer = unresolvedAskedSlots.length > 0;
  const deliveryDecision = typeof delivery.decision === 'string' ? delivery.decision : null;

  return {
    active_issue: {
      case_type: triage.case_type || previousMemory.active_issue?.case_type || null,
      status: waitingForCustomer ? 'awaiting_customer_info' : deriveIssueStatus(deliveryDecision, triage, previousMemory),
      since_message_id: previousMemory.active_issue?.since_message_id || normalizedMessage.message_id || null,
      updated_at: new Date().toISOString(),
      summary: summarizeActiveIssue(triage.case_type, unresolvedAskedSlots, draft.reason || triage.reason)
    },
    asked_slots: askedSlots,
    promised_follow_up: promisedFollowUp,
    current_customer_sentiment: inferredSentiment,
    sentiment_trend: {
      recent: sentimentHistory,
      direction: deriveSentimentDirection(sentimentHistory)
    },
    last_assistant_action: {
      action: draft.action || deliveryDecision || null,
      delivery_decision: deliveryDecision,
      strategy: draft.decision?.strategy || draft.response_strategy || null,
      reason: draft.reason || draft.decision?.reason || null,
      reply_preview: truncateText(draft.reply_text || draft.reply?.reply_text || null, 160),
      at: new Date().toISOString()
    },
    pending_customer_reply: waitingForCustomer,
    updated_at: new Date().toISOString()
  };
}

function deriveAskedSlots(payload, previousMemory, providedSlots = {}) {
  const guarded = payload.guarded || {};
  const draft = guarded.guarded_draft || payload.draft || {};
  const triage = payload.triage || {};
  const missingInfo = normalizeArray(draft.missing_info || triage.missing_info || []);
  const action = String(draft.action || '').trim();
  const now = new Date().toISOString();
  const previousSlots = normalizeAskedSlots(previousMemory.asked_slots || []);
  const canRefreshRequests = ['handoff', 'draft_only', 'ask_for_info', 'would_auto_send', 'auto_send'].includes(action) || draft.needs_human;

  const slotMap = new Map(previousSlots.map((item) => [item.slot, { ...item }]));

  for (const [slot, value] of Object.entries(providedSlots || {})) {
    if (!value) continue;
    const previous = slotMap.get(slot) || { slot, requested_at: null, reason: null };
    slotMap.set(slot, {
      ...previous,
      slot,
      status: 'resolved',
      resolved_at: now,
      resolved_value_preview: truncateText(String(value), 40)
    });
  }

  if (canRefreshRequests) {
    for (const slot of missingInfo) {
      if (!slot) continue;
      if (providedSlots?.[slot]) {
        continue;
      }

      const previous = slotMap.get(slot);
      slotMap.set(slot, {
        slot,
        status: previous?.status === 'resolved' ? 'requested' : (previous?.status || 'requested'),
        requested_at: previous?.requested_at || now,
        reason: draft.reason || triage.reason || previous?.reason || null,
        resolved_at: previous?.status === 'resolved' ? null : previous?.resolved_at || null,
        resolved_value_preview: previous?.status === 'resolved' ? null : previous?.resolved_value_preview || null
      });
    }
  }

  const unresolved = [];
  const resolved = [];
  for (const item of slotMap.values()) {
    if (!item?.slot) continue;
    if (item.status === 'resolved') {
      resolved.push(item);
    } else {
      unresolved.push({
        slot: item.slot,
        status: 'requested',
        requested_at: item.requested_at || now,
        reason: item.reason || draft.reason || triage.reason || null,
        resolved_at: null,
        resolved_value_preview: null
      });
    }
  }

  return [...unresolved, ...resolved].slice(-8);
}

function derivePromisedFollowUp(payload, previousMemory) {
  const guarded = payload.guarded || {};
  const draft = guarded.guarded_draft || payload.draft || {};
  const delivery = guarded.delivery || payload.delivery || {};
  const previousPromises = Array.isArray(previousMemory.promised_follow_up) ? previousMemory.promised_follow_up : [];
  const replyText = String(draft.reply_text || draft.reply?.reply_text || '').trim();
  if (!replyText) {
    return previousPromises;
  }

  const promiseMatchers = [
    {
      id: 'order_check_followup',
      pattern: /(kiểm tra|check).*(mã đơn|đơn|giúp mình|giúp anh|giúp chị)|bên em kiểm tra/i,
      summary: 'assistant_promised_order_check'
    },
    {
      id: 'support_followup',
      pattern: /(hỗ trợ|xử lý).*(giúp|mình|anh|chị)|bên em hỗ trợ/i,
      summary: 'assistant_promised_support_followup'
    },
    {
      id: 'update_followup',
      pattern: /(phản hồi|báo lại|cập nhật)/i,
      summary: 'assistant_promised_update'
    }
  ];

  const detected = promiseMatchers
    .filter((entry) => entry.pattern.test(replyText))
    .map((entry) => ({
      promise_id: entry.id,
      summary: entry.summary,
      source_action: draft.action || delivery.decision || null,
      status: 'open',
      created_at: new Date().toISOString()
    }));

  const merged = [...previousPromises.filter((item) => item?.status !== 'resolved')];
  for (const item of detected) {
    if (!merged.some((existing) => existing?.promise_id === item.promise_id && existing?.status === 'open')) {
      merged.push(item);
    }
  }

  return merged.slice(-5);
}

function deriveIssueStatus(deliveryDecision, triage, previousMemory) {
  if (deliveryDecision === 'handoff') return 'handoff_recommended';
  if (deliveryDecision === 'auto_send' || deliveryDecision === 'would_auto_send') return 'replied';
  if (triage.needs_human) return 'needs_review';
  return previousMemory.active_issue?.status || 'open';
}

function summarizeActiveIssue(caseType, askedSlots, reason) {
  const base = caseType || 'unknown_issue';
  if (askedSlots.length) {
    return `${base}: waiting_for_${askedSlots.map((item) => item.slot).join(', ')}`;
  }
  return reason ? `${base}: ${reason}` : base;
}

function normalizeThreadMemorySnapshot(entry) {
  const memory = entry?.thread_memory || {};
  return {
    active_issue: memory.active_issue || null,
    asked_slots: normalizeAskedSlots(memory.asked_slots || []),
    promised_follow_up: normalizePromiseList(memory.promised_follow_up || []),
    current_customer_sentiment: coerceSentiment(memory.current_customer_sentiment, null, 'neutral'),
    sentiment_trend: {
      recent: normalizeArray(memory.sentiment_trend?.recent || []).map((item) => coerceSentiment(item, null, 'neutral')),
      direction: memory.sentiment_trend?.direction || 'stable'
    },
    last_assistant_action: memory.last_assistant_action || null,
    pending_customer_reply: Boolean(memory.pending_customer_reply),
    updated_at: memory.updated_at || null
  };
}

function normalizeAskedSlots(items) {
  return normalizeArray(items).map((item) => {
    if (typeof item === 'string') {
      return {
        slot: item,
        status: 'requested',
        requested_at: null,
        reason: null,
        resolved_at: null,
        resolved_value_preview: null
      };
    }
    return {
      slot: item?.slot || null,
      status: item?.status || 'requested',
      requested_at: item?.requested_at || null,
      reason: item?.reason || null,
      resolved_at: item?.resolved_at || null,
      resolved_value_preview: item?.resolved_value_preview || null
    };
  }).filter((item) => item.slot);
}

function normalizePromiseList(items) {
  return normalizeArray(items).map((item) => ({
    promise_id: item?.promise_id || null,
    summary: item?.summary || null,
    source_action: item?.source_action || null,
    status: item?.status || 'open',
    created_at: item?.created_at || null
  })).filter((item) => item.promise_id || item.summary);
}

function detectProvidedSlots(normalizedMessage, previousMemory, triage, draft) {
  const text = String(normalizedMessage?.text || '').trim();
  if (!text) {
    return {};
  }

  const slotsToCheck = new Set([
    ...normalizeAskedSlots(previousMemory?.asked_slots || []).map((item) => item.slot),
    ...normalizeArray(draft?.missing_info || triage?.missing_info || [])
  ]);

  const detected = {};
  for (const slot of slotsToCheck) {
    const value = extractSlotValue(slot, text);
    if (value) {
      detected[slot] = value;
    }
  }

  return detected;
}

function extractSlotValue(slot, text) {
  const compactText = String(text || '').trim();
  if (!compactText) return null;

  switch (slot) {
    case 'order_code':
      return extractOrderCode(compactText);
    case 'phone':
    case 'receiver_phone':
      return extractPhoneNumber(compactText);
    default:
      return null;
  }
}

function extractOrderCode(text) {
  const directMatch = text.match(/(?:mã\s*đơn|madon|ma don|order\s*code|mã\s*vận\s*đơn|tracking\s*code)\s*[:#\-]?\s*([a-z0-9][a-z0-9\-_.]{4,})/iu);
  if (directMatch?.[1]) {
    return sanitizeOrderCode(directMatch[1]);
  }

  const compactOnlyCode = text.replace(/\s+/g, ' ').trim();
  if (/^[a-z0-9\-_.]{5,20}$/iu.test(compactOnlyCode) && /[a-z]/iu.test(compactOnlyCode) && /\d/.test(compactOnlyCode)) {
    return sanitizeOrderCode(compactOnlyCode);
  }

  const fallbackToken = compactOnlyCode.match(/\b([a-z]{1,6}[0-9][a-z0-9\-_.]{3,})\b/iu);
  if (fallbackToken?.[1] && !/^ship$/iu.test(fallbackToken[1])) {
    return sanitizeOrderCode(fallbackToken[1]);
  }

  return null;
}

function sanitizeOrderCode(value) {
  return String(value || '').trim().replace(/[.,;:!?]+$/g, '').slice(0, 32) || null;
}

function extractPhoneNumber(text) {
  const match = text.match(/(?:\+?84|0)(?:[\s.-]*\d){8,10}/u);
  if (!match?.[0]) {
    return null;
  }

  const digits = match[0].replace(/\D+/g, '');
  if (digits.length < 9 || digits.length > 11) {
    return null;
  }

  return digits;
}

function coerceSentiment(...values) {
  const allowed = new Set(['positive', 'neutral', 'confused', 'impatient', 'frustrated', 'angry']);
  for (const value of values) {
    if (typeof value === 'string' && allowed.has(value.trim().toLowerCase())) {
      return value.trim().toLowerCase();
    }
  }
  return 'neutral';
}

function deriveSentimentDirection(history) {
  if (!history.length) return 'stable';
  const scoreMap = {
    positive: 2,
    neutral: 0,
    confused: -1,
    impatient: -1,
    frustrated: -2,
    angry: -3
  };

  if (history.length === 1) return 'stable';

  const recentScore = scoreMap[history.at(-1)] ?? 0;
  const previousScore = scoreMap[history.at(-2)] ?? 0;
  if (recentScore < previousScore) return 'worsening';
  if (recentScore > previousScore) return 'improving';
  return 'stable';
}

function truncateText(value, maxLength) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null);
  if (value == null) return [];
  return [value];
}

function trimState(input, maxThreads) {
  const entries = Object.entries(input || {});
  if (entries.length <= maxThreads) {
    return input;
  }

  const sorted = entries.sort((a, b) => {
    const aTime = Date.parse(a[1]?.updated_at || a[1]?.last_auto_sent_at || 0) || 0;
    const bTime = Date.parse(b[1]?.updated_at || b[1]?.last_auto_sent_at || 0) || 0;
    return bTime - aTime;
  }).slice(0, maxThreads);

  return Object.fromEntries(sorted);
}
