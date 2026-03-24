import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFacebookWebhook } from '../../fanpage-bot/src/webhook.js';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    await attachRawJsonBody(req);
  }

  return handleFacebookWebhook(req, res);
}

async function attachRawJsonBody(req: VercelRequest) {
  if ((req as VercelRequest & { rawBody?: Buffer }).rawBody && req.body) {
    return;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks);
  (req as VercelRequest & { rawBody?: Buffer }).rawBody = rawBody;

  if (!rawBody.length) {
    req.body = {};
    return;
  }

  const rawText = rawBody.toString('utf8');

  try {
    req.body = JSON.parse(rawText);
  } catch {
    req.body = {};
  }
}
