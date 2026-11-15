import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

const iconMap = {
  info: <Info className="w-4 h-4 text-ios-blue" />,
  success: <CheckCircle2 className="w-4 h-4 text-ios-green" />,
  warning: <AlertTriangle className="w-4 h-4 text-ios-orange" />,
  error: <AlertCircle className="w-4 h-4 text-ios-red" />,
};

export function ToastContainer() {
  const { toasts, dismissToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-full sm:max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex items-start gap-3 rounded-xl bg-ios-elevated border border-ios-sep p-3.5 shadow-xl"
        >
          <span className="mt-0.5 shrink-0" aria-hidden="true">
            {iconMap[toast.variant]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ios-label">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-ios-secondary mt-0.5 leading-relaxed">
                {toast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label={`Dismiss notification: ${toast.title}`}
            className="text-ios-secondary hover:text-ios-label p-1 rounded cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
