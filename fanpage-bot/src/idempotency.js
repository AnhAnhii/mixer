import fs from 'node:fs';
import path from 'node:path';
import { resolveWritableDataPath } from './runtime-paths.js';

const DEFAULT_MAX_KEYS = 5000;

export function createMessageDeduper(options = {}) {
  const storePath = options.storePath || options.dedupeStorePath || process.env.DEDUPE_STORE_PATH || resolveWritableDataPath('data/logs/processed-message-ids.json');
  const maxKeys = Number(options.maxKeys || process.env.DEDUPE_MAX_KEYS || DEFAULT_MAX_KEYS);
  const state = loadState(storePath);

  return {
    storePath,
    has(messageKey) {
      return Boolean(messageKey) && Boolean(state.seen[messageKey]);
    },
    mark(messageKey, meta = {}) {
      if (!messageKey) {
        return false;
      }

      if (state.seen[messageKey]) {
        return false;
      }

      state.order.push(messageKey);
      state.seen[messageKey] = {
        marked_at: new Date().toISOString(),
        ...meta
      };

      while (state.order.length > maxKeys) {
        const oldestKey = state.order.shift();
        if (oldestKey) {
          delete state.seen[oldestKey];
        }
      }

      persistState(storePath, state);
      return true;
    }
  };
}

export function buildMessageKey(normalizedMessage) {
  if (!normalizedMessage) {
    return null;
  }

  if (normalizedMessage.message_id) {
    return `${normalizedMessage.source || 'facebook'}:${normalizedMessage.message_id}`;
  }

  if (normalizedMessage.thread_key && normalizedMessage.timestamp && normalizedMessage.event_type) {
    return [
      normalizedMessage.source || 'facebook',
      normalizedMessage.thread_key,
      normalizedMessage.event_type,
      normalizedMessage.timestamp,
      normalizedMessage.text || ''
    ].join(':');
  }

  return null;
}

function loadState(storePath) {
  try {
    if (!fs.existsSync(storePath)) {
      return { order: [], seen: {} };
    }

    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const order = Array.isArray(parsed?.order) ? parsed.order.filter(Boolean) : [];
    const seen = parsed?.seen && typeof parsed.seen === 'object' ? parsed.seen : {};
    return { order, seen };
  } catch {
    return { order: [], seen: {} };
  }
}

function persistState(storePath, state) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(state, null, 2), 'utf8');
}
