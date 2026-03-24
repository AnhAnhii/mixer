import fs from 'node:fs';
import path from 'node:path';

const fanpageBotRoot = path.resolve(new URL('..', import.meta.url).pathname);
const groundingPath = path.resolve(fanpageBotRoot, '../scripts/mixer-grounded-ai-data-v1.json');

let groundingCache = null;

export function loadGroundingData() {
  if (!groundingCache) {
    groundingCache = JSON.parse(fs.readFileSync(groundingPath, 'utf8'));
  }
  return groundingCache;
}

export function buildGroundedInput(normalizedMessage, triage, recentMessages = [], vision = null) {
  return {
    channel: normalizedMessage.source,
    page_id: normalizedMessage.page_id,
    psid: normalizedMessage.sender_psid,
    message_id: normalizedMessage.message_id,
    timestamp: normalizedMessage.timestamp,
    latest_customer_message: normalizedMessage.text,
    attachments: (normalizedMessage.attachments || []).map((attachment) => ({
      type: attachment?.type || null,
      url: attachment?.payload?.url || null,
      mime_type: attachment?.payload?.mime_type || null
    })),
    recent_messages: recentMessages,
    vision: vision || null,
    triage: {
      case_type_hint: triage.case_type,
      risk_level_hint: triage.risk_level,
      missing_info_hint: triage.missing_info,
      should_handoff_hint: triage.needs_human
    },
    grounding: loadGroundingData()
  };
}
