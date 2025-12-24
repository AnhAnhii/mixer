// services/facebookService.ts
// Facebook Graph API Service for Mixer

const FB_API_VERSION = 'v18.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${FB_API_VERSION}`;

// Types
export interface FacebookConversation {
    id: string;
    participants: {
        data: Array<{
            id: string;
            name: string;
            email?: string;
        }>;
    };
    updated_time: string;
    messages?: {
        data: FacebookMessage[];
    };
    snippet?: string;
    unread_count?: number;
}

export interface FacebookMessage {
    id: string;
    message: string;
    from: {
        id: string;
        name: string;
        email?: string;
    };
    to: {
        data: Array<{
            id: string;
            name: string;
        }>;
    };
    created_time: string;
}

export interface ConversationWithMessages extends FacebookConversation {
    customerName: string;
    customerAvatar?: string;
    lastMessage: string;
    lastMessageTime: string;
    isUnread: boolean;
}

// API Functions

/**
 * Lấy danh sách conversations từ Facebook Page
 */
export async function getConversations(
    pageAccessToken: string,
    pageId: string
): Promise<ConversationWithMessages[]> {
    try {
        const response = await fetch(
            `${FB_GRAPH_URL}/${pageId}/conversations?fields=id,participants,updated_time,snippet,unread_count&access_token=${pageAccessToken}`
        );

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API Error:', data.error);
            throw new Error(data.error.message);
        }

        const conversations: ConversationWithMessages[] = (data.data || []).map(
            (conv: FacebookConversation) => {
                // Tìm participant không phải là Page
                const customer = conv.participants?.data?.find(
                    (p) => p.id !== pageId
                );

                return {
                    ...conv,
                    customerName: customer?.name || 'Khách hàng',
                    lastMessage: conv.snippet || '',
                    lastMessageTime: conv.updated_time,
                    isUnread: (conv.unread_count || 0) > 0,
                };
            }
        );

        return conversations;
    } catch (error) {
        console.error('Error fetching conversations:', error);
        throw error;
    }
}

/**
 * Lấy tin nhắn trong một conversation
 */
export async function getMessages(
    pageAccessToken: string,
    conversationId: string
): Promise<FacebookMessage[]> {
    try {
        const response = await fetch(
            `${FB_GRAPH_URL}/${conversationId}/messages?fields=id,message,from,to,created_time&access_token=${pageAccessToken}`
        );

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API Error:', data.error);
            throw new Error(data.error.message);
        }

        return data.data || [];
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
}

/**
 * Gửi tin nhắn đến user
 */
export async function sendMessage(
    pageAccessToken: string,
    recipientId: string,
    messageText: string
): Promise<{ messageId: string; success: boolean }> {
    try {
        const response = await fetch(
            `${FB_GRAPH_URL}/me/messages?access_token=${pageAccessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: { text: messageText },
                    messaging_type: 'RESPONSE',
                }),
            }
        );

        const data = await response.json();

        if (data.error) {
            console.error('Facebook API Error:', data.error);
            return { messageId: '', success: false };
        }

        return { messageId: data.message_id, success: true };
    } catch (error) {
        console.error('Error sending message:', error);
        return { messageId: '', success: false };
    }
}

/**
 * Lấy thông tin user profile
 */
export async function getUserProfile(
    pageAccessToken: string,
    userId: string
): Promise<{ firstName: string; lastName: string; profilePic: string } | null> {
    try {
        const response = await fetch(
            `${FB_GRAPH_URL}/${userId}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
        );

        const data = await response.json();

        if (data.error) {
            return null;
        }

        return {
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            profilePic: data.profile_pic || '',
        };
    } catch (error) {
        return null;
    }
}

/**
 * Đánh dấu conversation đã đọc
 */
export async function markAsRead(
    pageAccessToken: string,
    senderId: string
): Promise<boolean> {
    try {
        const response = await fetch(
            `${FB_GRAPH_URL}/me/messages?access_token=${pageAccessToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: senderId },
                    sender_action: 'mark_seen',
                }),
            }
        );

        const data = await response.json();
        return !data.error;
    } catch (error) {
        return false;
    }
}
