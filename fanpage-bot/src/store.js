import fs from 'node:fs';
import path from 'node:path';
import { resolveWritableDataPath } from './runtime-paths.js';

export function appendAuditLog(record, targetPath = process.env.LOG_STORE_PATH || resolveWritableDataPath('data/logs/audit.jsonl')) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.appendFileSync(targetPath, JSON.stringify(record) + '\n', 'utf8');
  return targetPath;
}

export function appendRawEventLog(record, targetPath = process.env.RAW_EVENT_STORE_PATH || resolveWritableDataPath('data/logs/raw-events.jsonl')) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.appendFileSync(targetPath, JSON.stringify(record) + '\n', 'utf8');
  return targetPath;
}

export function appendPendingHandoff(record, targetPath = process.env.HANDOFF_STORE_PATH || path.resolve(process.cwd(), 'data/logs/pending-handoffs.jsonl')) {
  const dedupeKey = buildPendingHandoffKey(record);
  const dedupePath = `${targetPath}.dedupe.json`;
  const dedupeState = loadPendingHandoffDedupeState(dedupePath);

  if (dedupeKey && dedupeState.seen[dedupeKey]) {
    return null;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.appendFileSync(targetPath, JSON.stringify(record) + '\n', 'utf8');

  if (dedupeKey) {
    dedupeState.order.push(dedupeKey);
    dedupeState.seen[dedupeKey] = {
      queued_at: record.queued_at || new Date().toISOString(),
      thread_key: record.thread_key || null,
      message_id: record.message_id || null,
      delivery_decision: record.delivery_decision || null
    };
    trimPendingHandoffDedupeState(dedupeState, Number(process.env.HANDOFF_DEDUPE_MAX_KEYS || 5000));
    persistPendingHandoffDedupeState(dedupePath, dedupeState);
  }

  return targetPath;
}

export function appendHandoffResolution(record, targetPath = process.env.HANDOFF_RESOLUTION_STORE_PATH || resolveWritableDataPath('data/logs/handoff-resolutions.jsonl')) {
  targetPath = normalizeWritableTargetPath(targetPath, 'data/logs/handoff-resolutions.jsonl');
  const resolutionRecord = {
    resolved_at: new Date().toISOString(),
    status: 'resolved',
    ...record
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.appendFileSync(targetPath, JSON.stringify(resolutionRecord) + '\n', 'utf8');
  return { path: targetPath, record: resolutionRecord };
}

export function buildPendingHandoffRecord({ normalizedMessage, triage, guarded, sendResult, processingMeta }) {
  return {
    queued_at: new Date().toISOString(),
    status: 'pending_human',
    processing_meta: processingMeta || null,
    thread_key: normalizedMessage.thread_key,
    page_id: normalizedMessage.page_id,
    sender_psid: normalizedMessage.sender_psid,
    message_id: normalizedMessage.message_id,
    event_type: normalizedMessage.event_type,
    latest_customer_message: normalizedMessage.text,
    attachments_count: (normalizedMessage.attachments || []).length,
    case_type: triage.case_type,
    risk_level: triage.risk_level,
    classifier_reason: triage.reason,
    delivery_decision: guarded.delivery.decision,
    delivery_reason: sendResult?.reason || guarded.delivery.decision,
    missing_info: guarded.guarded_draft.missing_info || [],
    suggested_reply: guarded.guarded_draft.reply_text || '',
    safety_flags: guarded.guarded_draft.safety_flags || []
  };
}

export function readPendingHandoffs(targetPath = process.env.HANDOFF_STORE_PATH || resolveWritableDataPath('data/logs/pending-handoffs.jsonl')) {
  return readJsonl(targetPath);
}

export function readHandoffResolutions(targetPath = process.env.HANDOFF_RESOLUTION_STORE_PATH || resolveWritableDataPath('data/logs/handoff-resolutions.jsonl')) {
  return readJsonl(targetPath);
}

export function readOpenPendingHandoffs(options = {}) {
  const pending = readPendingHandoffs(options.handoffPath);
  const resolutions = readHandoffResolutions(options.resolutionPath);
  const resolvedKeys = new Set(resolutions.map(buildResolutionLookupKey).filter(Boolean));

  return pending.filter((record) => {
    const messageKey = buildResolutionLookupKey(record);
    if (messageKey && resolvedKeys.has(messageKey)) {
      return false;
    }

    const threadKey = record.thread_key ? `thread:${record.thread_key}` : null;
    if (threadKey && resolvedKeys.has(threadKey)) {
      return false;
    }

    return true;
  });
}

function buildPendingHandoffKey(record) {
  if (!record) {
    return null;
  }

  if (record.message_id) {
    return [record.page_id || 'page', record.message_id, record.delivery_decision || 'unknown'].join(':');
  }

  if (record.thread_key && record.latest_customer_message) {
    return [
      record.thread_key,
      record.delivery_decision || 'unknown',
      record.case_type || 'unknown',
      record.latest_customer_message.trim().toLowerCase()
    ].join(':');
  }

  return null;
}

function loadPendingHandoffDedupeState(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { order: [], seen: {} };
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      order: Array.isArray(parsed?.order) ? parsed.order.filter(Boolean) : [],
      seen: parsed?.seen && typeof parsed.seen === 'object' ? parsed.seen : {}
    };
  } catch {
    return { order: [], seen: {} };
  }
}

function trimPendingHandoffDedupeState(state, maxKeys) {
  while (state.order.length > maxKeys) {
    const oldestKey = state.order.shift();
    if (oldestKey) {
      delete state.seen[oldestKey];
    }
  }
}

function persistPendingHandoffDedupeState(filePath, state) {
  filePath = normalizeWritableTargetPath(filePath, 'data/logs/pending-handoffs.jsonl.dedupe.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

function readJsonl(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return [];
  }

  return fs.readFileSync(targetPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildResolutionLookupKey(record) {
  if (!record) {
    return null;
  }

  if (record.message_id) {
    return `message:${record.message_id}`;
  }

  if (record.thread_key) {
    return `thread:${record.thread_key}`;
  }

  return null;
}

function normalizeWritableTargetPath(targetPath, fallbackRelativePath) {
  if (!targetPath) {
    return resolveWritableDataPath(fallbackRelativePath);
  }

  if (targetPath === '/var/task' || targetPath.startsWith('/var/task/')) {
    return resolveWritableDataPath(fallbackRelativePath);
  }

  return targetPath;
}
