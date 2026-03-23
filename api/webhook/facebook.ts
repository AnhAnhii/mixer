import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleFacebookWebhook } from '../../../fanpage-bot/src/webhook.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleFacebookWebhook(req, res);
}
