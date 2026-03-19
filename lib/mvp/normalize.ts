import { MessagingEvent, NormalizedMessage, WebhookEntry } from './types';

export function normalizeMessagingEvent(
entry: WebhookEntry,
event: MessagingEvent
): NormalizedMessage {
if (event.message) {
return {
page_id: entry.id || event.recipient?.id || null,
psid: event.sender?.id || null,
message_id: event.message.mid || null,
timestamp: event.timestamp || null,
message_text: event.message.text || '',
attachments: event.message.attachments || [],
event_type: 'message'
};
}

if (event.postback) {
return {
page_id: entry.id || event.recipient?.id || null,
psid: event.sender?.id || null,
message_id: null,
timestamp: event.timestamp || null,
message_text: event.postback.payload || event.postback.title || '',
attachments: [],
event_type: 'postback'
};
}

return {
page_id: entry.id || event.recipient?.id || null,
psid: event.sender?.id || null,
message_id: null,
timestamp: event.timestamp || null,
message_text: '',
attachments: [],
event_type: 'unknown'
};
}
