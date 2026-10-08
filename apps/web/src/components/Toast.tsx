import React, { useEffect } from "react";
import { CheckCircle, Info, Warning, X, XCircle } from "@phosphor-icons/react";

export interface ToastMessage {
  id: string;
  type: "success" | "info" | "error" | "warning";
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const bgStyles =
    toast.type === "success"
      ? "bg-slate-900 border-emerald-500/40 text-white shadow-emerald-950/20"
      : toast.type === "error"
        ? "bg-rose-950 border-rose-600/50 text-rose-100 shadow-rose-950/20"
        : toast.type === "warning"
          ? "bg-amber-950 border-amber-500/50 text-amber-100 shadow-amber-950/20"
          : "bg-slate-900 border-sky-500/40 text-white shadow-sky-950/20";

  const Icon = toast.type === "success"
    ? CheckCircle
    : toast.type === "error"
      ? XCircle
      : toast.type === "warning"
        ? Warning
        : Info;
  const iconColor =
    toast.type === "success"
      ? "text-emerald-400"
      : toast.type === "error"
        ? "text-rose-400"
        : toast.type === "warning"
          ? "text-amber-400"
          : "text-sky-400";

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-[opacity,transform] duration-200 ease-out toast-enter ${bgStyles}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={18} weight="fill" className={`flex-shrink-0 ${iconColor}`} aria-hidden="true" />
        <p className="text-xs font-medium leading-relaxed truncate">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-xs text-slate-400 hover:text-white p-1 flex-shrink-0"
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <X size={14} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
