import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';

const args = process.argv.slice(2);
const parsed = parseArgs(args);

if (!parsed.inputArg) {
  printUsage();
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), parsed.inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const loaded = loadReplayInput(inputPath, parsed);
const replayStores = buildReplayStorePaths();
const outputs = await processWebhookBody(loaded.body, {
  autoReplyEnabled: readBool(process.env.AUTO_REPLY_ENABLED, false),
  shadowMode: readBool(process.env.AUTO_REPLY_SHADOW_MODE, true),
  confidenceThreshold: readNumber(process.env.AUTO_REPLY_CONFIDENCE_THRESHOLD, 0.9),
  allowedCases: process.env.AUTO_REPLY_ALLOWED_CASES,
  pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
  rawEventLogPath: replayStores.rawEventLogPath,
  logPath: replayStores.logPath,
  handoffPath: replayStores.handoffPath,
  dedupeStorePath: replayStores.dedupeStorePath,
  threadStatePath: replayStores.threadStatePath,
  allowedPageIds: process.env.FB_ALLOWED_PAGE_IDS || process.env.FB_PAGE_ID
});

const limit = Math.max(1, readNumber(parsed.limitArg, outputs.length));
const recentOutputs = outputs.slice(-limit);

console.log(JSON.stringify({
  input_path: inputPath,
  input_mode: loaded.mode,
  replay_store_dir: replayStores.baseDir,
  selected_event_count: loaded.selectedEventCount,
  available_event_count: loaded.availableEventCount,
  selection: loaded.selection,
  event_shape_summary: buildEventShapeSummary(loaded.events),
  processed: outputs.length,
  showing: recentOutputs.length,
  delivery_decisions: summarizeBy(recentOutputs, (item) => item?.delivery?.decision || 'unknown'),
  case_types: summarizeBy(recentOutputs, (item) => item?.triage?.case_type || 'unknown'),
  event_types: summarizeBy(recentOutputs, (item) => item?.normalized_message?.event_type || 'unknown'),
  outputs: recentOutputs
}, null, 2));

function loadReplayInput(inputPath, parsed) {
  const rawText = fs.readFileSync(inputPath, 'utf8');
  const trimmed = rawText.trim();

  if (!trimmed) {
    throw new Error(`Replay input is empty: ${inputPath}`);
  }

  if (looksLikeJsonl(trimmed)) {
    const records = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => parseJson(line, `${inputPath}:${index + 1}`));

    return buildReplayFromJsonlRecords(records, parsed);
  }

  const parsedJson = parseJson(trimmed, inputPath);

  if (isWebhookPayload(parsedJson)) {
    const events = extractMessagingEvents(parsedJson);
    return {
      mode: 'webhook_payload_json',
      body: parsedJson,
      events,
      selectedEventCount: events.length,
      availableEventCount: events.length,
      selection: buildSelectionSummary(parsed, events.length)
    };
  }

  if (isRawEventLogRecord(parsedJson)) {
    return buildReplayFromJsonlRecords([parsedJson], parsed, 'raw_event_log_record_json');
  }

  if (isMessagingEvent(parsedJson)) {
    const body = wrapEventsAsWebhookPayload([parsedJson], parsed.pageId || inferPageIdFromEvent(parsedJson));
    return {
      mode: 'single_messaging_event_json',
      body,
      events: [parsedJson],
      selectedEventCount: 1,
      availableEventCount: 1,
      selection: buildSelectionSummary(parsed, 1)
    };
  }

  throw new Error(`Unsupported replay input shape: ${inputPath}`);
}

function buildReplayFromJsonlRecords(records, parsed, forcedMode = 'raw_event_log_jsonl') {
  const events = records
    .map((record) => extractMessagingEventFromRecord(record))
    .filter(Boolean);

  if (!events.length) {
    throw new Error('No replayable messaging events found in input');
  }

  const selectedEvents = applySelection(events, parsed);
  if (!selectedEvents.length) {
    throw new Error('Selection matched 0 events');
  }

  const body = wrapEventsAsWebhookPayload(selectedEvents, parsed.pageId || inferPageId(selectedEvents, records));

  return {
    mode: forcedMode,
    body,
    events: selectedEvents,
    selectedEventCount: selectedEvents.length,
    availableEventCount: events.length,
    selection: buildSelectionSummary(parsed, events.length)
  };
}

function applySelection(events, parsed) {
  return events.filter((event, index) => {
    if (parsed.mid && event?.message?.mid !== parsed.mid) {
      return false;
    }

    if (parsed.psid && event?.sender?.id !== parsed.psid) {
      return false;
    }

    if (parsed.eventType && detectMessagingEventType(event) !== parsed.eventType) {
      return false;
    }

    if (parsed.entryIndex !== null && parsed.entryIndex !== undefined && index !== parsed.entryIndex) {
      return false;
    }

    return true;
  });
}

function wrapEventsAsWebhookPayload(events, pageId) {
  return {
    object: 'page',
    entry: [
      {
        id: pageId || null,
        time: Date.now(),
        messaging: events
      }
    ]
  };
}

function extractMessagingEventFromRecord(record) {
  if (isRawEventLogRecord(record)) {
    return record.raw_event;
  }

  if (isMessagingEvent(record)) {
    return record;
  }

  return null;
}

function buildEventShapeSummary(events) {
  const summary = {
    total: events.length,
    event_types: summarizeBy(events, (event) => detectMessagingEventType(event) || 'unknown'),
    has_text: 0,
    has_attachments: 0,
    attachment_types: {},
    quick_reply_payloads: 0,
    postbacks: 0,
    referrals: 0,
    reads: 0,
    deliveries: 0,
    sample_message_ids: [],
    sample_texts: []
  };

  for (const event of events) {
    const type = detectMessagingEventType(event);
    const attachments = event?.message?.attachments || [];

    if (event?.message?.text) {
      summary.has_text += 1;
      if (summary.sample_texts.length < 5) {
        summary.sample_texts.push(truncateText(event.message.text, 160));
      }
    }

    if (attachments.length) {
      summary.has_attachments += 1;
      for (const attachment of attachments) {
        const key = attachment?.type || 'unknown';
        summary.attachment_types[key] = (summary.attachment_types[key] || 0) + 1;
      }
    }

    if (event?.message?.quick_reply?.payload) {
      summary.quick_reply_payloads += 1;
    }

    if (type === 'postback') summary.postbacks += 1;
    if (type === 'referral') summary.referrals += 1;
    if (type === 'read') summary.reads += 1;
    if (type === 'delivery') summary.deliveries += 1;

    if (event?.message?.mid && summary.sample_message_ids.length < 10) {
      summary.sample_message_ids.push(event.message.mid);
    }
  }

  return summary;
}

function buildSelectionSummary(parsed, availableEventCount) {
  return {
    mid: parsed.mid || null,
    psid: parsed.psid || null,
    event_type: parsed.eventType || null,
    entry_index: parsed.entryIndex,
    page_id_override: parsed.pageId || null,
    available_event_count: availableEventCount
  };
}

function buildReplayStorePaths() {
  const baseDir = process.env.REPLAY_RUN_DIR || path.resolve(process.cwd(), '.tmp/replay-runs', new Date().toISOString().replace(/[.:]/g, '-'));

  return {
    baseDir,
    rawEventLogPath: process.env.REPLAY_RAW_EVENT_STORE_PATH || path.join(baseDir, 'raw-events.jsonl'),
    logPath: process.env.REPLAY_AUDIT_LOG_PATH || path.join(baseDir, 'audit.jsonl'),
    handoffPath: process.env.REPLAY_HANDOFF_STORE_PATH || path.join(baseDir, 'pending-handoffs.jsonl'),
    dedupeStorePath: process.env.REPLAY_DEDUPE_STORE_PATH || path.join(baseDir, 'processed-message-ids.json'),
    threadStatePath: process.env.REPLAY_THREAD_STATE_STORE_PATH || path.join(baseDir, 'thread-state.json')
  };
}

function parseArgs(args) {
  const result = {
    inputArg: null,
    limitArg: null,
    mid: null,
    psid: null,
    eventType: null,
    pageId: null,
    entryIndex: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!result.inputArg && !arg.startsWith('--')) {
      result.inputArg = arg;
      continue;
    }

    if (!result.limitArg && !arg.startsWith('--')) {
      result.limitArg = arg;
      continue;
    }

    if (arg === '--mid') {
      result.mid = args[++index] || null;
      continue;
    }

    if (arg === '--psid') {
      result.psid = args[++index] || null;
      continue;
    }

    if (arg === '--event-type') {
      result.eventType = args[++index] || null;
      continue;
    }

    if (arg === '--page-id') {
      result.pageId = args[++index] || null;
      continue;
    }

    if (arg === '--entry-index') {
      const value = Number(args[++index]);
      result.entryIndex = Number.isInteger(value) && value >= 0 ? value : null;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return result;
}

function printUsage() {
  console.error([
    'Usage: node src/replay-webhook.js <input> [limit] [--mid <mid>] [--psid <psid>] [--event-type <type>] [--page-id <page_id>] [--entry-index <n>]',
    '',
    'Accepted input shapes:',
    '  - full Facebook webhook payload JSON ({ object: "page", entry: [...] })',
    '  - raw-events.jsonl produced by the pipeline',
    '  - one raw-event-log JSON record ({ raw_event: ... })',
    '  - one bare Messenger event JSON ({ sender, recipient, message/postback/... })'
  ].join('\n'));
}

function looksLikeJsonl(text) {
  const firstLine = text.split('\n').find((line) => line.trim());
  return Boolean(firstLine) && text.includes('\n') && firstLine.trim().startsWith('{') && !text.trim().startsWith('{\n  "object"');
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${label}: ${error.message || error}`);
  }
}

function isWebhookPayload(value) {
  return Boolean(value && value.object === 'page' && Array.isArray(value.entry));
}

function isRawEventLogRecord(value) {
  return Boolean(value && typeof value === 'object' && value.raw_event && typeof value.raw_event === 'object');
}

function isMessagingEvent(value) {
  return Boolean(value && typeof value === 'object' && (value.message || value.postback || value.read || value.delivery || value.referral || value.optin || value.account_linking));
}

function extractMessagingEvents(body) {
  return (body.entry || []).flatMap((entry) => Array.isArray(entry.messaging) ? entry.messaging : []);
}

function inferPageId(events, records) {
  return inferPageIdFromEvent(events[0]) || records.find((record) => record?.page_id)?.page_id || null;
}

function inferPageIdFromEvent(event) {
  return event?.recipient?.id || null;
}

function detectMessagingEventType(event) {
  if (!event) return null;
  if (event.message?.is_echo) return 'echo';
  if (event.message) return 'message';
  if (event.postback) return 'postback';
  if (event.delivery) return 'delivery';
  if (event.read) return 'read';
  if (event.optin) return 'optin';
  if (event.referral) return 'referral';
  if (event.account_linking) return 'account_linking';
  return 'unknown';
}

function summarizeBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function truncateText(text, maxLength = 120) {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function readBool(value, defaultValue) {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return defaultValue;
}

function readNumber(value, defaultValue) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}
