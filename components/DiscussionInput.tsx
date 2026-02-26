import React, { useState, useRef, useEffect } from 'react';
import type { User } from '../types';
import { PaperAirplaneIcon } from './icons';

interface DiscussionInputProps {
    currentUser: User;
    users: User[];
    onAddDiscussion: (text: string) => void;
}

const DiscussionInput: React.FC<DiscussionInputProps> = ({ currentUser, users, onAddDiscussion }) => {
    const [text, setText] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()) && u.id !== currentUser.id);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setText(newText);

        const atIndex = newText.lastIndexOf('@');
        // Check if @ is not followed by a space and the rest is word characters
        if (atIndex > -1 && newText.substring(atIndex + 1).match(/^\S*$/)) {
            const query = newText.substring(atIndex + 1);
            setMentionQuery(query);
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const handleMentionSelect = (userName: string) => {
        const atIndex = text.lastIndexOf('@');
        const newText = text.substring(0, atIndex) + `@${userName} `;
        setText(newText);
        setShowMentions(false);
        inputRef.current?.focus();
    };

    const handleSubmit = () => {
        if (text.trim()) {
            onAddDiscussion(text.trim());
            setText('');
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMentions) {
                // A small delay to allow click on mention list
                setTimeout(() => setShowMentions(false), 100);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showMentions]);

    return (
        <div className="relative">
            {showMentions && filteredUsers.length > 0 && (
                <div className="absolute bottom-full left-0 w-full mb-3 bg-white/90 backdrop-blur-md border border-border/50 rounded-2xl shadow-soft-lg max-h-48 overflow-y-auto z-[70] p-1 animate-in slide-in-from-bottom-2 duration-300 custom-scrollbar">
                    {filteredUsers.map(user => (
                        <div key={user.id} onClick={() => handleMentionSelect(user.name)} className="flex items-center gap-3 p-3 hover:bg-primary/5 rounded-xl cursor-pointer transition-all group">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-[12px] font-black border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all">{user.avatar}</div>
                            <span className="text-[13px] font-bold text-foreground group-hover:text-primary">{user.name}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-start gap-4 p-4 bg-white border border-border/50 rounded-[24px] shadow-soft-sm focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/30 transition-all">
                <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-[15px] flex-shrink-0 shadow-soft-sm border-2 border-white">{currentUser.avatar}</div>
                <div className="flex-grow flex items-center">
                    <textarea
                        ref={inputRef}
                        value={text}
                        onChange={handleTextChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        placeholder="Nhập ghi chú hoặc nhắc tên đồng nghiệp..."
                        className="w-full bg-transparent p-1 text-[14px] font-bold text-foreground outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
                        rows={2}
                    />
                    <button
                        onClick={handleSubmit}
                        className="p-3 text-primary disabled:text-muted-foreground/20 hover:scale-110 active:scale-90 transition-all"
                        disabled={!text.trim()}
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
};

export default DiscussionInput;
