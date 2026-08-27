import type { OrderStatus, PackageType } from "../types";
import { BoltIcon, IdIcon, SnowIcon } from "./Icons";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Needs a driver",
  assigned: "Assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  arrived: "Arrived",
  delivered: "Delivered",
  attempted: "Attempted",
  exception: "Needs attention",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-100 text-sky-700",
  picked_up: "bg-indigo-100 text-indigo-700",
  in_transit: "bg-blue-100 text-blue-700",
  arrived: "bg-purple-100 text-purple-700",
  delivered: "bg-emerald-100 text-emerald-700",
  attempted: "bg-amber-100 text-amber-700",
  exception: "bg-red-100 text-red-700",
  cancelled: "bg-zinc-200 text-zinc-600",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_LABEL: Record<string, string> = { routine: "Routine", urgent: "Urgent", stat: "Immediate" };
const PRIORITY_STYLES: Record<string, string> = {
  routine: "bg-slate-100 text-slate-600",
  urgent: "bg-orange-100 text-orange-700",
  stat: "bg-red-600 text-white",
};

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "stat") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
        <BoltIcon size={11} />
        Immediate
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {PRIORITY_LABEL[priority] || priority}
    </span>
  );
}

const PACKAGE_LABEL: Record<PackageType, string> = {
  standard: "Standard",
  refrigerated: "Refrigerated",
  controlled_substance: "Controlled substance",
  dot_specimen: "DOT specimen",
};

const PACKAGE_STYLES: Record<PackageType, string> = {
  standard: "bg-slate-100 text-slate-600",
  refrigerated: "bg-cyan-100 text-cyan-700",
  controlled_substance: "bg-fuchsia-100 text-fuchsia-700",
  dot_specimen: "bg-yellow-100 text-yellow-800",
};

export function PackageBadge({ type }: { type: PackageType }) {
  const icon = type === "refrigerated" ? <SnowIcon size={11} /> : type === "controlled_substance" ? <IdIcon size={11} /> : null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${PACKAGE_STYLES[type]}`}>
      {icon}
      {PACKAGE_LABEL[type]}
    </span>
  );
}

const DRIVER_STATUS_LABEL: Record<string, string> = { available: "Available", on_route: "On a delivery", offline: "Offline" };
const DRIVER_STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-100 text-emerald-700",
  on_route: "bg-blue-100 text-blue-700",
  offline: "bg-zinc-200 text-zinc-600",
};

export function DriverStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${DRIVER_STATUS_STYLES[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {DRIVER_STATUS_LABEL[status] || status}
    </span>
  );
}

export { STATUS_LABEL, PRIORITY_LABEL, PACKAGE_LABEL, DRIVER_STATUS_LABEL };
