import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, XMarkIcon } from './icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ICONS: Record<ToastType, React.FC<React.SVGProps<SVGSVGElement>>> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
};

const TOAST_COLORS: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-full max-w-xs space-y-3">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <div
              key={toast.id}
              className={`relative flex items-center gap-4 w-full p-4 rounded-lg shadow-lg text-white ${TOAST_COLORS[toast.type]} animate-fade-in-right`}
            >
              <Icon className="w-6 h-6 flex-shrink-0" />
              <p className="text-sm font-medium flex-grow">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="p-1 rounded-full hover:bg-black/20 flex-shrink-0">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  // Simplified API for easier use
  return {
    success: (message: string) => context.addToast(message, 'success'),
    error: (message: string) => context.addToast(message, 'error'),
    info: (message: string) => context.addToast(message, 'info'),
  };
};
