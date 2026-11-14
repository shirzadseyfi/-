import React from 'react';
import {AlertCircle, CheckCircle2, Info, X} from 'lucide-react';
import type {ToastPosition} from '../types';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  variant?: 'success' | 'info' | 'error';
  category?: 'critical' | 'transaction' | 'draft';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: ToastPosition;
}

const POSITION_CLASSES: Record<ToastPosition, string> = {
  'bottom-left': 'bottom-5 left-5',
  'bottom-right': 'bottom-5 right-5',
  'top-center': 'top-5 left-1/2 -translate-x-1/2',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  position = 'bottom-left',
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={`fixed ${POSITION_CLASSES[position]} z-[60] max-w-sm w-[calc(100%-2.5rem)] space-y-2.5 pointer-events-none print:hidden`}
    >
      {toasts.map((toast) => {
        const variant = toast.variant || 'success';
        const containerClass =
          variant === 'error'
            ? 'border-red-300 dark:border-red-800/80'
            : variant === 'info'
              ? 'border-teal-300 dark:border-teal-800/80'
              : 'border-emerald-300 dark:border-emerald-800/80';

        const iconBoxClass =
          variant === 'error'
            ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400'
            : variant === 'info'
              ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400';

        const Icon =
          variant === 'error' ? AlertCircle : variant === 'info' ? Info : CheckCircle2;

        return (
          <div
            key={toast.id}
            role={variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto bg-white dark:bg-slate-900 border ${containerClass} rounded-xl p-3.5 shadow-lg flex items-start gap-3 transition-all duration-200`}
          >
            <div className={`p-1.5 rounded-lg shrink-0 ${iconBoxClass}`}>
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {toast.title}
                </p>
                {toast.timestamp && (
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                    {toast.timestamp}
                  </span>
                )}
              </div>
              {toast.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="بستن اعلان"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
