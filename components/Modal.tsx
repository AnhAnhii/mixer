
import React from 'react';
import { XMarkIcon } from './icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex justify-center items-center p-4 sm:p-6 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[32px] shadow-soft-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-8 py-6 border-b border-border/30">
          <h2 className="text-xl font-bold font-heading text-foreground tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full transition-all active:scale-95"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
