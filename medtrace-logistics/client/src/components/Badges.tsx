import type { OrderStatus, PackageType } from "../types";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-300",
  assigned: "bg-sky-100 text-sky-700 ring-sky-300",
  picked_up: "bg-indigo-100 text-indigo-700 ring-indigo-300",
  in_transit: "bg-blue-100 text-blue-700 ring-blue-300",
  arrived: "bg-purple-100 text-purple-700 ring-purple-300",
  delivered: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  attempted: "bg-amber-100 text-amber-700 ring-amber-300",
  exception: "bg-red-100 text-red-700 ring-red-300",
  cancelled: "bg-zinc-200 text-zinc-600 ring-zinc-300",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  routine: "bg-slate-100 text-slate-600 ring-slate-300",
  urgent: "bg-orange-100 text-orange-700 ring-orange-300",
  stat: "bg-red-100 text-red-700 ring-red-300 font-semibold",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}>
      {priority.toUpperCase()}
    </span>
  );
}

const PACKAGE_LABEL: Record<PackageType, string> = {
  standard: "Standard",
  refrigerated: "Cold-chain",
  controlled_substance: "Controlled substance",
  dot_specimen: "DOT specimen",
};

const PACKAGE_STYLES: Record<PackageType, string> = {
  standard: "bg-slate-100 text-slate-600 ring-slate-300",
  refrigerated: "bg-cyan-100 text-cyan-700 ring-cyan-300",
  controlled_substance: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-300",
  dot_specimen: "bg-yellow-100 text-yellow-800 ring-yellow-300",
};

export function PackageBadge({ type }: { type: PackageType }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${PACKAGE_STYLES[type]}`}>
      {PACKAGE_LABEL[type]}
    </span>
  );
}

const DRIVER_STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  on_route: "bg-blue-100 text-blue-700 ring-blue-300",
  offline: "bg-zinc-200 text-zinc-600 ring-zinc-300",
};

export function DriverStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${DRIVER_STATUS_STYLES[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
