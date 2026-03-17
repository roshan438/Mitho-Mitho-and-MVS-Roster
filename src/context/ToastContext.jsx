






import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import "./Toast.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
  }, []);

  const showToast = useCallback((message, type = "info", options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const toast = {
      id,
      message,
      type,
      title:
        options.title ||
        (type === "success"
          ? "Success"
          : type === "error"
          ? "Something went wrong"
          : type === "warning"
          ? "Attention"
          : "Notice"),
      duration: options.duration ?? (type === "error" ? 4500 : 3000),
    };

    setToasts((prev) => [...prev, toast]);

    timeoutsRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, toast.duration);

    return id;
  }, [removeToast]);

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
            type="button"
          >
            <div className="toast-icon">
              {toast.type === "success" && "✓"}
              {toast.type === "error" && "!"}
              {toast.type === "warning" && "!"}
              {toast.type === "info" && "i"}
            </div>

            <div className="toast-body">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>

            <div className="toast-close">×</div>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}