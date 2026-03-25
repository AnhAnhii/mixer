import * as crypto from 'node:crypto';
import { processWebhookBody } from './pipeline.js';
import { resolveWritableDataPath } from './runtime-paths.js';

const RUNTIME_DEBUG_MARKER = 'debug-bad10e1-plus';
const DEBUG_ENV_NAME = 'FANPAGE_BOT_DEBUG';

export async function handleFacebookWebhook(req, res) {
  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  if (req.method === 'POST') {
    const signatureCheck = verifyFacebookWebhookSignature(req, {
      appSecret: process.env.FB_APP_SECRET
    });

    if (!signatureCheck.ok) {
      const statusCode = signatureCheck.reason === 'raw_body_unavailable' ? 500 : 401;
      console.warn('fanpage-bot webhook signature rejected', {
        status_code: statusCode,
        reason: signatureCheck.reason
      });
      return res.status(statusCode).json({
        error: 'Invalid webhook signature',
        reason: signatureCheck.reason
      });
    }

    try {
      logDebug('FANPAGE BOT RUNTIME DEBUG', {
        marker: RUNTIME_DEBUG_MARKER,
        cwd: process.cwd(),
        vercel: Boolean(process.env.VERCEL),
        resolvedAuditPath: resolveWritableDataPath('data/logs/audit.jsonl'),
        resolvedRawPath: resolveWritableDataPath('data/logs/raw-events.jsonl'),
        resolvedHandoffPath: resolveWritableDataPath('data/logs/pending-handoffs.jsonl')
      });
      const outputs = await processWebhookBody(req.body, {});
      const decisionSummary = outputs.map((item) => ({
        message_id: item?.normalized_message?.message_id || null,
        text_preview: item?.normalized_message?.text?.slice(0, 120) || null,
        case_type: item?.triage?.case_type || null,
        risk_level: item?.triage?.risk_level || null,
        delivery_decision: item?.delivery?.decision || null,
        delivery_reason: item?.delivery?.reason || null,
        send_status: item?.send_result?.status || null,
        needs_human: item?.guarded_draft?.needs_human ?? item?.ai_draft?.needs_human ?? null,
        reply_preview: item?.guarded_draft?.reply_text?.slice(0, 160) || item?.ai_draft?.reply_text?.slice(0, 160) || null,
        handoff_path: item?.handoff_path || null
      }));
      console.info('FANPAGE BOT FINAL DECISION', {
        marker: RUNTIME_DEBUG_MARKER,
        processed: outputs.length,
        outputs: decisionSummary
      });
      return res.status(200).json({ status: 'EVENT_RECEIVED', processed: outputs.length });
    } catch (error) {
      console.error('fanpage-bot webhook error', error);
      return res.status(200).json({ status: 'EVENT_RECEIVED_WITH_ERROR' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export function verifyFacebookWebhookSignature(req, options = {}) {
  const appSecret = options.appSecret || process.env.FB_APP_SECRET;

  if (!appSecret) {
    return { ok: true, skipped: true, reason: 'app_secret_not_configured' };
  }

  const signatureHeader = getHeader(req, 'x-hub-signature-256');
  if (!signatureHeader) {
    return { ok: false, reason: 'missing_signature_header' };
  }

  const rawBody = getRawBodyBuffer(req);
  if (!rawBody) {
    return { ok: false, reason: 'raw_body_unavailable' };
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  const provided = Buffer.from(signatureHeader, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (provided.length !== expectedBuffer.length) {
    return { ok: false, reason: 'signature_mismatch' };
  }

  const matches = crypto.timingSafeEqual(provided, expectedBuffer);
  return matches
    ? { ok: true, skipped: false, reason: 'signature_verified' }
    : { ok: false, reason: 'signature_mismatch' };
}

function getHeader(req, name) {
  const lowerName = name.toLowerCase();
  const headers = req?.headers || {};

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) continue;
    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}

function getRawBodyBuffer(req) {
  if (Buffer.isBuffer(req?.rawBody)) {
    return req.rawBody;
  }

  if (typeof req?.rawBody === 'string') {
    return Buffer.from(req.rawBody, 'utf8');
  }

  if (Buffer.isBuffer(req?.body)) {
    return req.body;
  }

  if (typeof req?.body === 'string') {
    return Buffer.from(req.body, 'utf8');
  }

  return null;
}

function handleVerification(req, res) {
  const verifyToken = process.env.FB_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ error: 'Verification failed' });
}

function logDebug(message, payload) {
  if (!isDebugEnabled()) {
    return;
  }

  console.info(message, payload);
}

function isDebugEnabled() {
  return parseBooleanEnv(process.env[DEBUG_ENV_NAME]);
}

function parseBooleanEnv(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
