// components/FacebookInbox.tsx
// Component hiển thị Facebook Messenger Inbox trong Mixer App

import React, { useState, useEffect, useRef } from 'react';
import { ChatBubbleLeftEllipsisIcon, PaperAirplaneIcon, ArrowPathIcon, ChevronDownIcon } from './icons';
import { useToast } from './Toast';

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
}

interface FacebookInboxProps {
    pageId?: string;
}

// Vercel API base URL
const API_BASE = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://mixerottn.vercel.app';

const FacebookInbox: React.FC<FacebookInboxProps> = ({ pageId = '105265398928721' }) => {
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

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedConversationRef = useRef<Conversation | null>(null);

    // Keep ref in sync with state for interval access
    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    // Scroll to bottom when new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const loadMessages = async (conversationId: string) => {
        setIsLoadingMessages(true);
        try {
            const response = await fetch(
                `${API_BASE}/api/facebook/messages?conversationId=${conversationId}`
            );
            const data = await response.json();

            if (data.success) {
                setMessages(data.messages.reverse());
            } else {
                console.error('Error loading messages:', data.error);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const selectConversation = (conv: Conversation) => {
        setSelectedConversation(conv);
        loadMessages(conv.id);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_BASE}/api/facebook/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: selectedConversation.recipientId,
                    message: newMessage.trim(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                const newMsg: Message = {
                    id: data.messageId,
                    text: newMessage.trim(),
                    senderId: pageId,
                    senderName: 'Shop',
                    isFromPage: true,
                    timestamp: new Date().toISOString(),
                };
                setMessages([...messages, newMsg]);
                setNewMessage('');
                toast.success('Đã gửi tin nhắn!');
                setTimeout(() => loadMessages(selectedConversation.id), 1000);
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

    useEffect(() => {
        loadConversations();
    }, []);

    // Auto-refresh conversations every 30 seconds
    useEffect(() => {
        if (!isAutoRefresh) return;

        const interval = setInterval(() => {
            loadConversations();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [isAutoRefresh]);

    // Auto-refresh messages every 10 seconds when a conversation is selected
    useEffect(() => {
        if (!isAutoRefresh || !selectedConversation) return;

        const interval = setInterval(() => {
            if (selectedConversationRef.current) {
                loadMessages(selectedConversationRef.current.id);
            }
        }, 10000); // 10 seconds

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
                    {/* Live Indicator */}
                    {isAutoRefresh && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Live
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Auto-refresh Toggle */}
                    <button
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${isAutoRefresh
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}
                        title={isAutoRefresh ? 'Tắt auto-refresh' : 'Bật auto-refresh'}
                    >
                        {isAutoRefresh ? '🔄 Auto' : '⏸️ Paused'}
                    </button>
                    {/* Refresh Button */}
                    <button
                        onClick={() => loadConversations()}
                        disabled={isLoading}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Làm mới"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Content - Fixed height with flex layout */}
            <div className="flex" style={{ height: '550px' }}>

                {/* LEFT: Conversation List - Fixed width */}
                <div className="w-[320px] min-w-[320px] border-r border-border flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        {isLoading && conversations.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mb-2 opacity-50" />
                                <p>Chưa có cuộc hội thoại</p>
                                <button
                                    onClick={() => loadConversations()}
                                    className="mt-2 text-primary text-sm hover:underline"
                                >
                                    Tải lại
                                </button>
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
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                {conv.customerName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`font-medium truncate ${conv.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                        {conv.customerName}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                                        {formatTime(conv.lastMessageTime)}
                                                    </span>
                                                </div>
                                                <p className={`text-sm truncate ${conv.isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                                    {conv.lastMessage}
                                                </p>
                                            </div>
                                            {conv.isUnread && (
                                                <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {hasMore && (
                                    <div className="p-3">
                                        <button
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="w-full py-2 px-4 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                    Đang tải...
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDownIcon className="w-4 h-4" />
                                                    Tải thêm
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* RIGHT: Chat Window - Flexible width */}
                <div className="flex-1 flex flex-col min-w-0">
                    {selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                                        {selectedConversation.customerName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{selectedConversation.customerName}</p>
                                        <p className="text-xs text-muted-foreground">Facebook Messenger</p>
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
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
                                                className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm ${msg.isFromPage
                                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                                    : 'bg-card text-foreground rounded-bl-md border border-border'
                                                    }`}
                                            >
                                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                                <p className={`text-xs mt-1 ${msg.isFromPage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-border bg-card flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Nhập tin nhắn..."
                                        className="flex-grow px-4 py-2.5 rounded-full border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-background transition-colors"
                                        disabled={isSending}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={isSending || !newMessage.trim()}
                                        className="p-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {isSending ? (
                                            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <PaperAirplaneIcon className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10">
                            <ChatBubbleLeftEllipsisIcon className="w-20 h-20 mb-4 opacity-20" />
                            <p className="text-lg font-medium">Chọn một cuộc hội thoại</p>
                            <p className="text-sm">để bắt đầu trả lời khách hàng</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                <span>Cập nhật lần cuối: {lastRefresh.toLocaleTimeString('vi-VN')}</span>
                <span className="text-primary">{conversations.length} cuộc hội thoại</span>
            </div>
        </div>
    );
};

export default FacebookInbox;
