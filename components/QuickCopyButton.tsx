
import React, { useState } from 'react';
import { ClipboardDocumentIcon, CheckCircleIcon } from './icons';

interface QuickCopyButtonProps {
  text: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact' | 'icon-only';
  onCopied?: () => void;
}

const QuickCopyButton: React.FC<QuickCopyButtonProps> = ({ 
  text, 
  label, 
  icon,
  className = '',
  variant = 'default',
  onCopied 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const baseStyles = "inline-flex items-center gap-1.5 transition-all duration-200 font-medium";
  
  const variantStyles = {
    default: `${baseStyles} px-3 py-2 rounded-lg text-sm ${copied ? 'bg-green-100 text-green-700 border-green-300' : 'bg-muted hover:bg-primary/10 text-card-foreground hover:text-primary border-border'} border`,
    compact: `${baseStyles} px-2 py-1 rounded-md text-xs ${copied ? 'bg-green-100 text-green-600' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-card-foreground'}`,
    'icon-only': `${baseStyles} p-2 rounded-full ${copied ? 'bg-green-100 text-green-600' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-card-foreground'}`,
  };

  return (
    <button
      onClick={handleCopy}
      className={`${variantStyles[variant]} ${className}`}
      title={copied ? 'Đã copy!' : `Copy: ${text}`}
    >
      {copied ? (
        <>
          <CheckCircleIcon className="w-4 h-4 text-green-600" />
          {variant !== 'icon-only' && <span>Đã copy!</span>}
        </>
      ) : (
        <>
          {icon || <ClipboardDocumentIcon className="w-4 h-4" />}
          {variant !== 'icon-only' && label && <span>{label}</span>}
        </>
      )}
    </button>
  );
};

export default QuickCopyButton;
