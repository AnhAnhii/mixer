import { isForcedHandoffCase, isLowRiskCase } from './classify.js';

export function applyPolicyGuard(normalizedMessage, triage, aiResult, options = {}) {
  const threshold = Number(options.confidenceThreshold ?? process.env.AUTO_REPLY_CONFIDENCE_THRESHOLD ?? 0.9);
  const shadowMode = readBool(options.shadowMode, process.env.AUTO_REPLY_SHADOW_MODE, true);
  const autoReplyEnabled = readBool(options.autoReplyEnabled, process.env.AUTO_REPLY_ENABLED, false);
  const allowedCases = readAllowedCases(options.allowedCases, process.env.AUTO_REPLY_ALLOWED_CASES);
  const hasAttachments = (normalizedMessage.attachments || []).length > 0;
  const supportHours = readSupportHours(options);
  const withinSupportHours = isWithinSupportHours(normalizedMessage.timestamp, supportHours);
  const cooldownMinutes = Number(options.threadCooldownMinutes ?? process.env.AUTO_REPLY_THREAD_COOLDOWN_MINUTES ?? 15);
  const recentAutoSend = findRecentAutoSend(normalizedMessage, options.threadStateStore, cooldownMinutes);

  const guarded = {
    ...aiResult,
    action: aiResult.action || 'handoff',
    needs_human: aiResult.needs_human ?? true,
    missing_info: aiResult.missing_info || [],
    policy_refs: aiResult.policy_refs || [],
    safety_flags: [...new Set(aiResult.safety_flags || [])]
  };

  if (hasAttachments) {
    guarded.action = 'handoff';
    guarded.needs_human = true;
    guarded.safety_flags.push('attachment_present');
  }

  if (isForcedHandoffCase(triage.case_type)) {
    guarded.action = 'handoff';
    guarded.needs_human = true;
  }

  if (!isLowRiskCase(triage.case_type)) {
    guarded.action = 'handoff';
    guarded.needs_human = true;
  }

  if (Number(guarded.confidence || 0) < threshold) {
    guarded.action = 'handoff';
    guarded.needs_human = true;
    guarded.safety_flags.push('low_confidence');
  }

  if (!withinSupportHours) {
    guarded.safety_flags.push('outside_support_hours');
  }

  if (recentAutoSend) {
    guarded.safety_flags.push('thread_auto_reply_cooldown_active');
  }

  const ambiguity = detectAmbiguity(normalizedMessage, triage.case_type);
  if (ambiguity.isTooShort) {
    guarded.safety_flags.push('ambiguous_short_message');
  }

  if (ambiguity.isMultiIntent) {
    guarded.safety_flags.push('ambiguous_multi_intent');
  }

  const autoSendEligible = isAllowedAutoReplyCase(triage.case_type, allowedCases)
    && !guarded.needs_human
    && !hasAttachments
    && Number(guarded.confidence || 0) >= threshold
    && withinSupportHours
    && !recentAutoSend
    && !ambiguity.isTooShort
    && !ambiguity.isMultiIntent;

  let decision = 'handoff';
  if (autoSendEligible && autoReplyEnabled && !shadowMode) {
    decision = 'auto_send';
  } else if (autoSendEligible && shadowMode) {
    decision = 'would_auto_send';
  } else if (!guarded.needs_human) {
    decision = 'draft_only';
  }

  return {
    guarded_draft: guarded,
    delivery: {
      decision,
      auto_reply_eligible: autoSendEligible,
      auto_reply_enabled: autoReplyEnabled,
      allowed_cases: allowedCases ? [...allowedCases] : null,
      shadow_mode: shadowMode,
      confidence_threshold: threshold,
      within_support_hours: withinSupportHours,
      support_hours: supportHours,
      thread_cooldown_minutes: cooldownMinutes,
      recent_auto_send: recentAutoSend
    }
  };
}

function isAllowedAutoReplyCase(caseType, allowedCases) {
  if (!isLowRiskCase(caseType)) {
    return false;
  }

  if (!allowedCases) {
    return true;
  }

  return allowedCases.has(caseType);
}

function readAllowedCases(explicitValue, envValue) {
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

function readBool(explicitValue, envValue, defaultValue) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  if (typeof envValue === 'string') return envValue.toLowerCase() === 'true';
  return defaultValue;
}

function readSupportHours(options) {
  return {
    startHour: Number(options.supportStartHour ?? process.env.SUPPORT_WINDOW_START_HOUR ?? 8),
    endHour: Number(options.supportEndHour ?? process.env.SUPPORT_WINDOW_END_HOUR ?? 23),
    timezoneOffsetMinutes: Number(options.supportTimezoneOffsetMinutes ?? process.env.SUPPORT_TIMEZONE_OFFSET_MINUTES ?? 420)
  };
}

function isWithinSupportHours(timestamp, supportHours) {
  const ts = normalizeTimestamp(timestamp);
  if (!ts) {
    return true;
  }

  const localDate = new Date(ts + (supportHours.timezoneOffsetMinutes * 60 * 1000));
  const hour = localDate.getUTCHours();

  if (supportHours.startHour === supportHours.endHour) {
    return true;
  }

  if (supportHours.startHour < supportHours.endHour) {
    return hour >= supportHours.startHour && hour < supportHours.endHour;
  }

  return hour >= supportHours.startHour || hour < supportHours.endHour;
}

function normalizeTimestamp(timestamp) {
  if (timestamp == null) {
    return null;
  }

  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric > 1e12 ? numeric : numeric * 1000;
}

function findRecentAutoSend(normalizedMessage, threadStateStore, cooldownMinutes) {
  if (!threadStateStore || !normalizedMessage.thread_key || !(cooldownMinutes > 0)) {
    return null;
  }

  const state = threadStateStore.get(normalizedMessage.thread_key);
  if (!state?.last_auto_sent_at) {
    return null;
  }

  const lastAutoSentMs = Date.parse(state.last_auto_sent_at);
  const messageTimestamp = normalizeTimestamp(normalizedMessage.timestamp) || Date.now();
  if (!Number.isFinite(lastAutoSentMs) || !Number.isFinite(messageTimestamp)) {
    return null;
  }

  const ageMs = messageTimestamp - lastAutoSentMs;
  if (ageMs < 0 || ageMs > cooldownMinutes * 60 * 1000) {
    return null;
  }

  return {
    last_auto_sent_at: state.last_auto_sent_at,
    last_case_type: state.last_case_type || null,
    last_message_id: state.last_message_id || null,
    age_seconds: Math.round(ageMs / 1000)
  };
}

function detectAmbiguity(normalizedMessage, caseType) {
  const text = String(normalizedMessage.text || '').trim().toLowerCase();
  if (!text) {
    return { isTooShort: false, isMultiIntent: false };
  }

  const compactText = text.replace(/\s+/g, ' ').trim();
  const alphaNumericLength = compactText.replace(/[^\p{L}\p{N}]+/gu, '').length;
  const isTooShort = isLowRiskCase(caseType) && alphaNumericLength > 0 && alphaNumericLength <= 4;

  const intentMatches = [
    /đơn vị vận chuyển|đơn vị nào|ship hãng nào|gửi qua hãng nào|vận chuyển bên nào|ship đơn vị nào|giao qua đơn vị nào|bên vận chuyển nào|ship bên nào/,
    /giờ hỗ trợ|mấy giờ|khi nào làm việc|shop làm việc mấy giờ|shop hỗ trợ mấy giờ/,
    /ship|giao hàng|bao lâu|mấy ngày|khi nào nhận/,
    /^(xin chào|chào shop|hello|hi|alo)$/,
    /^(shop ơi|shop)([\s.!?,~…]+)?$/
  ].filter((pattern) => pattern.test(compactText)).length;

  const separatorHints = /( với | và | rồi | tiện thể | sẵn cho mình hỏi | với lại |\/|\n|\?[^\s]*.*\?)/.test(compactText);
  const multiQuestionMarks = (compactText.match(/\?/g) || []).length >= 2;
  const isMultiIntent = isLowRiskCase(caseType) && intentMatches >= 2 && (separatorHints || multiQuestionMarks);

  return { isTooShort, isMultiIntent };
}
