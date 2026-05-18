import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, Info, Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type Toast = {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'notification';
  duration?: number;
  action?: ToastAction;
  icon?: React.ReactNode;
};

type ToastContextType = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast Portal/Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-[23rem] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex w-full flex-col gap-3 rounded-2xl border p-4 shadow-[0_15px_45px_rgba(15,23,42,0.1)] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5",
              t.type === 'success' && "bg-emerald-50/95 border-emerald-500/20 text-emerald-900 dark:bg-emerald-950/95 dark:border-emerald-500/10 dark:text-emerald-50",
              t.type === 'error' && "bg-rose-50/95 border-rose-500/20 text-rose-900 dark:bg-rose-950/95 dark:border-rose-500/10 dark:text-rose-50",
              t.type === 'info' && "bg-sky-50/95 border-sky-500/20 text-sky-900 dark:bg-sky-950/95 dark:border-sky-500/10 dark:text-sky-50",
              t.type === 'notification' && "backdrop-blur-md bg-card/95 border-primary/20 text-foreground"
            )}
          >
            <div className="flex gap-3">
              {/* Type Icon */}
              <div className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                t.type === 'success' && "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
                t.type === 'error' && "bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
                t.type === 'info' && "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
                t.type === 'notification' && "bg-primary/10 text-primary"
              )}>
                {t.icon ? t.icon : (
                  t.type === 'success' ? <CheckCircle2 className="h-4.5 w-4.5" /> :
                  t.type === 'error' ? <AlertCircle className="h-4.5 w-4.5" /> :
                  t.type === 'info' ? <Info className="h-4.5 w-4.5" /> :
                  <Bell className="h-4.5 w-4.5" />
                )}
              </div>

              {/* Message Details */}
              <div className="flex-1 min-w-0">
                {t.title && (
                  <h5 className="font-semibold text-sm leading-tight truncate mb-1">
                    {t.title}
                  </h5>
                )}
                <p className="text-xs leading-normal opacity-90 break-words">
                  {t.message}
                </p>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => removeToast(t.id)}
                className="h-6 w-6 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Custom CTA Action */}
            {t.action && (
              <div className="flex justify-end pr-1">
                <button
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                  className={cn(
                    "rounded-xl h-8 px-4 text-xs font-semibold shadow-sm transition-all pointer-events-auto hover:shadow",
                    t.type === 'notification' 
                      ? "bg-primary text-primary-foreground hover:bg-primary/95" 
                      : "bg-black/10 hover:bg-black/15 text-inherit dark:bg-white/10 dark:hover:bg-white/15"
                  )}
                >
                  {t.action.label}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Global helper emitter is omitted; use the best-practice 'useToast' hook instead.
