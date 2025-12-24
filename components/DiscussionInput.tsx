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
                <div className="absolute bottom-full left-0 w-full mb-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                    {filteredUsers.map(user => (
                        <div key={user.id} onClick={() => handleMentionSelect(user.name)} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer">
                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{user.avatar}</div>
                            <span className="text-sm">{user.name}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0 mt-1">{currentUser.avatar}</div>
                <div className="flex-grow flex items-center border border-input rounded-lg focus-within:ring-2 focus-within:ring-primary">
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
                        placeholder="Thêm bình luận hoặc @mention để giao việc..."
                        className="w-full bg-transparent p-2 text-sm outline-none resize-none"
                        rows={2}
                    />
                    <button onClick={handleSubmit} className="p-3 text-primary disabled:text-muted-foreground" disabled={!text.trim()}>
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    )
};

export default DiscussionInput;
