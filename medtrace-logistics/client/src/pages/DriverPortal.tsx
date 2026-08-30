import { useEffect, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useLive } from "../context/LiveContext";
import { useAuth } from "../context/AuthContext";
import { PackageBadge, PriorityBadge, StatusBadge } from "../components/Badges";
import { api, ApiError } from "../lib/api";
import { AlertIcon, ClipboardIcon } from "../components/Icons";
import { SignaturePad } from "../components/SignaturePad";
import { PhotoCapture } from "../components/PhotoCapture";
import type { Driver, Order } from "../types";

function ShareLocation() {
  const { user } = useAuth();
  const { data } = useApi<{ drivers: Driver[] }>("/drivers");
  const myDriver = data?.drivers.find((d) => d.user_email === user?.email);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  function start() {
    if (!myDriver) return;
    if (!("geolocation" in navigator)) {
      setError("This browser doesn't support location sharing.");
      return;
    }
    setError(null);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < 8000) return;
        lastSentRef.current = now;
        api(`/drivers/${myDriver.id}`, {
          method: "PATCH",
          body: { current_lat: pos.coords.latitude, current_lng: pos.coords.longitude },
        }).catch(() => {});
      },
      () => setError("Location permission denied."),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    watchIdRef.current = id;
    setSharing(true);
  }

  function stop() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setSharing(false);
  }

  if (!myDriver) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={sharing ? stop : start}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ${
          sharing ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${sharing ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
        {sharing ? "Sharing location" : "Share my location"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

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
  const [signature, setSignature] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

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
        <div className="flex flex-col gap-3">
          {step.next === "delivered" && order.requires_dual_signature && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Recipient signature (required)</p>
              <SignaturePad onChange={setSignature} />
            </div>
          )}
          {step.next === "delivered" && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">Proof of delivery photo (optional)</p>
              <PhotoCapture onChange={setPhoto} />
            </div>
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || (step.next === "delivered" && order.requires_dual_signature && !signature)}
              onClick={() =>
                logEvent(step.next, {
                  ...(signature ? { signature_url: signature } : {}),
                  ...(photo ? { photo_proof_url: photo } : {}),
                })
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
  const live = useLive();
  const { data, refetch } = useApi<{ orders: Order[] }>("/orders", [live.versions.orders]);
  const orders = data?.orders || [];
  const active = orders.filter((o) => !["delivered", "attempted", "cancelled", "exception"].includes(o.status));
  const done = orders.filter((o) => ["delivered", "attempted", "cancelled", "exception"].includes(o.status));

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <ClipboardIcon size={22} className="text-teal-600" />
            My deliveries
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {active.length} active {active.length === 1 ? "delivery" : "deliveries"} — tap the button to move one forward.
          </p>
        </div>
        <ShareLocation />
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
