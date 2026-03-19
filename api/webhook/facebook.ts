import type { VercelRequest, VercelResponse } from '@vercel/node';
import { classifyMessage } from '../../lib/mvp/classify';
import { buildDraftOutput } from '../../lib/mvp/draft';
import { normalizeMessagingEvent } from '../../lib/mvp/normalize';
import { WebhookBody } from '../../lib/mvp/types';

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'mixer_verify_token_2024';

export default async function handler(req: VercelRequest, res: VercelResponse) {
console.log(`📥 ${req.method} /api/webhook/facebook`);

if (req.method === 'GET') {
return handleVerification(req, res);
}

if (req.method === 'POST') {
return handleWebhookEvent(req, res);
}

return res.status(405).json({ error: 'Method not allowed' });
}

function handleVerification(req: VercelRequest, res: VercelResponse) {
const mode = req.query['hub.mode'];
const token = req.query['hub.verify_token'];
const challenge = req.query['hub.challenge'];

console.log('🔐 Verification request received');
console.log(' Mode:', mode);
console.log(' Token matched:', token === VERIFY_TOKEN);

if (mode === 'subscribe' && token === VERIFY_TOKEN) {
console.log('✅ Webhook verified successfully');
return res.status(200).send(challenge);
}

console.log('❌ Verification failed');
return res.status(403).json({ error: 'Verification failed' });
}

async function handleWebhookEvent(req: VercelRequest, res: VercelResponse) {
const body = req.body as WebhookBody;

console.log('📨 RAW FACEBOOK EVENT:');
console.log(JSON.stringify(body, null, 2));

if (body.object !== 'page') {
console.log('⚠️ Unsupported object type:', body.object);
return res.status(404).json({ error: 'Unsupported object type' });
}

try {
for (const entry of body.entry || []) {
for (const event of entry.messaging || []) {
if (event.message?.is_echo) {
console.log('⏭️ Skip echo message');
continue;
}

const normalizedMessage = normalizeMessagingEvent(entry, event);

console.log('🧩 NORMALIZED MESSAGE:');
console.log(JSON.stringify(normalizedMessage, null, 2));

if (normalizedMessage.event_type === 'unknown') {
console.log('⏭️ Unknown event type, skip draft pipeline');
continue;
}

const classification = classifyMessage(normalizedMessage);

console.log('🏷️ CLASSIFICATION RESULT:');
console.log(JSON.stringify(classification, null, 2));

const draftOutput = buildDraftOutput(normalizedMessage, classification);

console.log('📝 MVP DRAFT OUTPUT:');
console.log(JSON.stringify(draftOutput, null, 2));

console.log('📦 PIPELINE BUNDLE:');
console.log(
JSON.stringify(
{
normalizedMessage,
classification,
draftOutput
},
null,
2
)
);
}
}
} catch (error) {
console.error('❌ Error processing webhook:', error);
}

return res.status(200).json({ status: 'EVENT_RECEIVED' });
}
