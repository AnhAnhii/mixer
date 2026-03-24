export function normalizeWebhookBody(body) {
  if (!body || body.object !== 'page') {
    return [];
  }

  return extractWebhookEventPairs(body).map(({ normalized }) => normalized);
}

export function extractWebhookEventPairs(body) {
  if (!body || body.object !== 'page') {
    return [];
  }

  const pairs = [];

  for (const [entryIndex, entry] of (body.entry || []).entries()) {
    for (const [eventIndex, event] of (entry.messaging || []).entries()) {
      const normalized = event.message?.is_echo
        ? normalizeEchoEvent(entry, event)
        : normalizeMessagingEvent(entry, event);

      pairs.push({
        normalized,
        raw: buildRawWebhookEventRecord(entry, event, { entryIndex, eventIndex })
      });
    }
  }

  return pairs;
}

export function normalizeMessagingEvent(entry, event) {
  if (event.message) {
    return {
      source: 'facebook_messenger',
      page_id: entry.id || event.recipient?.id || null,
      thread_key: buildThreadKey(entry.id || event.recipient?.id, event.sender?.id),
      message_id: event.message.mid || null,
      sender_psid: event.sender?.id || null,
      timestamp: event.timestamp || null,
      text: event.message.text || '',
      attachments: event.message.attachments || [],
      event_type: 'message',
      event_meta: {
        is_echo: Boolean(event.message.is_echo),
        quick_reply_payload: event.message.quick_reply?.payload || null
      }
    };
  }

  if (event.postback) {
    return {
      source: 'facebook_messenger',
      page_id: entry.id || event.recipient?.id || null,
      thread_key: buildThreadKey(entry.id || event.recipient?.id, event.sender?.id),
      message_id: null,
      sender_psid: event.sender?.id || null,
      timestamp: event.timestamp || null,
      text: event.postback.payload || event.postback.title || '',
      attachments: [],
      event_type: 'postback',
      event_meta: {
        title: event.postback.title || null,
        payload: event.postback.payload || null
      }
    };
  }

  if (event.read) {
    return buildPassiveEvent(entry, event, 'read', {
      watermark: event.read.watermark || null
    });
  }

  if (event.delivery) {
    return buildPassiveEvent(entry, event, 'delivery', {
      watermark: event.delivery.watermark || null,
      mids: event.delivery.mids || []
    });
  }

  if (event.optin) {
    return buildPassiveEvent(entry, event, 'optin', {
      ref: event.optin.ref || null,
      user_ref: event.optin.user_ref || null
    });
  }

  if (event.referral) {
    return buildPassiveEvent(entry, event, 'referral', {
      ref: event.referral.ref || null,
      source: event.referral.source || null,
      type: event.referral.type || null
    });
  }

  if (event.account_linking) {
    return buildPassiveEvent(entry, event, 'account_linking', {
      status: event.account_linking.status || null,
      authorization_code: event.account_linking.authorization_code || null
    });
  }

  return buildPassiveEvent(entry, event, 'unknown');
}

function normalizeEchoEvent(entry, event) {
  return {
    source: 'facebook_messenger',
    page_id: entry.id || event.recipient?.id || null,
    thread_key: buildThreadKey(entry.id || event.recipient?.id, event.sender?.id),
    message_id: event.message?.mid || null,
    sender_psid: event.sender?.id || null,
    timestamp: event.timestamp || null,
    text: event.message?.text || '',
    attachments: event.message?.attachments || [],
    event_type: 'echo',
    event_meta: {
      is_echo: true,
      app_id: event.message?.app_id || null,
      metadata: event.message?.metadata || null
    }
  };
}

function buildPassiveEvent(entry, event, eventType, eventMeta = {}) {
  return {
    source: 'facebook_messenger',
    page_id: entry.id || event.recipient?.id || null,
    thread_key: buildThreadKey(entry.id || event.recipient?.id, event.sender?.id),
    message_id: null,
    sender_psid: event.sender?.id || null,
    timestamp: event.timestamp || null,
    text: '',
    attachments: [],
    event_type: eventType,
    event_meta: eventMeta
  };
}

function buildThreadKey(pageId, psid) {
  return pageId && psid ? `facebook:${pageId}:${psid}` : null;
}

function buildRawWebhookEventRecord(entry, event, indexes) {
  return {
    logged_at: new Date().toISOString(),
    source: 'facebook_messenger',
    entry_index: indexes.entryIndex,
    event_index: indexes.eventIndex,
    page_id: entry.id || event.recipient?.id || null,
    sender_psid: event.sender?.id || null,
    recipient_id: event.recipient?.id || null,
    timestamp: event.timestamp || null,
    raw_event_type: detectRawEventType(event),
    raw_event: event
  };
}

function detectRawEventType(event) {
  if (event.message?.is_echo) {
    return 'echo';
  }

  if (event.message) {
    return 'message';
  }

  if (event.postback) {
    return 'postback';
  }

  if (event.read) {
    return 'read';
  }

  if (event.delivery) {
    return 'delivery';
  }

  if (event.optin) {
    return 'optin';
  }

  if (event.referral) {
    return 'referral';
  }

  if (event.account_linking) {
    return 'account_linking';
  }

  return 'unknown';
}
