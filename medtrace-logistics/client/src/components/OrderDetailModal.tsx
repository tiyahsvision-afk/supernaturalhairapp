import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../lib/api";
import { StatusBadge, PriorityBadge, PackageBadge } from "./Badges";
import type { ChainOfCustodyEvent, Driver, Order } from "../types";
import { useApi } from "../hooks/useApi";

const NEXT_STATUS: Record<string, string | null> = {
  pending: null,
  assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "arrived",
  arrived: "delivered",
  delivered: null,
  attempted: null,
  exception: null,
  cancelled: null,
};

export function OrderDetailModal({
  order,
  drivers,
  onClose,
  onChanged,
}: {
  order: Order;
  drivers: Driver[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, refetch } = useApi<{ events: ChainOfCustodyEvent[] }>(`/orders/${order.id}/events`);
  const [driverId, setDriverId] = useState(order.driver_id || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!driverId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/orders/${order.id}/assign`, { method: "POST", body: { driver_id: driverId } });
      await refetch();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign driver");
    } finally {
      setBusy(false);
    }
  }

  async function advance(status: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/orders/${order.id}/events`, { method: "POST", body: { event_type: status } });
      await refetch();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  const next = NEXT_STATUS[order.status];
  const availableDrivers = drivers.filter((d) => d.status !== "offline");

  return (
    <Modal title={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        <PriorityBadge priority={order.priority} />
        <PackageBadge type={order.package_type} />
        {order.temperature_required && (
          <span className="text-xs text-slate-500">
            {order.temperature_min}–{order.temperature_max}°C
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Patient</p>
          <p className="text-slate-900">{order.patient_name}</p>
          <p className="text-slate-500">{order.patient_address}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Pickup</p>
          <p className="text-slate-900">{order.pickup_pharmacy || "—"}</p>
          <p className="text-slate-500">{order.pickup_address}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Pharmacist in charge</p>
          <p className="text-slate-900">{order.pharmacist_in_charge || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Barcode</p>
          <p className="font-mono text-slate-900">{order.barcode}</p>
        </div>
      </div>

      {order.notes && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">{order.notes}</p>}

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Driver assignment</p>
        {order.status === "pending" || !order.driver_id ? (
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">Select a driver…</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.status})
                </option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={!driverId || busy}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            {drivers.find((d) => d.id === order.driver_id)?.name || "Unassigned"}
            {next && (
              <button
                onClick={() => advance(next)}
                disabled={busy}
                className="ml-3 rounded-lg border border-teal-600 px-3 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50"
              >
                Advance to {next.replace("_", " ")}
              </button>
            )}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">Chain of custody</p>
        <ol className="space-y-2">
          {(data?.events || []).map((evt) => (
            <li key={evt.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-600" />
              <div>
                <p className="text-slate-900">
                  <span className="font-medium capitalize">{evt.event_type.replace("_", " ")}</span>{" "}
                  <span className="text-slate-400">by {evt.driver_name}</span>
                </p>
                <p className="text-xs text-slate-500">{new Date(evt.timestamp).toLocaleString()}</p>
                {evt.notes && <p className="text-xs text-slate-500">{evt.notes}</p>}
                {evt.temperature_reading != null && (
                  <p className={`text-xs ${evt.temperature_excursion ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    Temp: {evt.temperature_reading}°C {evt.temperature_excursion && "— excursion!"}
                  </p>
                )}
              </div>
            </li>
          ))}
          {!data?.events?.length && <li className="text-sm text-slate-400">No events logged yet.</li>}
        </ol>
      </div>
    </Modal>
  );
}
