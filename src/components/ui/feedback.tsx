'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle, AlertTriangle, X } from 'lucide-react';

// App-wide replacement for window.alert / confirm / prompt.
//
//   const { toast, confirm } = useFeedback();
//   toast('success', 'Entry updated');
//   const res = await confirm({ title: 'Void entry?', danger: true, input: { label: 'Reason' } });
//   if (res.confirmed) { ... res.value ... }
//
// FeedbackProvider is mounted once in the root layout.

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // When set, the dialog shows a text input (prompt replacement)
  input?: { label: string; placeholder?: string; required?: boolean };
}

export type ConfirmResult = { confirmed: false } | { confirmed: true; value: string };

interface FeedbackContextValue {
  toast: (type: ToastType, message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<ConfirmResult>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { icon: typeof CheckCircle2; bar: string; iconColor: string }> = {
  success: { icon: CheckCircle2, bar: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  error: { icon: XCircle, bar: 'bg-red-500', iconColor: 'text-red-500' },
  info: { icon: Info, bar: 'bg-blue-500', iconColor: 'text-blue-500' },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
  const [inputValue, setInputValue] = useState('');
  const idRef = useRef(0);
  const resolverRef = useRef<((r: ConfirmResult) => void) | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => dismissToast(id), 4000);
  }, [dismissToast]);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<ConfirmResult>(resolve => {
      // Settle any dialog that was somehow still open
      resolverRef.current?.({ confirmed: false });
      resolverRef.current = resolve;
      setInputValue('');
      setDialog(opts);
    });
  }, []);

  const settle = (result: ConfirmResult) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    settle({ confirmed: true, value: inputValue.trim() });
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const s = TOAST_STYLES[t.type];
            const Icon = s.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="pointer-events-auto relative overflow-hidden bg-white rounded-xl shadow-lg border border-slate-200 flex items-start gap-3 p-3 pr-9"
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${s.iconColor}`} />
                <p className="text-sm text-slate-700 leading-snug">{t.message}</p>
                <button onClick={() => dismissToast(t.id)}
                  className="absolute top-2.5 right-2.5 text-slate-300 hover:text-slate-500">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {dialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={() => settle({ confirmed: false })}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={e => e.stopPropagation()}
              onSubmit={handleConfirm}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-start gap-4">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${dialog.danger ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <AlertTriangle className={`h-5 w-5 ${dialog.danger ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900">{dialog.title}</h3>
                  {dialog.message && <p className="mt-1 text-sm text-slate-500 whitespace-pre-line">{dialog.message}</p>}
                  {dialog.input && (
                    <label className="block mt-3 text-xs font-medium text-slate-600">
                      {dialog.input.label}
                      <input
                        autoFocus
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        placeholder={dialog.input.placeholder}
                        required={dialog.input.required}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </label>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => settle({ confirmed: false })}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200">
                  {dialog.cancelLabel || 'Cancel'}
                </button>
                <button type="submit"
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {dialog.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}
