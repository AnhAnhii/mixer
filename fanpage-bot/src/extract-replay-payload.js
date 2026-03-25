import fs from 'node:fs';
import path from 'node:path';

const [, , inputArg, outputArg, limitArg] = process.argv;

if (!inputArg || !outputArg) {
  console.error('Usage: node src/extract-replay-payload.js <raw-events.jsonl> <output.json> [limit]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);
const limit = Number.isFinite(Number(limitArg)) && Number(limitArg) > 0 ? Number(limitArg) : null;

if (!fs.existsSync(inputPath)) {
  console.error(`Raw event log not found: ${inputPath}`);
  process.exit(1);
}

const rows = fs.readFileSync(inputPath, 'utf8')
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

const selectedRows = limit ? rows.slice(-limit) : rows;
const groups = new Map();

for (const row of selectedRows) {
  const pageId = row.page_id || row.recipient_id || 'unknown-page';
  if (!groups.has(pageId)) {
    groups.set(pageId, []);
  }

  const rawEvent = row.raw_event;
  if (!rawEvent || typeof rawEvent !== 'object') {
    continue;
  }

  groups.get(pageId).push(rawEvent);
}

const payload = {
  object: 'page',
  entry: Array.from(groups.entries()).map(([pageId, messaging]) => ({
    id: pageId,
    time: deriveEntryTime(messaging),
    messaging
  }))
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  input_path: inputPath,
  output_path: outputPath,
  rows_read: rows.length,
  rows_selected: selectedRows.length,
  entry_count: payload.entry.length,
  event_count: payload.entry.reduce((sum, entry) => sum + entry.messaging.length, 0),
  page_ids: payload.entry.map((entry) => entry.id)
}, null, 2));

function deriveEntryTime(messaging) {
  const firstTimestamp = messaging.find((item) => Number.isFinite(Number(item?.timestamp)))?.timestamp;
  return Number.isFinite(Number(firstTimestamp)) ? Number(firstTimestamp) : Date.now();
}
