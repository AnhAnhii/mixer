import React from 'react';
import type { Message } from './types';
import { formatRelativeTime } from './types';

interface MessageBubbleProps {
    message: Message;
    pageId: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, pageId }) => {
    const isFromPage = message.isFromPage;

    return (
        <div className={`flex ${isFromPage ? 'justify-end' : 'justify-start'} mb-2`}>
            <div className={`max-w-[70%] ${isFromPage ? 'order-1' : 'order-2'}`}>
                <div
                    className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${isFromPage
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}
                >
                    {message.text}
                </div>

                {/* Attachments */}
                {message.attachments?.map((att, idx) => (
                    <div key={idx} className="mt-1">
                        {att.type === 'image' ? (
                            <img
                                src={att.url}
                                alt="attachment"
                                className="max-w-[250px] rounded-lg border border-border cursor-pointer hover:opacity-90"
                                onClick={() => window.open(att.url, '_blank')}
                            />
                        ) : (
                            <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary underline"
                            >
                                📎 {att.name || 'File đính kèm'}
                            </a>
                        )}
                    </div>
                ))}

                <span className={`text-[10px] text-muted-foreground mt-0.5 block ${isFromPage ? 'text-right' : 'text-left'}`}>
                    {formatRelativeTime(message.timestamp)}
                </span>
            </div>
        </div>
    );
};

export default React.memo(MessageBubble);
