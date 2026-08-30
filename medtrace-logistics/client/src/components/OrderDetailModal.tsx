import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../lib/api";
import { DRIVER_STATUS_LABEL, PackageBadge, PriorityBadge, STATUS_LABEL, StatusBadge } from "./Badges";
import { AlertIcon, SnowIcon, TruckIcon } from "./Icons";
import type { ChainOfCustodyEvent, Driver, Order } from "../types";
import { useApi } from "../hooks/useApi";
import { useLive } from "../context/LiveContext";

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
  const live = useLive();
  const { data, refetch } = useApi<{ events: ChainOfCustodyEvent[] }>(`/orders/${order.id}/events`, [
    live.versions.orders,
  ]);
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
    <Modal title={order.patient_name} eyebrow={`Order ${order.order_number}`} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={order.status} />
        <PriorityBadge priority={order.priority} />
        <PackageBadge type={order.package_type} />
        {order.temperature_required && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
            <SnowIcon size={11} />
            {order.temperature_min}–{order.temperature_max}°C
          </span>
        )}
      </div>

      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Tracking number</p>
      <p className="mb-4 inline-block rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-base font-bold text-slate-800">{order.barcode}</p>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Patient</p>
          <p className="font-semibold text-slate-900">{order.patient_name}</p>
          <p className="text-slate-500">{order.patient_address}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Pickup</p>
          <p className="font-semibold text-slate-900">{order.pickup_pharmacy || "—"}</p>
          <p className="text-slate-500">{order.pickup_address}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Pharmacist in charge</p>
          <p className="font-semibold text-slate-900">{order.pharmacist_in_charge || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Delivery address</p>
          <p className="font-semibold text-slate-900">{order.delivery_address}</p>
        </div>
      </div>

      {order.notes && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertIcon size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{order.notes}</span>
        </div>
      )}

      {(order.recipient_signature_url || order.photo_proof_url) && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="mb-2 text-sm font-bold text-slate-900">Proof of delivery</p>
          <div className="flex flex-wrap gap-4">
            {order.recipient_signature_url && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Recipient signature</p>
                <img src={order.recipient_signature_url} alt="Recipient signature" className="h-20 rounded-lg border border-slate-200 bg-white" />
              </div>
            )}
            {order.photo_proof_url && (
              <div>
                <p className="mb-1 text-xs text-slate-400">Delivery photo</p>
                <img src={order.photo_proof_url} alt="Delivery proof" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="mb-2 text-sm font-bold text-slate-900">Delivery driver</p>
        {order.status === "pending" || !order.driver_id ? (
          <div className="flex flex-wrap gap-2">
            <select
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">Choose a driver…</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {DRIVER_STATUS_LABEL[d.status] || d.status}
                </option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={!driverId || busy}
              className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Assign
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <TruckIcon size={15} />
              {drivers.find((d) => d.id === order.driver_id)?.name || "Unassigned"}
            </span>
            {next && (
              <button
                onClick={() => advance(next)}
                disabled={busy}
                className="rounded-full border-2 border-teal-600 px-4 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
              >
                Mark as {STATUS_LABEL[next as keyof typeof STATUS_LABEL]?.toLowerCase() || next.replace("_", " ")}
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <p className="text-sm font-bold text-slate-900">Delivery history</p>
        <p className="mb-3 text-xs text-slate-400">Every step, recorded for compliance (chain of custody).</p>
        <ol className="space-y-3">
          {(data?.events || []).map((evt) => (
            <li key={evt.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600 ring-4 ring-teal-100" />
              <div>
                <p className="text-slate-900">
                  <span className="font-semibold">{STATUS_LABEL[evt.event_type as keyof typeof STATUS_LABEL] || evt.event_type.replace("_", " ")}</span>{" "}
                  <span className="text-slate-400">by {evt.driver_name}</span>
                </p>
                <p className="text-xs text-slate-400">{new Date(evt.timestamp).toLocaleString()}</p>
                {evt.notes && <p className="text-xs text-slate-500">{evt.notes}</p>}
                {evt.temperature_reading != null && (
                  <p className={`text-xs font-medium ${evt.temperature_excursion ? "text-red-600" : "text-slate-500"}`}>
                    Temp: {evt.temperature_reading}°C {evt.temperature_excursion && "— outside the safe range!"}
                  </p>
                )}
              </div>
            </li>
          ))}
          {!data?.events?.length && <li className="text-sm text-slate-400">Nothing logged yet.</li>}
        </ol>
      </div>
    </Modal>
  );
}
