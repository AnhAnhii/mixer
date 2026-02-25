/**
 * Shared types for Facebook Inbox sub-components.
 */

export interface Conversation {
    id: string;
    recipientId: string;
    customerName: string;
    lastMessage: string;
    lastMessageTime: string;
    isUnread: boolean;
    unreadCount: number;
}

export interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    isFromPage: boolean;
    timestamp: string;
    attachments?: Array<{
        type: 'image' | 'file' | 'video';
        url: string;
        name?: string;
    }>;
}

export const QUICK_TEMPLATES = [
    { id: 'greeting', label: '👋 Chào', text: 'Dạ chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm của shop ạ. Bạn cần tư vấn size/màu gì để em kiểm tra tồn kho nhé? 😊' },
    { id: 'confirm', label: '✅ Xác nhận', text: 'Dạ em xác nhận đơn hàng của bạn rồi ạ. Bạn vui lòng gửi em địa chỉ và SĐT để em ship hàng nhé! 📦' },
    { id: 'payment', label: '💳 CK', text: 'Dạ bạn chuyển khoản theo thông tin:\n🏦 MB Bank\n💳 STK: [số tài khoản]\n👤 Chủ TK: [tên]\n\nSau khi CK xong bạn gửi em bill để xác nhận ạ! 🙏' },
    { id: 'shipped', label: '🚚 Đã ship', text: 'Dạ đơn hàng của bạn đã được gửi đi rồi ạ! 📦\nMã vận đơn: [mã]\nDự kiến 2-3 ngày sẽ nhận được hàng nhé! ✨' },
    { id: 'thanks', label: '🙏 Cảm ơn', text: 'Cảm ơn bạn đã mua hàng tại shop ạ! 💕 Nếu hài lòng với sản phẩm, bạn để lại đánh giá 5⭐ giúp shop nhé. Hẹn gặp lại bạn! 🥰' },
] as const;

export const COMMON_EMOJIS = ['😊', '👍', '❤️', '🙏', '✨', '📦', '🚚', '💕', '🔥', '💯', '👋', '😍', '🎉', '💪', '✅'] as const;

export const ORDER_STATUSES = ['Chờ xử lý', 'Đang xử lý', 'Đã gửi hàng', 'Đã giao hàng', 'Đã hủy'] as const;

export const API_BASE = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mixerottn.vercel.app';

export function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 7) return `${diffDays} ngày`;
    return date.toLocaleDateString('vi-VN');
}

export function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleS08teleS08cBj+a2teleS08cBj+a2teleS08');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    } catch { /* ignore */ }
}
