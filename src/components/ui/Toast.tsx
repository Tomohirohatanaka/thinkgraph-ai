/**
 * teachAI Toast Notification System
 * ─────────────────────────────────────────────────────────────
 * Accessible, animated toast notifications for user feedback.
 * Supports success, error, warning, and info variants.
 */
"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { COLORS, RADIUS, SHADOW, FONT } from "@/lib/design/tokens";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "#F0FDF4", border: COLORS.success, icon: COLORS.success },
  error: { bg: "#FEF2F2", border: COLORS.error, icon: COLORS.error },
  warning: { bg: "#FFFBEB", border: COLORS.warning, icon: COLORS.warning },
  info: { bg: "#EFF6FF", border: COLORS.info, icon: COLORS.info },
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const colors = TOAST_COLORS[toast.type];

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const removeTimer = setTimeout(onRemove, duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.duration, onRemove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 18px",
        background: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.lg,
        fontFamily: FONT.family,
        animation: isExiting ? "fadeSlideOut 0.3s ease-in forwards" : "fadeSlideIn 0.3s ease-out",
        maxWidth: 400,
        width: "100%",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: colors.icon,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {TOAST_ICONS[toast.type]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.gray800 }}>
          {toast.title}
        </div>
        {toast.description && (
          <div style={{ fontSize: 13, color: COLORS.gray500, marginTop: 2, lineHeight: 1.5 }}>
            {toast.description}
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label="通知を閉じる"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: COLORS.gray400,
          fontSize: 16,
          padding: 4,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        aria-label="通知"
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <style>{`
          @keyframes fadeSlideOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100%); }
          }
        `}</style>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
