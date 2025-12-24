
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { XMarkIcon, MoonIcon, SunIcon, SparklesIcon, ViewColumnsIcon, PlusIcon } from './icons';

export interface Command {
  id: string;
  name: string;
  action: () => void;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  category: string;
  keywords?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery) ||
      cmd.keywords?.toLowerCase().includes(lowerQuery)
    );
  }, [query, commands]);

  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    }, {});
  }, [filteredCommands]);

  const flatCommands = useMemo(() => {
      return Object.values(groupedCommands).flat();
  }, [groupedCommands]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % flatCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + flatCommands.length) % flatCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const command = flatCommands[activeIndex];
        if (command) {
          command.action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, flatCommands, onClose]);

  useEffect(() => {
      // Scroll active item into view
      listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({
          block: 'nearest',
      });
  }, [activeIndex]);

  if (!isOpen) return null;

  let currentIndex = -1;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-start pt-20" onClick={onClose}>
      <div
        className="bg-card w-full max-w-xl rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Tìm kiếm lệnh hoặc điều hướng..."
            className="w-full bg-transparent text-card-foreground p-4 text-lg outline-none border-b border-border"
          />
        </div>
        <ul ref={listRef} className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, cmds]) => (
                <li key={category}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                    <ul>
                        {(cmds as Command[]).map(cmd => {
                             currentIndex++;
                             const isSelected = currentIndex === activeIndex;
                            return (
                                <li
                                    key={cmd.id}
                                    data-index={currentIndex}
                                    onClick={() => {
                                        cmd.action();
                                        onClose();
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer text-sm ${isSelected ? 'bg-primary text-white' : 'text-card-foreground hover:bg-muted'}`}
                                >
                                    <cmd.icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-muted-foreground'}`} />
                                    {cmd.name}
                                </li>
                            );
                        })}
                    </ul>
                </li>
            ))}
            {flatCommands.length === 0 && (
                <li className="p-4 text-center text-sm text-muted-foreground">Không tìm thấy lệnh nào.</li>
            )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
