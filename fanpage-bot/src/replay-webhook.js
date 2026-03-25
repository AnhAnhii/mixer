import fs from 'node:fs';
import path from 'node:path';
import { processWebhookBody } from './pipeline.js';

const [, , inputArg, limitArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node src/replay-webhook.js <payload.json> [limit]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Payload file not found: ${inputPath}`);
  process.exit(1);
}

const body = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const outputs = await processWebhookBody(body, {
  autoReplyEnabled: readBool(process.env.AUTO_REPLY_ENABLED, false),
  shadowMode: readBool(process.env.AUTO_REPLY_SHADOW_MODE, true),
  confidenceThreshold: readNumber(process.env.AUTO_REPLY_CONFIDENCE_THRESHOLD, 0.9),
  allowedCases: process.env.AUTO_REPLY_ALLOWED_CASES,
  pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN
});

const limit = Math.max(1, readNumber(limitArg, outputs.length));
const recentOutputs = outputs.slice(-limit);

console.log(JSON.stringify({
  input_path: inputPath,
  processed: outputs.length,
  showing: recentOutputs.length,
  delivery_decisions: summarizeBy(recentOutputs, (item) => item?.delivery?.decision || 'unknown'),
  case_types: summarizeBy(recentOutputs, (item) => item?.triage?.case_type || 'unknown'),
  outputs: recentOutputs
}, null, 2));

function summarizeBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
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
