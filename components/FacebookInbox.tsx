// components/FacebookInbox.tsx
// Component hiển thị Facebook Messenger Inbox trong Mixer App - Enhanced Version

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChatBubbleLeftEllipsisIcon,
    PaperAirplaneIcon,
    ArrowPathIcon,
    ChevronDownIcon,
    PlusIcon,
    PhoneIcon,
    ShoppingBagIcon,
    UserIcon,
    ClockIcon,
    FaceSmileIcon,
    SparklesIcon
} from './icons';
import { useToast } from './Toast';
import { getConversations, getMessages, sendMessage, markAsRead } from '../services/facebookService';
import { logger } from '../utils/logger';
import type { Order, Product, OrderItem, Customer } from '../types';
import { cartService } from '../services/cartService';

// Types
interface Conversation {
    id: string;
    recipientId: string;
    customerName: string;
    lastMessage: string;
    lastMessageTime: string;
    isUnread: boolean;
    unreadCount: number;
}

interface Message {
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

interface FacebookInboxProps {
    pageId?: string;
    orders?: Order[];
    products?: Product[];
    bankInfo?: { bin: string; accountNumber: string; accountName: string } | null;
    platform?: 'facebook' | 'instagram';
    onCreateOrderWithAI?: (orderData: Partial<Order>, customerData: Partial<Customer>) => void;
    onViewOrder?: (order: Order) => void;
    onEditOrder?: (order: Order) => void;
    onUpdateOrderStatus?: (orderId: string, status: string) => void;
}

// Quick Reply Templates
const QUICK_TEMPLATES = [
    { id: 'greeting', label: '👋 Chào', text: 'Dạ chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm của shop ạ. Bạn cần tư vấn size/màu gì để em kiểm tra tồn kho nhé? 😊' },
    { id: 'confirm', label: '✅ Xác nhận', text: 'Dạ em xác nhận đơn hàng của bạn rồi ạ. Bạn vui lòng gửi em địa chỉ và SĐT để em ship hàng nhé! 📦' },
    { id: 'payment', label: '💳 CK', text: 'Dạ bạn chuyển khoản theo thông tin:\n🏦 MB Bank\n💳 STK: [số tài khoản]\n👤 Chủ TK: [tên]\n\nSau khi CK xong bạn gửi em bill để xác nhận ạ! 🙏' },
    { id: 'shipped', label: '🚚 Đã ship', text: 'Dạ đơn hàng của bạn đã được gửi đi rồi ạ! 📦\nMã vận đơn: [mã]\nDự kiến 2-3 ngày sẽ nhận được hàng nhé! ✨' },
    { id: 'thanks', label: '🙏 Cảm ơn', text: 'Cảm ơn bạn đã mua hàng tại shop ạ! 💕 Nếu hài lòng với sản phẩm, bạn để lại đánh giá 5⭐ giúp shop nhé. Hẹn gặp lại bạn! 🥰' },
];

// Common emojis
const COMMON_EMOJIS = ['😊', '👍', '❤️', '🙏', '✨', '📦', '🚚', '💕', '🔥', '💯', '👋', '😍', '🎉', '💪', '✅'];

// Vercel API base URL
const API_BASE = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mixerottn.vercel.app';

// Notification sound
const playNotificationSound = () => {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleS08teleS08cBj+a2teleS08cBj+a2teleS08');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    } catch (e) { }
};

const FacebookInbox: React.FC<FacebookInboxProps> = ({
    pageId = '105265398928721',
    orders = [],
    products = [],
    bankInfo = null,
    platform = 'facebook',
    onCreateOrderWithAI,
    onViewOrder,
    onEditOrder,
    onUpdateOrderStatus
}) => {
    const toast = useToast();

    // State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Pagination state
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    // Auto-refresh state
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);

    // UI state
    const [showTemplates, setShowTemplates] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);
    const [showCustomerPanel, setShowCustomerPanel] = useState(true);

    // Lưu thông tin đơn hàng vừa parse để gửi tin xác nhận
    const [parsedOrderData, setParsedOrderData] = useState<Partial<Order> | null>(null);
    const [previousMessageCount, setPreviousMessageCount] = useState(0);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null); // Order đang mở menu
    const [isAIEnabled, setIsAIEnabled] = useState(false); // AI auto-reply toggle
    const [isLoadingAI, setIsLoadingAI] = useState(false); // AI đang xử lý
    const [showAIPanel, setShowAIPanel] = useState(false); // AI settings panel
    const [isCrawling, setIsCrawling] = useState(false); // Đang crawl training data
    const [trainingStats, setTrainingStats] = useState<{
        totalPairs: number;
        byCategory: Record<string, number>;
    } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedConversationRef = useRef<Conversation | null>(null);

    // Keep ref in sync with state for interval access
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    // Load AI settings from Supabase on mount
    useEffect(() => {
        fetch('/api/ai/settings')
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setIsAIEnabled(data.settings?.ai_auto_reply_enabled || false);
                    if (data.trainingDataCount > 0) {
                        setTrainingStats(prev => prev || { totalPairs: data.trainingDataCount, byCategory: {} });
                    }
                }
            })
            .catch(() => { });
    }, []);

    // Scroll to bottom when needed (new conversation, send message, or new message from customer)
    useEffect(() => {
        if (shouldScrollToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setShouldScrollToBottom(false);
        }
    }, [messages, shouldScrollToBottom]);

    // Play sound and scroll when new message from customer arrives
    useEffect(() => {
        if (messages.length > previousMessageCount && previousMessageCount > 0) {
            const lastMsg = messages[messages.length - 1];
            if (!lastMsg.isFromPage) {
                playNotificationSound();
                // Scroll to bottom khi có tin nhắn mới từ khách
                setShouldScrollToBottom(true);
            }
        }
        setPreviousMessageCount(messages.length);
    }, [messages.length]);

    // Load conversations
    const loadConversations = async (cursor?: string) => {
        if (cursor) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
        }

        try {
            let url = `${API_BASE}/api/facebook/conversations?limit=50&platform=${platform}`;
            if (cursor) {
                url += `&after=${cursor}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                if (cursor) {
                    setConversations(prev => [...prev, ...data.conversations]);
                } else {
                    setConversations(data.conversations);
                }

                setNextCursor(data.pagination?.nextCursor || null);
                setHasMore(data.pagination?.hasMore || false);
                setLastRefresh(new Date());
            } else {
                console.error('Error loading conversations:', data.error);
                toast.error('Không thể tải conversations');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Lỗi kết nối API');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = () => {
        if (hasMore && nextCursor && !isLoadingMore) {
            loadConversations(nextCursor);
        }
    };

    // Load messages - silent mode won't show loading spinner
    const loadMessages = async (conversationId: string, silent: boolean = false) => {
        if (!silent) {
            setIsLoadingMessages(true);
        }
        try {
            const response = await fetch(
                `${API_BASE}/api/facebook/messages?conversationId=${conversationId}`
            );
            const data = await response.json();

            if (data.success) {
                const newMessages = data.messages.reverse();
                setMessages(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(newMessages)) {
                        return newMessages;
                    }
                    return prev;
                });
            } else {
                console.error('Error loading messages:', data.error);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            if (!silent) {
                setIsLoadingMessages(false);
            }
        }
    };

    const selectConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        setShouldScrollToBottom(true); // Scroll xuống khi chọn conversation mới
        loadMessages(conv.id);

        // Mark as read locally
        setConversations(prev => prev.map(c =>
            c.id === conv.id ? { ...c, isUnread: false, unreadCount: 0 } : c
        ));

        // Sync with Facebook
        if (conv.recipientId) {
            fetch(`${API_BASE}/api/facebook/mark-seen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipientId: conv.recipientId }),
            }).catch(err => console.log('Mark seen error:', err));
        }

        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const sendMessage = async (messageText?: string) => {
        const textToSend = messageText || newMessage.trim();
        if (!textToSend || !selectedConversation) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_BASE}/api/facebook/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: selectedConversation.recipientId,
                    message: textToSend,
                }),
            });

            const data = await response.json();

            if (data.success) {
                const newMsg: Message = {
                    id: data.messageId,
                    text: textToSend,
                    senderId: pageId,
                    senderName: 'Shop',
                    isFromPage: true,
                    timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, newMsg]);
                setShouldScrollToBottom(true); // Scroll xuống sau khi gửi tin
                setNewMessage('');
                setShowTemplates(false);
                toast.success('Đã gửi!');
                setTimeout(() => loadMessages(selectedConversation.id, true), 1000);
            } else {
                toast.error(data.error || 'Không thể gửi tin nhắn');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Lỗi kết nối');
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const insertEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojis(false);
        inputRef.current?.focus();
    };

    // Gửi ảnh qua Facebook
    const sendImage = async (imageUrl: string): Promise<boolean> => {
        if (!selectedConversation) return false;

        try {
            const response = await fetch(`${API_BASE}/api/facebook/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: selectedConversation.recipientId,
                    imageUrl: imageUrl,
                    messageType: 'image'
                })
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error sending image:', error);
            return false;
        }
    };

    // Generate VietQR URL
    const getVietQRUrl = (amount: number, orderId: string) => {
        if (!bankInfo) return '';
        const content = encodeURIComponent(`Mixer ${orderId}`);
        return `https://img.vietqr.io/image/${bankInfo.bin}-${bankInfo.accountNumber}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${encodeURIComponent(bankInfo.accountName)}`;
    };

    // ==================== VIRTUAL CART HANDLERS ====================

    // Kiểm tra xem tin nhắn có phải là cart command không
    const isCartCommand = (text: string): boolean => {
        const lowerText = text.toLowerCase();
        return lowerText.includes('thêm vào giỏ') ||
            lowerText.includes('add to cart') ||
            lowerText.includes('xem giỏ') ||
            lowerText.includes('giỏ hàng') ||
            lowerText.includes('xóa giỏ') ||
            lowerText.includes('clear cart') ||
            (lowerText.includes('đặt hàng') && lowerText.includes('giỏ'));
    };

    // Xử lý cart command
    const handleCartCommand = async (text: string): Promise<string | null> => {
        if (!selectedConversation) return null;

        const lowerText = text.toLowerCase();
        const facebookUserId = selectedConversation.recipientId;

        // Xem giỏ hàng
        if (lowerText.includes('xem giỏ') || lowerText === 'giỏ hàng') {
            const cart = await cartService.getCart(facebookUserId);
            if (!cart) {
                return '🛒 Giỏ hàng của bạn đang trống.\nGõ "thêm [tên sản phẩm] vào giỏ" để bắt đầu mua sắm!';
            }
            return cartService.formatCartMessage(cart);
        }

        // Xóa giỏ hàng
        if (lowerText.includes('xóa giỏ') || lowerText.includes('clear cart')) {
            await cartService.clearCart(facebookUserId);
            return '🗑️ Đã xóa toàn bộ giỏ hàng!';
        }

        // Thêm vào giỏ
        if (lowerText.includes('thêm vào giỏ') || lowerText.includes('add to cart')) {
            // Parse product info from text
            // Pattern: "thêm [product] size [size] màu [color] vào giỏ"
            const productMatch = text.match(/thêm\s+(.+?)\s+(size\s+\w+)?\s*(màu\s+\w+)?\s*vào giỏ/i);

            if (productMatch) {
                const productName = productMatch[1].trim();
                const sizeMatch = text.match(/size\s+(\w+)/i);
                const colorMatch = text.match(/màu\s+(\w+)/i);
                const quantityMatch = text.match(/(\d+)\s*(cái|chiếc|áo|quần)?/i);

                // Find product in catalog
                const foundProduct = products.find(p =>
                    p.name.toLowerCase().includes(productName.toLowerCase())
                );

                if (foundProduct) {
                    const size = sizeMatch ? sizeMatch[1].toUpperCase() : foundProduct.variants[0]?.size || 'M';
                    const color = colorMatch ? colorMatch[1] : foundProduct.variants[0]?.color || '';
                    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

                    await cartService.addItem(facebookUserId, {
                        product_id: foundProduct.id,
                        product_name: foundProduct.name,
                        size,
                        color,
                        quantity,
                        unit_price: foundProduct.price
                    });

                    const cart = await cartService.getCart(facebookUserId);
                    const { itemCount, totalAmount } = cart ? cartService.getCartTotal(cart) : { itemCount: 0, totalAmount: 0 };
                    const formatCurrency = (amount: number) =>
                        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

                    return `✅ Đã thêm vào giỏ hàng!

📦 ${foundProduct.name} (${size}${color ? ' - ' + color : ''}) x${quantity}
💰 ${formatCurrency(foundProduct.price * quantity)}

🛒 Giỏ hàng: ${itemCount} sản phẩm - ${formatCurrency(totalAmount)}

📝 Gõ "xem giỏ" để xem chi tiết
📝 Gõ "đặt hàng" để checkout`;
                } else {
                    return `❌ Không tìm thấy sản phẩm "${productName}" trong danh mục.
Vui lòng kiểm tra lại tên sản phẩm!`;
                }
            }

            return `📝 Để thêm vào giỏ, gõ theo format:
"Thêm [tên sản phẩm] size [S/M/L/XL] màu [màu] vào giỏ"

Ví dụ: "Thêm áo hoodie size L màu đen vào giỏ"`;
        }

        return null; // Not a cart command
    };

    // Gửi tin nhắn xác nhận đơn hàng với mẫu đầy đủ (COD / Chuyển khoản + VietQR)
    const sendOrderConfirmation = async (orderData?: Partial<Order>, paymentMethod: 'cod' | 'bank_transfer' = 'cod') => {
        const data = orderData || parsedOrderData;
        if (!data || !selectedConversation) {
            toast.error('Chưa có thông tin đơn hàng để gửi');
            return;
        }

        const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
        const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // Tạo danh sách sản phẩm
        const productList = data.items?.map(item =>
            `- ${item.productName} (${item.size} - ${item.color}) x ${item.quantity}`
        ).join('\n') || '- Chưa có sản phẩm';

        // Tính tổng tiền
        const total = data.items?.reduce((sum, item) =>
            sum + (item.price * item.quantity), 0
        ) || 0;

        const orderId = data.id?.substring(0, 8) || 'NEW';
        const orderDate = data.orderDate || new Date().toISOString();

        // Mẫu cho COD
        const codMessage = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(orderDate)}

- Tên người nhận: ${data.customerName}
- Số điện thoại: ${data.customerPhone || 'Chưa có'}
- Địa chỉ: ${data.shippingAddress || 'Chưa có'}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(total)}

Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Dự kiến giao hàng trong 2-4 ngày. Cảm ơn bạn!`;

        // Mẫu cho chuyển khoản (KHÔNG có thông tin ngân hàng text)
        const bankTransferMessage = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(orderDate)}

- Tên người nhận: ${data.customerName}
- Số điện thoại: ${data.customerPhone || 'Chưa có'}
- Địa chỉ: ${data.shippingAddress || 'Chưa có'}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(total)}

Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥
Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`;

        // Gửi tin nhắn text
        await sendMessage(paymentMethod === 'cod' ? codMessage : bankTransferMessage);

        // Nếu là chuyển khoản, gửi thêm ảnh VietQR
        if (paymentMethod === 'bank_transfer' && bankInfo) {
            const qrUrl = getVietQRUrl(total, orderId);
            if (qrUrl) {
                // Delay một chút để tin nhắn text gửi trước
                await new Promise(resolve => setTimeout(resolve, 500));
                const qrSent = await sendImage(qrUrl);
                if (qrSent) {
                    toast.success('📩 Đã gửi tin xác nhận + QR code!');
                } else {
                    toast.info('Đã gửi tin nhắn, nhưng không gửi được QR');
                }
            }
        } else {
            toast.success(`📩 Đã gửi tin xác nhận đơn COD!`);
        }

        setParsedOrderData(null);
    };

    const [isParsingOrder, setIsParsingOrder] = useState(false);

    const handleCreateOrder = async () => {
        if (!selectedConversation || !onCreateOrderWithAI || messages.length === 0) {
            toast.error('Không có cuộc hội thoại để phân tích');
            return;
        }

        setIsParsingOrder(true);
        toast.success('🔮 Đang phân tích cuộc hội thoại...');

        try {
            // Chỉ lấy tin nhắn gần đây (30 tin nhắn cuối hoặc trong 24 giờ)
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const recentMessages = messages
                .filter(m => new Date(m.timestamp) > oneDayAgo)
                .slice(-30); // Lấy tối đa 30 tin nhắn cuối

            if (recentMessages.length === 0) {
                // Nếu không có tin nhắn trong 24h, lấy 15 tin nhắn cuối
                const lastMessages = messages.slice(-15);
                if (lastMessages.length === 0) {
                    throw new Error("Không có tin nhắn để phân tích");
                }
                recentMessages.push(...lastMessages);
            }

            // Format messages as conversation
            const conversationText = recentMessages.map(m =>
                `${m.isFromPage ? 'Shop' : 'Khách'}: ${m.text}`
            ).join('\n');

            // Product list for matching
            const productList = products.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                variants: p.variants.map(v => ({
                    id: v.id,
                    size: v.size,
                    color: v.color,
                    stock: v.stock
                }))
            }));

            const prompt = `
Bạn là AI trợ lý bán hàng thời trang. Phân tích cuộc hội thoại Messenger sau đây và trích xuất thông tin đặt hàng.

⚠️ QUY TẮC QUAN TRỌNG:
- Cuộc hội thoại được sắp xếp theo thứ tự thời gian (tin nhắn CŨ ở trên, tin nhắn MỚI ở dưới)
- Nếu khách gửi thông tin NHIỀU LẦN (tên, SĐT, địa chỉ, sản phẩm), LUÔN LẤY THÔNG TIN GỬI SAU CÙNG (ở cuối)
- Bỏ qua các thông tin cũ đã được khách sửa lại
- CHỈ lấy sản phẩm trong lần đặt hàng cuối cùng, KHÔNG gộp với đơn cũ

CUỘC HỘI THOẠI (từ cũ đến mới):
"""
${conversationText}
"""

DANH SÁCH SẢN PHẨM CÓ SẴN:
${JSON.stringify(productList, null, 2)}

YÊU CẦU:
1. Trích xuất thông tin từ PHẦN CUỐI cuộc hội thoại (thông tin mới nhất)
2. Tên, SĐT, địa chỉ: lấy giá trị CUỐI CÙNG khách gửi
3. Sản phẩm: chỉ lấy từ lần đặt hàng GẦN NHẤT
4. Khớp sản phẩm với danh sách có sẵn (nếu có thể)

Trả về JSON với cấu trúc:
{
  "customerName": string | null,
  "customerPhone": string | null,
  "shippingAddress": string | null,
  "items": [
    {
      "productName": string,
      "size": string | null,
      "color": string | null,
      "quantity": number,
      "matchedProductId": string | null,
      "matchedVariantId": string | null
    }
  ],
  "notes": string | null
}
`;

            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    responseFormat: 'json'
                })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'AI processing failed');

            const parsed = JSON.parse(data.text || '{}');

            // Build order items from parsed data
            const orderItems: OrderItem[] = [];

            for (const item of parsed.items || []) {
                if (item.matchedProductId && item.matchedVariantId) {
                    const product = products.find(p => p.id === item.matchedProductId);
                    const variant = product?.variants.find(v => v.id === item.matchedVariantId);

                    if (product && variant) {
                        orderItems.push({
                            productId: product.id,
                            productName: product.name,
                            variantId: variant.id,
                            size: variant.size,
                            color: variant.color,
                            quantity: item.quantity || 1,
                            price: product.price,
                            costPrice: product.costPrice
                        });
                    }
                } else if (item.productName) {
                    // Try to match by name
                    const matchedProduct = products.find(p =>
                        p.name.toLowerCase().includes(item.productName.toLowerCase()) ||
                        item.productName.toLowerCase().includes(p.name.toLowerCase())
                    );

                    if (matchedProduct) {
                        const matchedVariant = matchedProduct.variants.find(v =>
                            (!item.size || v.size === item.size) &&
                            (!item.color || v.color === item.color)
                        ) || matchedProduct.variants[0];

                        if (matchedVariant) {
                            orderItems.push({
                                productId: matchedProduct.id,
                                productName: matchedProduct.name,
                                variantId: matchedVariant.id,
                                size: item.size || matchedVariant.size,
                                color: item.color || matchedVariant.color,
                                quantity: item.quantity || 1,
                                price: matchedProduct.price,
                                costPrice: matchedProduct.costPrice
                            });
                        }
                    }
                }
            }

            const orderData: Partial<Order> = {
                customerName: parsed.customerName || selectedConversation.customerName,
                customerPhone: parsed.customerPhone || '',
                shippingAddress: parsed.shippingAddress || '',
                items: orderItems,
                notes: parsed.notes || '',
                paymentMethod: 'cod',
                // Lưu Facebook info để liên kết với conversation
                facebookUserId: selectedConversation.recipientId,
                facebookUserName: selectedConversation.customerName,
            };

            const customerData: Partial<Customer> = {
                name: parsed.customerName || selectedConversation.customerName,
                phone: parsed.customerPhone || '',
                address: parsed.shippingAddress || ''
            };

            toast.success('✅ Đã trích xuất thông tin!');

            // Lưu order data để có thể gửi tin xác nhận sau
            setParsedOrderData(orderData);

            onCreateOrderWithAI(orderData, customerData);

        } catch (err) {
            logger.error('AI Parse Error:', err);
            toast.error('Lỗi phân tích: ' + (err instanceof Error ? err.message : 'Unknown'));
        } finally {
            setIsParsingOrder(false);
        }
    };

    // Get customer order history - ONLY match by Facebook User ID (most reliable)
    const getCustomerOrders = useCallback(() => {
        if (!selectedConversation) return [];

        const facebookId = selectedConversation.recipientId;
        if (!facebookId) return [];

        const matched = orders.filter(o => o.facebookUserId === facebookId);

        // Sort by orderDate (newest first)
        return matched.sort((a, b) => {
            const dateA = new Date(a.orderDate || 0).getTime();
            const dateB = new Date(b.orderDate || 0).getTime();
            return dateB - dateA;
        }).slice(0, 10);
    }, [selectedConversation, orders]);

    // Load conversations when platform changes
    useEffect(() => {
        setConversations([]);
        setSelectedConversation(null);
        setMessages([]);
        loadConversations();
    }, [platform]);

    // Auto-refresh conversations every 5 seconds
    useEffect(() => {
        if (!isAutoRefresh) return;
        const interval = setInterval(() => {
            loadConversations();
        }, 5000);
        return () => clearInterval(interval);
    }, [isAutoRefresh]);

    // Auto-refresh messages every 2 seconds
    useEffect(() => {
        if (!isAutoRefresh || !selectedConversation) return;
        const interval = setInterval(() => {
            if (selectedConversationRef.current) {
                loadMessages(selectedConversationRef.current.id, true);
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [isAutoRefresh, selectedConversation]);

    const formatTime = (timestamp: string) => {
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
    };

    // Các trạng thái đơn hàng
    const ORDER_STATUSES = ['Chờ xử lý', 'Đang xử lý', 'Đã gửi hàng', 'Đã giao hàng', 'Đã hủy'];

    // Tạo mẫu tin nhắn cho từng trạng thái (khớp với MessageTemplatesModal)
    const getOrderStatusMessage = (order: Order, status: string) => {
        const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
        const formatDate = (dateString: string) => new Date(dateString).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        const orderId = order.id.substring(0, 8);
        const productList = order.items.map(item => `- ${item.productName} (${item.size} - ${item.color}) x ${item.quantity}`).join('\n');

        const shippingDetails = order.shippingProvider && order.trackingCode
            ? `🚚 Đơn vị vận chuyển: ${order.shippingProvider}\n📋 Mã vận đơn: ${order.trackingCode}`
            : `🚚 Đơn vị vận chuyển: [Đang cập nhật]`;

        // Template cho COD  
        const codTemplate = `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}

👤 Tên người nhận: ${order.customerName}
📱 Số điện thoại: ${order.customerPhone}
📍 Địa chỉ: ${order.shippingAddress}

🛒 Sản phẩm bao gồm:
${productList}
💰 Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

💵 Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Cảm ơn bạn đã tin tưởng Mixer! 💕`;

        // Template cho chuyển khoản
        const bankTransferTemplate = `📦 Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
🆔 Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}

👤 Tên người nhận: ${order.customerName}
📱 Số điện thoại: ${order.customerPhone}
📍 Địa chỉ: ${order.shippingAddress}

🛒 Sản phẩm bao gồm:
${productList}
💰 Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

💳 Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥
⏰ Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`;

        switch (status) {
            case 'Chờ xử lý':
                return order.paymentMethod === 'cod' ? codTemplate : bankTransferTemplate;

            case 'Đang xử lý':
                return `✅ Mixer xác nhận đã nhận được thanh toán cho đơn hàng #${orderId}.
📦 Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được gửi đi.
💕 Cảm ơn bạn đã mua sắm tại Mixer!`;

            case 'Đã gửi hàng':
                return `🎉 Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi!
${shippingDetails}
📞 Bạn vui lòng để ý điện thoại để nhận hàng nhé. Cảm ơn bạn! 💕`;

            case 'Đã giao hàng':
                return `🎊 Mixer xin thông báo: Đơn hàng #${orderId} đã được giao thành công!
💕 Cảm ơn bạn đã tin tưởng và mua sắm tại Mixer.
🛍️ Hẹn gặp lại bạn ở những đơn hàng tiếp theo nhé!`;

            case 'Đã hủy':
                return `❌ Đơn hàng #${orderId} đã được hủy theo yêu cầu.
Nếu bạn cần hỗ trợ gì thêm, đừng ngại inbox cho mình nhé! 💬`;

            default:
                return '';
        }
    };

    // Xử lý khi chọn trạng thái
    const handleStatusAction = async (order: Order, status: string) => {
        const message = getOrderStatusMessage(order, status);
        if (message && selectedConversation) {
            await sendMessage(message);

            // Nếu là Chờ xử lý và chuyển khoản, gửi thêm VietQR
            if (status === 'Chờ xử lý' && order.paymentMethod !== 'cod' && bankInfo) {
                const qrUrl = getVietQRUrl(order.totalAmount, order.id.substring(0, 8));
                if (qrUrl) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await sendImage(qrUrl);
                }
            }

            if (onUpdateOrderStatus) {
                onUpdateOrderStatus(order.id, status);
            }
            toast.success(`Đã gửi tin ${status} và cập nhật đơn hàng!`);
        }
        setExpandedOrderId(null);
    };

    // Crawl training data từ conversation history
    const crawlTrainingData = async () => {
        setIsCrawling(true);
        try {
            const response = await fetch('/api/facebook/crawl-training?limit=100');
            const data = await response.json();

            if (data.success) {
                setTrainingStats({
                    totalPairs: data.stats.totalPairs,
                    byCategory: data.stats.byCategory
                });
                toast.success(`📚 Đã crawl ${data.stats.totalPairs} training pairs!`);
            } else {
                toast.error(data.error || 'Không thể crawl training data');
            }
        } catch (error) {
            console.error('Crawl error:', error);
            toast.error('Lỗi khi crawl training data');
        } finally {
            setIsCrawling(false);
        }
    };

    // Toggle AI auto-reply và sync với backend
    const toggleAIEnabled = async () => {
        const newValue = !isAIEnabled;
        setIsAIEnabled(newValue);

        try {
            const response = await fetch('/api/ai/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setEnabled', data: { enabled: newValue } })
            });
            const result = await response.json();

            if (result.success) {
                toast.success(`🤖 AI Auto-reply ${newValue ? 'BẬT' : 'TẮT'}!`);
            } else {
                toast.error('Không thể cập nhật AI settings');
                setIsAIEnabled(!newValue); // Rollback
            }
        } catch (error) {
            console.error('Toggle AI error:', error);
            toast.error('Lỗi kết nối');
            setIsAIEnabled(!newValue); // Rollback
        }
    };

    const customerOrders = getCustomerOrders();

    return (
        <div className="card-base overflow-hidden flex flex-col h-[700px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Facebook Messenger</h3>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                            {conversations.length} cuộc hội thoại {hasMore ? '+' : ''}
                        </p>
                    </div>
                    {isAutoRefresh && (
                        <div className="ml-2 flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-100 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                            Đang kết nối
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {/* AI Auto-reply Toggle với Settings */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAIPanel(!showAIPanel)}
                            className={`px-3 py-2 text-[12px] rounded-lg transition-all duration-150 flex items-center gap-2 border font-bold ${isAIEnabled
                                ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                                : 'bg-muted text-muted-foreground border-border'
                                }`}
                            title="Cài đặt AI"
                        >
                            <span>{isAIEnabled ? '🤖 AI Đang hoạt động' : '🤖 AI Đã tắt'}</span>
                            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${showAIPanel ? 'rotate-180' : ''}`} />
                        </button>

                        {/* AI Panel Dropdown */}
                        {showAIPanel && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-border rounded-2xl shadow-soft-lg z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                <h4 className="font-bold text-sm mb-3 flex items-center gap-2 text-foreground">
                                    <SparklesIcon className="w-4 h-4 text-primary" />
                                    AI Auto-Reply Settings
                                </h4>

                                {/* Toggle On/Off */}
                                <div className="flex items-center justify-between mb-4 p-3 bg-muted/30 rounded-xl border border-border/50">
                                    <span className="text-[12px] font-semibold text-foreground">Tự động trả lời</span>
                                    <button
                                        onClick={toggleAIEnabled}
                                        className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${isAIEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isAIEnabled ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                {/* Crawl Training Data */}
                                <div className="border-t border-border/60 pt-4 mt-2">
                                    <div className="flex items-center justify-between mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                                        <span>Dữ liệu huấn luyện</span>
                                        {trainingStats && (
                                            <span className="text-secondary">{trainingStats.totalPairs} pairs</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={crawlTrainingData}
                                        disabled={isCrawling}
                                        className="btn-primary w-full px-3 py-2.5 text-[12px] flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                                    >
                                        {isCrawling ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Đang thu thập...
                                            </>
                                        ) : (
                                            <>📚 Học từ lịch sử chat</>
                                        )}
                                    </button>

                                    {/* Stats Grid */}
                                    {trainingStats && (
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Chào hỏi', count: trainingStats.byCategory.greeting || 0, icon: '👋' },
                                                { label: 'Sản phẩm', count: trainingStats.byCategory.product || 0, icon: '🛍️' },
                                                { label: 'Đơn hàng', count: trainingStats.byCategory.order || 0, icon: '📦' },
                                                { label: 'Vận chuyển', count: trainingStats.byCategory.shipping || 0, icon: '🚚' }
                                            ].map(cat => (
                                                <div key={cat.label} className="bg-muted/30 p-2 rounded-lg border border-border/30 text-center">
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">{cat.icon} {cat.label}</p>
                                                    <p className="text-[13px] font-bold text-foreground">{cat.count}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="mt-4 pt-4 border-t border-border/60">
                                    <div className="flex items-start gap-2 bg-primary/5 p-2 rounded-lg border border-primary/10">
                                        <div className="text-primary mt-0.5">💡</div>
                                        <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                                            AI sẽ tự động học hỏi phong cách trả lời của bạn qua các cuộc hội thoại cũ.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="h-4 w-px bg-border mx-1"></div>
                    <button
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        className={`px-3 py-2 text-[12px] rounded-lg border font-bold transition-all duration-150 flex items-center gap-2 ${isAutoRefresh ? 'bg-secondary/10 text-secondary border-secondary/20 shadow-sm' : 'bg-muted text-muted-foreground border-border'
                            }`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${isAutoRefresh ? 'bg-secondary animate-pulse' : 'bg-muted-foreground'}`}></div>
                        {isAutoRefresh ? 'Tự động tải' : 'Tạm dừng'}
                    </button>
                    <button
                        onClick={() => loadConversations()}
                        disabled={isLoading}
                        className="p-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl border border-transparent hover:border-border transition-all"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex flex-1 min-h-0 bg-muted/20">

                {/* LEFT: Conversation List */}
                <div className="w-[300px] min-w-[300px] border-r border-border flex flex-col bg-white">
                    <div className="p-4 border-b border-border">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Tìm khách hàng..."
                                className="w-full px-4 py-2 bg-muted/30 border border-border rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {isLoading && conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                                <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                <p className="text-xs font-medium text-muted-foreground">Đang tải cuộc trò chuyện...</p>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                                <div className="p-4 bg-muted/50 rounded-full mb-4">
                                    <ChatBubbleLeftEllipsisIcon className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-semibold text-foreground mb-1">Hộp thư trống</p>
                                <p className="text-xs">Chưa có khách hàng nào gửi tin nhắn gần đây.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {conversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        onClick={() => selectConversation(conv)}
                                        className={`p-4 cursor-pointer transition-all relative group ${selectedConversation?.id === conv.id
                                            ? 'bg-primary/5 border-r-2 border-r-primary'
                                            : 'hover:bg-muted/30'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold text-lg shadow-sm border border-primary/10 group-hover:scale-105 transition-transform">
                                                    {conv.customerName.charAt(0).toUpperCase()}
                                                </div>
                                                {conv.isUnread && (
                                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary border-2 border-white rounded-full"></span>
                                                )}
                                            </div>
                                            <div className="flex-grow min-w-0 py-0.5">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className={`text-[13px] truncate tracking-tight ${conv.isUnread ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground/90'}`}>
                                                        {conv.customerName}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                                                        {formatTime(conv.lastMessageTime)}
                                                    </span>
                                                </div>
                                                <p className={`text-[12px] truncate leading-normal ${conv.isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                    {conv.lastMessage}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {hasMore && (
                                    <div className="p-4">
                                        <button
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="w-full py-2.5 bg-white border border-border hover:border-primary/30 hover:shadow-soft-sm rounded-xl text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                                        >
                                            {isLoadingMore ? (
                                                <div className="w-3.5 h-3.5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                            ) : (
                                                <ChevronDownIcon className="w-4 h-4" />
                                            )}
                                            Tải thêm khách hàng
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* MIDDLE: Chat Window */}
                <div className="flex-1 flex flex-col min-w-0 bg-white border-r border-border">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-6 py-3 border-b border-border bg-white flex items-center justify-between h-16">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/10">
                                        {selectedConversation.customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-[14px] text-foreground leading-tight">{selectedConversation.customerName}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Facebook Messenger</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {onCreateOrderWithAI && (
                                        <button
                                            onClick={handleCreateOrder}
                                            disabled={isParsingOrder}
                                            className="btn-primary flex items-center gap-2 px-4 py-2 text-[12px] font-bold disabled:opacity-50 shadow-sm"
                                        >
                                            {isParsingOrder ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Đang phân tích...
                                                </>
                                            ) : (
                                                <>
                                                    <SparklesIcon className="w-4 h-4" />
                                                    AI Tạo đơn
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {/* Nút gửi xác nhận đơn hàng - COD và Chuyển khoản */}
                                    {parsedOrderData && (
                                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border">
                                            <button
                                                onClick={() => sendOrderConfirmation(undefined, 'cod')}
                                                disabled={isSending}
                                                className="px-3 py-1.5 bg-white text-foreground text-[11px] font-bold rounded-lg border border-border hover:border-primary/30 hover:text-primary transition-all shadow-sm disabled:opacity-50"
                                            >
                                                💵 Xác nhận COD
                                            </button>
                                            <button
                                                onClick={() => sendOrderConfirmation(undefined, 'bank_transfer')}
                                                disabled={isSending}
                                                className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
                                            >
                                                🏦 Gửi QR CK
                                            </button>
                                        </div>
                                    )}
                                    <div className="w-px h-6 bg-border mx-1"></div>
                                    <button
                                        onClick={() => setShowCustomerPanel(!showCustomerPanel)}
                                        className={`p-2.5 rounded-xl border transition-all ${showCustomerPanel ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:bg-muted border-transparent'}`}
                                    >
                                        <UserIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted/10 custom-scrollbar">
                                {isLoadingMessages ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3">
                                        <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                        <p className="text-xs font-medium text-muted-foreground">Đang tải tin nhắn...</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-40">
                                        <div className="p-4 bg-muted/50 rounded-full mb-4">
                                            <ChatBubbleLeftEllipsisIcon className="w-12 h-12" />
                                        </div>
                                        <p className="text-sm font-semibold">Bắt đầu trò chuyện</p>
                                        <p className="text-xs mt-1">Gửi lời chào đầu tiên đến khách hàng!</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.isFromPage ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${msg.isFromPage
                                                    ? 'bg-primary text-white rounded-tr-none'
                                                    : 'bg-white text-foreground border border-border rounded-tl-none'
                                                    }`}
                                            >
                                                {/* Hiển thị ảnh/attachments */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="mb-3 grid grid-cols-1 gap-2">
                                                        {msg.attachments.map((att, idx) => (
                                                            att.type === 'image' ? (
                                                                <div key={idx} className="relative group overflow-hidden rounded-xl border border-border">
                                                                    <img
                                                                        src={att.url}
                                                                        alt={att.name || 'Image'}
                                                                        className="max-w-full hover:scale-105 transition-transform duration-300 cursor-pointer"
                                                                        onClick={() => window.open(att.url, '_blank')}
                                                                    />
                                                                </div>
                                                            ) : att.type === 'video' ? (
                                                                <video
                                                                    key={idx}
                                                                    src={att.url}
                                                                    controls
                                                                    className="max-w-full rounded-xl border border-border shadow-sm"
                                                                />
                                                            ) : (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl hover:bg-muted text-[13px] border border-border transition-all"
                                                                >
                                                                    <div className="p-2 bg-white rounded-lg shadow-sm">📎</div>
                                                                    <span className="font-medium truncate">{att.name || 'Tải file đính kèm'}</span>
                                                                </a>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Text message */}
                                                {msg.text && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                                                <p className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${msg.isFromPage ? 'text-white/60 text-right' : 'text-muted-foreground/60'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Quick Actions Row */}
                            <div className="px-6 py-2 border-t border-border bg-white flex flex-wrap gap-2">
                                <button
                                    onClick={() => { setShowTemplates(!showTemplates); setShowEmojis(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${showTemplates ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}
                                >
                                    ⚡ Mẫu tin nhắn
                                </button>
                                <button
                                    onClick={() => { setShowEmojis(!showEmojis); setShowTemplates(false); }}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border ${showEmojis ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'}`}
                                >
                                    😊 Emoji
                                </button>
                            </div>

                            {/* Overlays Container */}
                            <div className="relative px-6">
                                {/* Quick Templates Overlay */}
                                {showTemplates && (
                                    <div className="absolute bottom-full left-6 right-6 mb-2 p-3 bg-white border border-border rounded-xl shadow-soft-lg z-20 max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2">
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {QUICK_TEMPLATES.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => { sendMessage(t.text); setShowTemplates(false); }}
                                                    className="text-left px-3 py-2 hover:bg-muted rounded-lg text-[13px] font-medium text-foreground transition-colors border border-transparent hover:border-border/50"
                                                >
                                                    <span className="font-bold text-primary mr-2">{t.label}</span>
                                                    <span className="text-muted-foreground line-clamp-1">{t.text}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Emoji Overlay */}
                                {showEmojis && (
                                    <div className="absolute bottom-full left-6 right-6 mb-2 p-3 bg-white border border-border rounded-xl shadow-soft-lg z-20 animate-in slide-in-from-bottom-2">
                                        <div className="grid grid-cols-8 gap-1">
                                            {COMMON_EMOJIS.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => { insertEmoji(emoji); setShowEmojis(false); }}
                                                    className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-xl text-xl transition-all hover:scale-110"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white border-t border-border">
                                <div className="flex items-end gap-3 p-1.5 rounded-[24px] bg-muted/30 border border-border focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                                    <div className="flex-1">
                                        <textarea
                                            ref={inputRef as any}
                                            rows={1}
                                            value={newMessage}
                                            onChange={(e) => {
                                                setNewMessage(e.target.value);
                                                // Auto-resize
                                                e.target.style.height = 'auto';
                                                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                                            }}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Phản hồi khách hàng..."
                                            className="w-full px-5 py-3 focus:outline-none text-[14px] bg-transparent resize-none leading-relaxed"
                                            disabled={isSending}
                                        />
                                    </div>
                                    <div className="pb-1 pr-1">
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={isSending || !newMessage.trim()}
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm group"
                                        >
                                            {isSending ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <PaperAirplaneIcon className="w-5 h-5 -rotate-45 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground/50 mt-3 text-center font-bold uppercase tracking-[0.15em]">
                                    Enter để gửi • Shift+Enter để xuống dòng
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10 p-12 text-center">
                            <div className="p-6 bg-white rounded-[32px] shadow-soft-lg mb-8 animate-bounce transition-all duration-1000">
                                <ChatBubbleLeftEllipsisIcon className="w-16 h-16 text-primary/40" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">Hộp thư Facebook</h3>
                            <p className="text-sm max-w-xs text-muted-foreground leading-relaxed">Chọn một cuộc hội thoại từ danh sách bên trái để bắt đầu quản lý bán hàng.</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Customer Info Panel */}
                {showCustomerPanel && selectedConversation && (
                    <div className="w-[300px] min-w-[300px] border-l border-border bg-white flex flex-col p-5 animate-in slide-in-from-right-4 overflow-y-auto custom-scrollbar">
                        {/* Customer Header */}
                        <div className="text-center mb-6">
                            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary text-3xl font-black mx-auto mb-4 shadow-soft border border-primary/20">
                                {selectedConversation.customerName.charAt(0).toUpperCase()}
                            </div>
                            <h4 className="text-base font-bold text-foreground">{selectedConversation.customerName}</h4>
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                                <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Khách hàng VIP</p>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-3 gap-2 mb-8">
                            {[
                                { label: 'Gọi điện', icon: PhoneIcon, color: 'text-primary', bg: 'bg-primary/5' },
                                { label: 'AI Đơn', icon: SparklesIcon, color: 'text-secondary', bg: 'bg-secondary/5', onClick: handleCreateOrder },
                                { label: 'Giỏ hàng', icon: ShoppingBagIcon, color: 'text-green-600', bg: 'bg-green-50' }
                            ].map((action, i) => (
                                <button
                                    key={i}
                                    onClick={action.onClick}
                                    className="flex flex-col items-center gap-2 p-3 bg-white border border-border rounded-2xl hover:border-primary/30 hover:shadow-soft-sm transition-all group"
                                >
                                    <div className={`p-2 ${action.bg} ${action.color} rounded-xl group-hover:scale-110 transition-transform`}>
                                        <action.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{action.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Order History */}
                        <div className="flex-1 -mx-2 px-2">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-2">
                                    <ClockIcon className="w-3.5 h-3.5" />
                                    Lịch sử mua hàng
                                </h5>
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{customerOrders.length} Đơn</span>
                            </div>

                            {customerOrders.length > 0 ? (
                                <div className="space-y-3">
                                    {customerOrders.map(order => (
                                        <div key={order.id} className={`bg-white rounded-2xl border transition-all ${expandedOrderId === order.id ? 'border-primary/30 shadow-soft' : 'border-border hover:border-primary/20'}`}>
                                            <div
                                                className="p-4 cursor-pointer"
                                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[13px] font-bold text-foreground">#{order.id.slice(0, 8)}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${order.status === 'Đã giao hàng' ? 'bg-green-50 text-green-700' :
                                                        order.status === 'Đã hủy' ? 'bg-red-50 text-red-700' :
                                                            'bg-orange-50 text-orange-700'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[12px] font-bold text-primary">
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount)}
                                                    </p>
                                                    <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expandedOrderId === order.id ? 'rotate-180' : ''}`} />
                                                </div>
                                            </div>

                                            {/* Dropdown Menu */}
                                            {expandedOrderId === order.id && (
                                                <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                                                    <div className="h-px bg-border/50 mb-3"></div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Thông báo trạng thái:</p>
                                                    <div className="grid grid-cols-2 gap-1.5 mb-4">
                                                        {ORDER_STATUSES.slice(1).map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleStatusAction(order, status)}
                                                                disabled={isSending}
                                                                className="text-[11px] font-bold py-2 bg-muted/50 hover:bg-muted text-foreground rounded-xl transition-all border border-border/30"
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                onViewOrder?.(order);
                                                                setExpandedOrderId(null);
                                                            }}
                                                            className="flex-1 text-[11px] font-bold py-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all font-bold"
                                                        >
                                                            Chi tiết
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                onEditOrder?.(order);
                                                                setExpandedOrderId(null);
                                                            }}
                                                            className="flex-1 text-[11px] font-bold py-2.5 bg-muted text-foreground rounded-xl hover:bg-muted/80 transition-all border border-border/50 font-bold"
                                                        >
                                                            Sửa đơn
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-muted/20 rounded-3xl border border-dashed border-border/50">
                                    <p className="text-[12px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">Hưa có đơn hàng</p>
                                </div>
                            )}
                        </div>

                        {/* Customer Notes */}
                        <div className="mt-6">
                            <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                <PlusIcon className="w-3.5 h-3.5" />
                                Ghi chú nội bộ
                            </h5>
                            <textarea
                                placeholder="Vd: Khách hay mua size L, ưu tiên giao sớm..."
                                className="w-full p-4 text-[13px] bg-muted/30 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all min-h-[100px] leading-relaxed"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FacebookInbox;
