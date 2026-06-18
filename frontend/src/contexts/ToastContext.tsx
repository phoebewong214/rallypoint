/* ============================================================
   ToastContext — global notification system.
   Usage:
     const { show } = useToast();
     show("Saved!", "success");
     show("Network error", "error");
     show("Coming soon");  // defaults to info
   ============================================================ */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type ToastKind = "info" | "success" | "error" | "soon";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastState {
  /** Show a toast. `duration` in ms (default depends on kind). 0 = sticky. */
  show: (message: string, kind?: ToastKind, duration?: number) => void;
  /** convenience for the many "Coming soon" buttons */
  soon: (feature?: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

/* Per-kind default durations. Errors get 8s so the user has time to read
   them; everything else 3.2s. duration=0 means sticky (manual dismiss). */
const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  info: 3200,
  success: 3200,
  error: 8000,
  soon: 3200,
};

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info", duration?: number) => {
      const id = nextId++;
      setToasts((arr) => [...arr, { id, message, kind }]);
      const d = duration ?? DEFAULT_DURATIONS[kind];
      if (d > 0) setTimeout(() => remove(id), d);
    },
    [remove]
  );

  const soon = useCallback(
    (feature?: string) => {
      show(feature ? `${feature} coming soon` : "Coming soon", "soon");
    },
    [show]
  );

  const value = useMemo<ToastState>(() => ({ show, soon }), [show, soon]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"toast toast-" + t.kind}
            onClick={() => remove(t.id)}
            aria-label="Dismiss notification"
          >
            <span className="toast-msg">{t.message}</span>
            <span className="toast-x" aria-hidden>×</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
