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
  show: (message: string, kind?: ToastKind) => void;
  /** convenience for the many "Coming soon" buttons */
  soon: (feature?: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

let nextId = 1;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId++;
      setToasts((arr) => [...arr, { id, message, kind }]);
      setTimeout(() => remove(id), 3200);
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
          <div
            key={t.id}
            className={"toast toast-" + t.kind}
            onClick={() => remove(t.id)}
          >
            {t.message}
          </div>
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
