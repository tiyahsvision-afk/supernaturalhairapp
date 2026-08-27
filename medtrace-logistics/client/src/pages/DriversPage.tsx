import { useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { DriverStatusBadge } from "../components/Badges";
import { Modal } from "../components/Modal";
import { MessageThread } from "../components/MessageThread";
import { api, ApiError } from "../lib/api";
import type { Driver } from "../types";

export function DriversPage() {
  const { data, refetch } = useApi<{ drivers: Driver[] }>("/drivers");
  const drivers = data?.drivers || [];
  const [showAdd, setShowAdd] = useState(false);
  const [messaging, setMessaging] = useState<Driver | null>(null);
  const [form, setForm] = useState({ name: "", user_email: "", vehicle: "", phone: "", license_number: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addDriver(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/drivers", { method: "POST", body: form });
      setShowAdd(false);
      setForm({ name: "", user_email: "", vehicle: "", phone: "", license_number: "" });
      refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add driver");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Drivers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          + Add driver
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{d.name}</p>
                <p className="text-xs text-slate-500">{d.user_email}</p>
              </div>
              <DriverStatusBadge status={d.status} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Vehicle: {d.vehicle || "—"}</p>
              <p>Phone: {d.phone || "—"}</p>
              <p>License: {d.license_number || "—"}</p>
              {d.michigan_board_of_pharmacy_license && <p>MI BOP: {d.michigan_board_of_pharmacy_license}</p>}
            </div>
            <button
              onClick={() => setMessaging(d)}
              className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Message
            </button>
          </div>
        ))}
        {!drivers.length && <p className="text-sm text-slate-400">No drivers yet.</p>}
      </div>

      {showAdd && (
        <Modal title="Add driver" onClose={() => setShowAdd(false)}>
          <form onSubmit={addDriver} className="space-y-3">
            <input required placeholder="Full name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input
              type="email"
              placeholder="Account email (used to link their driver login)"
              className={input}
              value={form.user_email}
              onChange={(e) => setForm({ ...form, user_email: e.target.value })}
            />
            <input placeholder="Vehicle" className={input} value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
            <input placeholder="Phone" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input
              placeholder="Driver's license #"
              className={input}
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Adding…" : "Add driver"}
            </button>
          </form>
        </Modal>
      )}

      {messaging && (
        <Modal title="Message driver" onClose={() => setMessaging(null)}>
          <MessageThread driverId={messaging.id} driverName={messaging.name} />
        </Modal>
      )}
    </Layout>
  );
}
