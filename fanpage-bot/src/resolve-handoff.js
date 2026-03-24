import { appendHandoffResolution, readOpenPendingHandoffs } from './store.js';

const [, , targetArg, ...noteArgs] = process.argv;

if (!targetArg) {
  console.error('Usage: node src/resolve-handoff.js <message_id|thread_key> [note]');
  process.exit(1);
}

const openHandoffs = readOpenPendingHandoffs();
const matched = openHandoffs.filter((record) => {
  return record.message_id === targetArg || record.thread_key === targetArg;
});

if (!matched.length) {
  console.error(`No open handoff matched: ${targetArg}`);
  process.exit(1);
}

const latest = matched[matched.length - 1];
const note = noteArgs.join(' ').trim() || null;
const resolution = appendHandoffResolution({
  message_id: latest.message_id || null,
  thread_key: latest.thread_key || null,
  page_id: latest.page_id || null,
  case_type: latest.case_type || null,
  resolution_note: note
});

console.log(JSON.stringify({
  resolved_target: targetArg,
  matched_open_handoffs: matched.length,
  resolution: resolution.record,
  resolution_path: resolution.path
}, null, 2));
