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
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config';
import type { Order, Product, OrderItem, Customer } from '../types';

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
            let url = `${API_BASE}/api/facebook/conversations?limit=50`;
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
            if (!GEMINI_API_KEY) {
                throw new Error("Chưa cấu hình GEMINI_API_KEY");
            }

            const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                }
            });

            const parsed = JSON.parse(response.text || '{}');

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
            console.error('AI Parse Error:', err);
            toast.error('Lỗi phân tích: ' + (err instanceof Error ? err.message : 'Unknown'));
        } finally {
            setIsParsingOrder(false);
        }
    };

    // Normalize Vietnamese text - remove accents for matching
    const normalizeVietnamese = (str: string): string => {
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .trim();
    };

    // Get customer order history - priority: facebookUserId > name matching (normalized)
    const getCustomerOrders = useCallback(() => {
        if (!selectedConversation) return [];

        const facebookId = selectedConversation.recipientId;
        const customerName = selectedConversation.customerName.toLowerCase().trim();
        const customerNameNormalized = normalizeVietnamese(selectedConversation.customerName);

        console.log('[getCustomerOrders] Searching:', { facebookId, customerName, customerNameNormalized, totalOrders: orders.length });

        const matched = orders.filter(o => {
            // Priority 1: Match by Facebook User ID (most accurate)
            if (facebookId && o.facebookUserId === facebookId) {
                console.log('[getCustomerOrders] Matched by facebookUserId:', o.id);
                return true;
            }

            // Priority 2: Match by Facebook username (normalized)
            if (o.facebookUserName) {
                const orderFbName = normalizeVietnamese(o.facebookUserName);
                if (orderFbName === customerNameNormalized) {
                    console.log('[getCustomerOrders] Matched by facebookUserName:', o.id, o.facebookUserName);
                    return true;
                }
            }

            // Priority 3: Match by customer name (normalized - handles Vietnamese accents)
            const orderNameNormalized = normalizeVietnamese(o.customerName);
            if (orderNameNormalized === customerNameNormalized) {
                console.log('[getCustomerOrders] Matched by customerName (normalized):', o.id);
                return true;
            }

            return false;
        });

        console.log('[getCustomerOrders] Total matched:', matched.length);

        // Sort by orderDate (Supabase) or createdAt (localStorage)
        return matched.sort((a, b) => {
            const dateA = new Date(a.orderDate || 0).getTime();
            const dateB = new Date(b.orderDate || 0).getTime();
            return dateB - dateA;
        }).slice(0, 5);
    }, [selectedConversation, orders]);

    useEffect(() => {
        loadConversations();
    }, []);

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
            ? `Đơn vị vận chuyển: ${order.shippingProvider} - Mã vận đơn: ${order.trackingCode}`
            : `Đơn vị vận chuyển: [Vui lòng cập nhật trong chi tiết đơn hàng]`;

        // Template cho COD  
        const codTemplate = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}

- Tên người nhận: ${order.customerName}
- Số điện thoại: ${order.customerPhone}
- Địa chỉ: ${order.shippingAddress}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

Đơn hàng của bạn sẽ được giao COD (thanh toán khi nhận hàng) ♥
Dự kiến giao hàng trong 2-4 ngày. Cảm ơn bạn!`;

        // Template cho chuyển khoản
        const bankTransferTemplate = `Dạ cho mình xác nhận lại thông tin đơn hàng bạn đã đặt nha
Mã đơn hàng #${orderId} được đặt vào lúc ${formatDate(order.orderDate)}

- Tên người nhận: ${order.customerName}
- Số điện thoại: ${order.customerPhone}
- Địa chỉ: ${order.shippingAddress}

Sản phẩm bao gồm:
${productList}
- Tổng trị giá đơn hàng: ${formatCurrency(order.totalAmount)}

Bạn xác nhận lại thông tin nhận hàng, sản phẩm, size, màu sắc, số lượng rồi quét mã QR bên dưới để chuyển khoản giúp mình nhé ♥
Đơn hàng sẽ được giữ trong vòng 24h, sau 24h sẽ tự động huỷ nếu chưa chuyển khoản ạ.`;

        switch (status) {
            case 'Chờ xử lý':
                return order.paymentMethod === 'cod' ? codTemplate : bankTransferTemplate;

            case 'Đang xử lý':
                return `Mixer xác nhận đã nhận được thanh toán cho đơn hàng #${orderId}.
Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được gửi đi.
Cảm ơn bạn đã mua sắm!`;

            case 'Đã gửi hàng':
                return `Mixer xin thông báo: Đơn hàng #${orderId} của bạn đã được gửi đi.
${shippingDetails}
Bạn vui lòng để ý điện thoại để nhận hàng trong vài ngày tới nhé. Cảm ơn bạn!`;

            case 'Đã giao hàng':
                return `Mixer xin thông báo: Đơn hàng #${orderId} đã được giao thành công.
Cảm ơn bạn đã tin tưởng và mua sắm tại Mixer. Hẹn gặp lại bạn ở những đơn hàng tiếp theo nhé!`;

            case 'Đã hủy':
                return `Đơn hàng #${orderId} đã được hủy theo yêu cầu.
Nếu bạn cần hỗ trợ gì thêm, đừng ngại inbox cho mình nhé!`;

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
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                    <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Facebook Messenger</h3>
                    <span className="text-xs text-muted-foreground">
                        ({conversations.length} cuộc hội thoại{hasMore ? '+' : ''})
                    </span>
                    {isAutoRefresh && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Live
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* AI Auto-reply Toggle với Settings */}
                    <div className="relative">
                        <button
                            onClick={() => setShowAIPanel(!showAIPanel)}
                            className={`px-2 py-1 text-xs rounded-lg transition-colors flex items-center gap-1 ${isAIEnabled
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                : 'bg-muted text-muted-foreground'
                                }`}
                            title="Cài đặt AI"
                        >
                            {isAIEnabled ? '🤖 AI On' : '🤖 AI Off'}
                            <span className="text-xs">{showAIPanel ? '▲' : '▼'}</span>
                        </button>

                        {/* AI Panel Dropdown */}
                        {showAIPanel && (
                            <div className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 p-3">
                                <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
                                    🤖 AI Auto-Reply Settings
                                </h4>

                                {/* Toggle On/Off */}
                                <div className="flex items-center justify-between mb-3 p-2 bg-muted/50 rounded-lg">
                                    <span className="text-xs">Tự động trả lời</span>
                                    <button
                                        onClick={toggleAIEnabled}
                                        className={`px-2 py-1 text-xs rounded ${isAIEnabled
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-muted-foreground/20 text-muted-foreground'
                                            }`}
                                    >
                                        {isAIEnabled ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                {/* Crawl Training Data */}
                                <div className="border-t border-border pt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-muted-foreground">Training Data</span>
                                        {trainingStats && (
                                            <span className="text-xs text-green-600">{trainingStats.totalPairs} pairs</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={crawlTrainingData}
                                        disabled={isCrawling}
                                        className="w-full px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCrawling ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Đang crawl...
                                            </>
                                        ) : (
                                            <>📚 Crawl từ Conversation</>
                                        )}
                                    </button>

                                    {/* Stats */}
                                    {trainingStats && (
                                        <div className="mt-2 text-xs text-muted-foreground grid grid-cols-2 gap-1">
                                            <span>👋 Greeting: {trainingStats.byCategory.greeting || 0}</span>
                                            <span>🛍️ Product: {trainingStats.byCategory.product || 0}</span>
                                            <span>📦 Order: {trainingStats.byCategory.order || 0}</span>
                                            <span>🚚 Ship: {trainingStats.byCategory.shipping || 0}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs text-muted-foreground">
                                        💡 AI sẽ học từ cách nhân viên trả lời trong conversation cũ
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${isAutoRefresh ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        {isAutoRefresh ? '🔄 Auto' : '⏸️ Paused'}
                    </button>
                    <button
                        onClick={() => loadConversations()}
                        disabled={isLoading}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex" style={{ height: '600px' }}>

                {/* LEFT: Conversation List */}
                <div className="w-[280px] min-w-[280px] border-r border-border flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        {isLoading && conversations.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mb-2 opacity-50" />
                                <p>Chưa có cuộc hội thoại</p>
                            </div>
                        ) : (
                            <>
                                {conversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        onClick={() => selectConversation(conv)}
                                        className={`p-3 cursor-pointer border-b border-border hover:bg-muted/50 transition-colors ${selectedConversation?.id === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                                                {conv.customerName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className={`font-medium text-sm truncate ${conv.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {conv.customerName}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                                        {formatTime(conv.lastMessageTime)}
                                                    </span>
                                                </div>
                                                <p className={`text-xs truncate ${conv.isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                    {conv.lastMessage}
                                                </p>
                                            </div>
                                            {conv.isUnread && (
                                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {hasMore && (
                                    <div className="p-2">
                                        <button
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="w-full py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                        >
                                            {isLoadingMore ? (
                                                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <ChevronDownIcon className="w-3 h-3" />
                                            )}
                                            Tải thêm
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* MIDDLE: Chat Window */}
                <div className="flex-1 flex flex-col min-w-0">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                                        {selectedConversation.customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{selectedConversation.customerName}</p>
                                        <p className="text-xs text-muted-foreground">Facebook Messenger</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {onCreateOrderWithAI && (
                                        <button
                                            onClick={handleCreateOrder}
                                            disabled={isParsingOrder}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
                                        >
                                            {isParsingOrder ? (
                                                <>
                                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    Đang phân tích...
                                                </>
                                            ) : (
                                                <>
                                                    <SparklesIcon className="w-3 h-3" />
                                                    AI Tạo đơn
                                                </>
                                            )}
                                        </button>
                                    )}
                                    {/* Nút gửi xác nhận đơn hàng - COD và Chuyển khoản */}
                                    {parsedOrderData && (
                                        <>
                                            <button
                                                onClick={() => sendOrderConfirmation(undefined, 'cod')}
                                                disabled={isSending}
                                                className="flex items-center gap-1 px-2 py-1.5 bg-orange-500 text-white text-xs rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-all"
                                            >
                                                💵 COD
                                            </button>
                                            <button
                                                onClick={() => sendOrderConfirmation(undefined, 'bank_transfer')}
                                                disabled={isSending}
                                                className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
                                            >
                                                🏦 CK
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setShowCustomerPanel(!showCustomerPanel)}
                                        className={`p-1.5 rounded-lg transition-colors ${showCustomerPanel ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                    >
                                        <UserIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/10">
                                {isLoadingMessages ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center text-muted-foreground py-8">
                                        Chưa có tin nhắn
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.isFromPage ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[75%] px-3 py-2 rounded-2xl ${msg.isFromPage
                                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                                    : 'bg-card text-foreground rounded-bl-md border border-border'
                                                    }`}
                                            >
                                                {/* Hiển thị ảnh/attachments */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="mb-2 space-y-2">
                                                        {msg.attachments.map((att, idx) => (
                                                            att.type === 'image' ? (
                                                                <img
                                                                    key={idx}
                                                                    src={att.url}
                                                                    alt={att.name || 'Image'}
                                                                    className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
                                                                    onClick={() => window.open(att.url, '_blank')}
                                                                />
                                                            ) : att.type === 'video' ? (
                                                                <video
                                                                    key={idx}
                                                                    src={att.url}
                                                                    controls
                                                                    className="max-w-full rounded-lg"
                                                                />
                                                            ) : (
                                                                <a
                                                                    key={idx}
                                                                    href={att.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg hover:bg-muted text-xs"
                                                                >
                                                                    📎 {att.name || 'File'}
                                                                </a>
                                                            )
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Text message */}
                                                {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
                                                <p className={`text-xs mt-1 ${msg.isFromPage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Quick Templates */}
                            {showTemplates && (
                                <div className="px-3 py-2 border-t border-border bg-muted/30">
                                    <div className="flex flex-wrap gap-1">
                                        {QUICK_TEMPLATES.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => sendMessage(t.text)}
                                                disabled={isSending}
                                                className="px-2 py-1 bg-card border border-border rounded-lg text-xs hover:bg-muted transition-colors"
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Emoji Picker */}
                            {showEmojis && (
                                <div className="px-3 py-2 border-t border-border bg-muted/30">
                                    <div className="flex flex-wrap gap-1">
                                        {COMMON_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => insertEmoji(emoji)}
                                                className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded text-lg"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input Area */}
                            <div className="p-3 border-t border-border bg-card">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => { setShowTemplates(!showTemplates); setShowEmojis(false); }}
                                        className={`p-2 rounded-lg transition-colors ${showTemplates ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                        title="Mẫu tin nhắn"
                                    >
                                        ⚡
                                    </button>
                                    <button
                                        onClick={() => { setShowEmojis(!showEmojis); setShowTemplates(false); }}
                                        className={`p-2 rounded-lg transition-colors ${showEmojis ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                                        title="Emoji"
                                    >
                                        😊
                                    </button>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Nhập tin nhắn..."
                                        className="flex-grow px-3 py-2 rounded-full border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                                        disabled={isSending}
                                    />
                                    <button
                                        onClick={() => sendMessage()}
                                        disabled={isSending || !newMessage.trim()}
                                        className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                        {isSending ? (
                                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <PaperAirplaneIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10">
                            <ChatBubbleLeftEllipsisIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="font-medium">Chọn một cuộc hội thoại</p>
                            <p className="text-sm">để bắt đầu trả lời khách hàng</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Customer Info Panel */}
                {showCustomerPanel && selectedConversation && (
                    <div className="w-[240px] min-w-[240px] border-l border-border bg-muted/20 flex flex-col">
                        {/* Customer Header */}
                        <div className="p-4 border-b border-border text-center">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-2">
                                {selectedConversation.customerName.charAt(0).toUpperCase()}
                            </div>
                            <h4 className="font-semibold">{selectedConversation.customerName}</h4>
                            <p className="text-xs text-muted-foreground">Facebook User</p>
                        </div>

                        {/* Quick Actions */}
                        <div className="p-3 border-b border-border">
                            <div className="grid grid-cols-2 gap-2">
                                <button className="flex flex-col items-center gap-1 p-2 bg-card rounded-lg hover:bg-muted transition-colors">
                                    <PhoneIcon className="w-4 h-4 text-primary" />
                                    <span className="text-xs">Gọi điện</span>
                                </button>
                                {onCreateOrderWithAI && (
                                    <button
                                        onClick={handleCreateOrder}
                                        disabled={isParsingOrder}
                                        className="flex flex-col items-center gap-1 p-2 bg-card rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        {isParsingOrder ? (
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <SparklesIcon className="w-4 h-4 text-primary" />
                                        )}
                                        <span className="text-xs">AI Tạo đơn</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Order History */}
                        <div className="flex-1 overflow-y-auto p-3">
                            <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                                <ClockIcon className="w-4 h-4" />
                                Lịch sử đơn hàng
                            </h5>
                            {customerOrders.length > 0 ? (
                                <div className="space-y-2">
                                    {customerOrders.map(order => (
                                        <div key={order.id} className="p-2 bg-card rounded-lg border border-border relative">
                                            <div
                                                className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                            >
                                                <span className="text-xs font-medium">#{order.id.slice(0, 8)}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${order.status === 'Đã giao hàng' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        order.status === 'Đã hủy' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{expandedOrderId === order.id ? '▲' : '▼'}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.totalAmount)}
                                            </p>

                                            {/* Dropdown Menu */}
                                            {expandedOrderId === order.id && (
                                                <div className="mt-2 pt-2 border-t border-border space-y-1">
                                                    {/* Status Actions */}
                                                    <div className="text-xs text-muted-foreground mb-1">📨 Gửi tin theo trạng thái:</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {ORDER_STATUSES.map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleStatusAction(order, status)}
                                                                disabled={isSending}
                                                                className={`text-xs px-2 py-1 rounded transition-colors ${status === 'Đã hủy'
                                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                                                                    : status === 'Đã giao hàng'
                                                                        ? 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
                                                                        : 'bg-muted hover:bg-muted/80'
                                                                    }`}
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Other Actions */}
                                                    <div className="flex gap-2 mt-2">
                                                        {onViewOrder && (
                                                            <button
                                                                onClick={() => {
                                                                    onViewOrder(order);
                                                                    setExpandedOrderId(null);
                                                                }}
                                                                className="flex-1 text-xs px-2 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                                                            >
                                                                👁️ Xem chi tiết
                                                            </button>
                                                        )}
                                                        {onEditOrder && (
                                                            <button
                                                                onClick={() => {
                                                                    onEditOrder(order);
                                                                    setExpandedOrderId(null);
                                                                }}
                                                                className="flex-1 text-xs px-2 py-1.5 bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
                                                            >
                                                                ✏️ Sửa đơn
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                    Chưa có đơn hàng
                                </p>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="p-3 border-t border-border">
                            <h5 className="font-medium text-sm mb-2">📝 Ghi chú</h5>
                            <textarea
                                placeholder="Thêm ghi chú về khách..."
                                className="w-full p-2 text-xs border border-border rounded-lg bg-card resize-none"
                                rows={3}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                <span>Cập nhật: {lastRefresh.toLocaleTimeString('vi-VN')}</span>
                <span className="text-primary">{conversations.length} cuộc hội thoại</span>
            </div>
        </div>
    );
};

export default FacebookInbox;
