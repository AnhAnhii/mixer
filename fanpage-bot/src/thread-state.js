import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_THREADS = 5000;

export function createThreadStateStore(options = {}) {
  const storePath = options.threadStatePath
    || process.env.THREAD_STATE_STORE_PATH
    || path.resolve(process.cwd(), 'data/logs/thread-state.json');
  const maxThreads = Number(options.threadStateMaxThreads ?? process.env.THREAD_STATE_MAX_THREADS ?? DEFAULT_MAX_THREADS);

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

  return {
    get(threadKey) {
      ensureLoaded();
      if (!threadKey) return null;
      return state[threadKey] || null;
    },
    markAutoSend(threadKey, payload = {}) {
      ensureLoaded();
      if (!threadKey) return null;

      state[threadKey] = {
        thread_key: threadKey,
        last_auto_sent_at: payload.sentAt || new Date().toISOString(),
        last_case_type: payload.caseType || null,
        last_message_id: payload.messageId || null,
        last_reply_text: payload.replyText || null
      };

      persist();
      return state[threadKey];
    }
  };
}

function trimState(input, maxThreads) {
  const entries = Object.entries(input || {});
  if (entries.length <= maxThreads) {
    return input;
  }

  const sorted = entries.sort((a, b) => {
    const aTime = Date.parse(a[1]?.last_auto_sent_at || 0) || 0;
    const bTime = Date.parse(b[1]?.last_auto_sent_at || 0) || 0;
    return bTime - aTime;
  }).slice(0, maxThreads);

  return Object.fromEntries(sorted);
}
