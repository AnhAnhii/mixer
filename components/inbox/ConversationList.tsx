import React from 'react';
import { ChatBubbleLeftEllipsisIcon, ChevronDownIcon } from '../icons';
import type { Conversation } from './types';
import { formatRelativeTime } from './types';

interface ConversationListProps {
    conversations: Conversation[];
    selectedId: string | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    onSelect: (conv: Conversation) => void;
    onLoadMore: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
    conversations,
    selectedId,
    isLoading,
    isLoadingMore,
    hasMore,
    onSelect,
    onLoadMore,
}) => {
    if (isLoading && conversations.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mb-2 opacity-50" />
                <p>Chưa có cuộc hội thoại</p>
            </div>
        );
    }

    return (
        <>
            {conversations.map((conv) => (
                <div
                    key={conv.id}
                    onClick={() => onSelect(conv)}
                    className={`p-3 cursor-pointer border-b border-border hover:bg-muted/50 transition-colors ${selectedId === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''
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
                                    {formatRelativeTime(conv.lastMessageTime)}
                                </span>
                            </div>
                            <p className={`text-xs truncate ${conv.isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                {conv.lastMessage}
                            </p>
                        </div>
                        {conv.isUnread && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                    </div>
                </div>
            ))}

            {hasMore && (
                <div className="p-2">
                    <button
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                        className="w-full py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                    >
                        {isLoadingMore ? (
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <ChevronDownIcon className="w-3 h-3" />
                        )}
                        Tải thêm
                    </button>
                </div>
            )}
        </>
    );
};

export default ConversationList;
