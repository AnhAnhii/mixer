export interface MessagingAttachment {
type: string;
payload?: {
url?: string;
};
}

export interface MessagingMessage {
mid?: string;
text?: string;
attachments?: MessagingAttachment[];
is_echo?: boolean;
}

export interface MessagingEvent {
sender?: { id?: string };
recipient?: { id?: string };
timestamp?: number;
message?: MessagingMessage;
postback?: {
title?: string;
payload?: string;
};
}

export interface WebhookEntry {
id?: string;
time?: number;
messaging?: MessagingEvent[];
}

export interface WebhookBody {
object?: string;
entry?: WebhookEntry[];
}

export interface NormalizedMessage {
page_id: string | null;
psid: string | null;
message_id: string | null;
timestamp: number | null;
message_text: string;
attachments: MessagingAttachment[];
event_type: 'message' | 'postback' | 'unknown';
}

export interface ClassificationResult {
case_type: string;
risk_level: 'low' | 'medium' | 'high';
needs_human: boolean;
confidence: number;
missing_info: string[];
reason: string;
suggested_tags: string[];
}

export interface DraftOutput {
case_type: string;
risk_level: 'low' | 'medium' | 'high';
needs_human: boolean;
auto_reply_allowed: boolean;
confidence: number;
missing_info: string[];
reply_text: string;
action: 'draft_only' | 'handoff';
reason: string;
suggested_tags: string[];
}
