import React, { useRef, useState } from 'react';
import { PaperAirplaneIcon, FaceSmileIcon } from '../icons';
import { QUICK_TEMPLATES, COMMON_EMOJIS } from './types';

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: (text?: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    isSending: boolean;
    disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
    value,
    onChange,
    onSend,
    onKeyDown,
    isSending,
    disabled,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);

    const handleTemplateClick = (text: string) => {
        onSend(text);
        setShowTemplates(false);
    };

    const handleEmojiClick = (emoji: string) => {
        onChange(value + emoji);
        setShowEmojis(false);
        inputRef.current?.focus();
    };

    return (
        <div className="border-t border-border">
            {/* Quick Templates */}
            {showTemplates && (
                <div className="p-2 border-b border-border bg-muted/30 flex flex-wrap gap-1">
                    {QUICK_TEMPLATES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handleTemplateClick(t.text)}
                            className="px-2 py-1 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                            title={t.text}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Emoji Picker */}
            {showEmojis && (
                <div className="p-2 border-b border-border bg-muted/30 flex flex-wrap gap-1">
                    {COMMON_EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            onClick={() => handleEmojiClick(emoji)}
                            className="p-1.5 hover:bg-muted rounded text-lg"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Bar */}
            <div className="flex items-center gap-2 p-3">
                <button
                    onClick={() => { setShowTemplates(!showTemplates); setShowEmojis(false); }}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                    title="Mẫu tin nhắn nhanh"
                >
                    ⚡
                </button>
                <button
                    onClick={() => { setShowEmojis(!showEmojis); setShowTemplates(false); }}
                    className="p-2 hover:bg-muted rounded-lg text-muted-foreground"
                >
                    <FaceSmileIcon className="w-5 h-5" />
                </button>

                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Nhập tin nhắn..."
                    className="flex-grow bg-muted rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    disabled={disabled}
                />

                <button
                    onClick={() => onSend()}
                    disabled={!value.trim() || isSending || disabled}
                    className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <PaperAirplaneIcon className="w-5 h-5" />
                    )}
                </button>
            </div>
        </div>
    );
};

export default ChatInput;
