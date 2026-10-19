"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { MissionKind } from "@/missions/types";

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-white/70">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

const KIND: Record<MissionKind, { label: string; cls: string; icon: string }> = {
  guided: { label: "Guided mission", cls: "bg-sky/20 text-sky", icon: "🧭" },
  debug: { label: "Troubleshooting", cls: "bg-peach/20 text-peach", icon: "🐞" },
  assessment: { label: "Independent assessment", cls: "bg-sun/20 text-sun", icon: "📝" },
  capstone: { label: "Capstone project", cls: "bg-pink-400/20 text-pink-300", icon: "🏆" },
};

export function KindBadge({ kind }: { kind: MissionKind }) {
  const k = KIND[kind];
  return (
    <span className={`chip ${k.cls}`}>
      <span aria-hidden>{k.icon}</span> {k.label}
    </span>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="panel-strong max-h-[90dvh] w-full max-w-3xl overflow-y-auto p-6 outline-none"
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <button className="btn btn-ghost !px-3 !py-1" onClick={onClose} aria-label="Close dialog">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pass/fail marker that never relies on colour alone. */
export function PassMark({ passed }: { passed: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${passed ? "text-mint" : "text-danger"}`}>
      <span aria-hidden>{passed ? "✔" : "✖"}</span>
      {passed ? "Pass" : "Fail"}
    </span>
  );
}

export function download(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Two-step confirmation inside the page (browser confirm() dialogs are not available everywhere). */
export function ConfirmButton({
  className,
  label,
  confirmLabel,
  onConfirm,
}: {
  className: string;
  label: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
