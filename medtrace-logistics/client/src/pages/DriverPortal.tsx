import { useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { StatusBadge, PriorityBadge, PackageBadge } from "../components/Badges";
import { api, ApiError } from "../lib/api";
import type { Order } from "../types";

const FLOW: Record<string, { next: string; label: string } | null> = {
  pending: null,
  assigned: { next: "picked_up", label: "Mark picked up" },
  picked_up: { next: "in_transit", label: "Start transit" },
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{order.order_number}</span>
        <StatusBadge status={order.status} />
        <PriorityBadge priority={order.priority} />
        <PackageBadge type={order.package_type} />
      </div>
      <p className="text-sm text-slate-700">{order.patient_name}</p>
      <p className="text-sm text-slate-500">{order.delivery_address}</p>
      {order.notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{order.notes}</p>}

      {order.temperature_required && order.status !== "delivered" && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            placeholder={`Temp reading (${order.temperature_min}-${order.temperature_max}°C)`}
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          />
          <button
            disabled={!temp || busy}
            onClick={() => {
              logEvent("temp_reading", { temperature_reading: Number(temp) });
              setTemp("");
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Log temp
          </button>
        </div>
      )}

      {step && (
        <div className="mt-3">
          {step.next === "delivered" && order.requires_dual_signature && (
            <input
              placeholder="Recipient signature (type full name)"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || (step.next === "delivered" && order.requires_dual_signature && !signature)}
              onClick={() =>
                logEvent(step.next, step.next === "delivered" && signature ? { signature_url: `signed:${signature}` } : {})
              }
              className="flex-1 rounded-lg bg-teal-600 py-2 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {step.label}
            </button>
            {step.next !== "delivered" && (
              <button
                disabled={busy}
                onClick={() => logEvent("exception", { notes: "Driver flagged an exception" })}
                className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Exception
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
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
      <h1 className="mb-6 text-xl font-semibold text-slate-900">My deliveries</h1>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((o) => (
          <OrderCard key={o.id} order={o} onChanged={refetch} />
        ))}
        {!active.length && <p className="text-sm text-slate-400">No active deliveries assigned right now.</p>}
      </div>
      {!!done.length && (
        <>
          <h2 className="mb-3 text-sm font-medium text-slate-500">Completed</h2>
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
