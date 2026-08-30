import type { ReactNode } from "react";
import { CloseIcon } from "./Icons";

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className={`max-h-[85vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-teal-600">{eyebrow}</p>}
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            <CloseIcon size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
