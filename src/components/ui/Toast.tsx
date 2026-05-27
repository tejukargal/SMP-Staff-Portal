import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium min-w-64 max-w-sm border',
              t.type === 'success'
                ? 'bg-white border-[#16A34A]/30 text-[#15803D]'
                : 'bg-white border-[#DC2626]/30 text-[#DC2626]',
            ].join(' ')}
            style={{
              animation: 'toast-in 0.22s ease-out',
              boxShadow: t.type === 'success'
                ? '0 4px 20px rgba(22,163,74,0.15), 0 1px 4px rgba(0,0,0,0.08)'
                : '0 4px 20px rgba(220,38,38,0.15), 0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            <div className={[
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
              t.type === 'success' ? 'bg-[#DCFCE7]' : 'bg-[#FEE2E2]',
            ].join(' ')}>
              {t.type === 'success'
                ? <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                : <XCircle className="w-4 h-4 text-[#DC2626]" />}
            </div>
            <span className="flex-1 text-[#111827]">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
