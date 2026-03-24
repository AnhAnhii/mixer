const GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_BACKOFF_MS = 400;

export async function sendFacebookMessage({
  recipientId,
  messageText,
  pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN,
  fetchImpl = globalThis.fetch,
  timeoutMs = readPositiveNumber(process.env.FB_SEND_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  maxAttempts = readPositiveNumber(process.env.FB_SEND_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
  retryBackoffMs = readPositiveNumber(process.env.FB_SEND_RETRY_BACKOFF_MS, DEFAULT_RETRY_BACKOFF_MS),
  markSeenBeforeReply = readBool(process.env.FB_SEND_MARK_SEEN_BEFORE_REPLY, false)
}) {
  if (!recipientId) {
    throw new Error('missing_recipient_id');
  }

  if (!messageText || !String(messageText).trim()) {
    throw new Error('missing_message_text');
  }

  if (!pageAccessToken) {
    throw new Error('missing_fb_page_access_token');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('missing_fetch_implementation');
  }

  const attempts = Math.max(1, Math.trunc(maxAttempts));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const markSeen = markSeenBeforeReply
        ? await sendSenderAction({
            recipientId,
            senderAction: 'mark_seen',
            pageAccessToken,
            fetchImpl,
            timeoutMs
          })
        : null;

      const response = await sendSingleAttempt({
        recipientId,
        messageText,
        pageAccessToken,
        fetchImpl,
        timeoutMs
      });

      return {
        ...response,
        attempts: attempt,
        retried: attempt > 1,
        mark_seen: markSeen
          ? {
              attempted: true,
              status: 'sent',
              http_status: markSeen.http_status
            }
          : {
              attempted: false,
              status: 'skipped'
            }
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableFacebookSendError(error);
      const canRetry = attempt < attempts;

      if (!retryable || !canRetry) {
        error.attempts = attempt;
        error.retried = attempt > 1;
        throw error;
      }

      await sleep(retryBackoffMs * attempt);
    }
  }

  throw lastError || new Error('facebook_send_failed_unknown');
}

async function sendSingleAttempt({ recipientId, messageText, pageAccessToken, fetchImpl, timeoutMs }) {
  return sendGraphRequest({
    recipientId,
    body: {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: { text: String(messageText).trim() },
      access_token: pageAccessToken
    },
    fetchImpl,
    timeoutMs
  });
}

async function sendSenderAction({ recipientId, senderAction, pageAccessToken, fetchImpl, timeoutMs }) {
  return sendGraphRequest({
    recipientId,
    body: {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      sender_action: senderAction,
      access_token: pageAccessToken
    },
    fetchImpl,
    timeoutMs
  });
}

async function sendGraphRequest({ recipientId, body, fetchImpl, timeoutMs }) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchImpl(`${GRAPH_API_BASE}/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller?.signal
    });

    const rawText = await response.text();
    let parsedBody = null;

    try {
      parsedBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedBody = { raw: rawText };
    }

    if (!response.ok) {
      const error = new Error(`facebook_send_http_${response.status}`);
      error.status = response.status;
      error.responseBody = parsedBody;
      throw error;
    }

    return {
      ok: true,
      http_status: response.status,
      recipient_id: parsedBody?.recipient_id || recipientId,
      message_id: parsedBody?.message_id || null,
      raw: parsedBody
    };
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error('facebook_send_timeout');
      timeoutError.code = 'SEND_TIMEOUT';
      timeoutError.retryable = true;
      throw timeoutError;
    }

    if (isLikelyNetworkError(error)) {
      error.retryable = true;
    }

    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function isRetryableFacebookSendError(error) {
  if (!error) {
    return false;
  }

  if (error.retryable === true) {
    return true;
  }

  const status = Number(error.status);
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }

  return false;
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function isLikelyNetworkError(error) {
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN'
  ].includes(error?.code) || /fetch failed|network|socket/i.test(String(error?.message || ''));
}

function readPositiveNumber(rawValue, fallback) {
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readBool(rawValue, fallback) {
  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    return rawValue.toLowerCase() === 'true';
  }

  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
