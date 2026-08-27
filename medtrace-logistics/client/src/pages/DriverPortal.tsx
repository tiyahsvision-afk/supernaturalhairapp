import { useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { PackageBadge, PriorityBadge, StatusBadge } from "../components/Badges";
import { api, ApiError } from "../lib/api";
import { AlertIcon, ClipboardIcon } from "../components/Icons";
import type { Order } from "../types";

const FLOW: Record<string, { next: string; label: string } | null> = {
  pending: null,
  assigned: { next: "picked_up", label: "Mark picked up" },
  picked_up: { next: "in_transit", label: "Start driving" },
  in_transit: { next: "arrived", label: "Mark arrived" },
  arrived: { next: "delivered", label: "Complete delivery" },
  delivered: null,
  attempted: null,
  exception: null,
  cancelled: null,
};

function OrderCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState("");
  const [signature, setSignature] = useState("");

  async function logEvent(event_type: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      await api(`/orders/${order.id}/events`, { method: "POST", body: { event_type, ...extra } });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  const step = FLOW[order.status];

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={order.status} />
        <PriorityBadge priority={order.priority} />
      </div>
      <p className="text-base font-bold text-slate-900">{order.patient_name}</p>
      <p className="text-sm text-slate-500">{order.delivery_address}</p>
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <span className="font-mono text-slate-400">{order.order_number}</span>
        <PackageBadge type={order.package_type} />
      </div>
      {order.notes && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertIcon size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{order.notes}</span>
        </div>
      )}

      {order.temperature_required && order.status !== "delivered" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={`Temp (${order.temperature_min}–${order.temperature_max}°C)`}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <button
            disabled={!temp || busy}
            onClick={() => {
              logEvent("temp_reading", { temperature_reading: Number(temp) });
              setTemp("");
            }}
            className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            Log temp
          </button>
        </div>
      )}

      {step && (
        <div className="flex flex-col gap-2">
          {step.next === "delivered" && order.requires_dual_signature && (
            <input
              placeholder="Type the recipient's full name to sign"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || (step.next === "delivered" && order.requires_dual_signature && !signature)}
              onClick={() =>
                logEvent(step.next, step.next === "delivered" && signature ? { signature_url: `signed:${signature}` } : {})
              }
              className="flex-1 rounded-full bg-teal-600 py-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {step.label}
            </button>
            {step.next !== "delivered" && (
              <button
                disabled={busy}
                onClick={() => logEvent("exception", { notes: "Driver reported a problem completing this delivery" })}
                className="rounded-full border-2 border-red-300 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Report a problem
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DriverPortal() {
  const { data, refetch } = useApi<{ orders: Order[] }>("/orders");
  const orders = data?.orders || [];
  const active = orders.filter((o) => !["delivered", "attempted", "cancelled", "exception"].includes(o.status));
  const done = orders.filter((o) => ["delivered", "attempted", "cancelled", "exception"].includes(o.status));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <ClipboardIcon size={22} className="text-teal-600" />
          My deliveries
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {active.length} active {active.length === 1 ? "delivery" : "deliveries"} — tap the button to move one forward.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((o) => (
          <OrderCard key={o.id} order={o} onChanged={refetch} />
        ))}
        {!active.length && <p className="text-sm text-slate-400">You're all caught up — nothing active right now.</p>}
      </div>
      {!!done.length && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-bold text-slate-500">Completed</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {done.map((o) => (
              <OrderCard key={o.id} order={o} onChanged={refetch} />
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
