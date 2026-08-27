import { useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { DriverStatusBadge } from "../components/Badges";
import { Modal } from "../components/Modal";
import { MessageThread } from "../components/MessageThread";
import { api, ApiError } from "../lib/api";
import { ChatIcon, PlusIcon, UsersIcon } from "../components/Icons";
import type { Company, Driver } from "../types";

export function DriversPage() {
  const { data, refetch } = useApi<{ drivers: Driver[] }>("/drivers");
  const { data: companyData } = useApi<{ company: Company }>("/companies/mine");
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

  const input = "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none";

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <UsersIcon size={22} className="text-teal-600" />
            Drivers
          </h1>
          <p className="mt-1 text-sm text-slate-500">Your delivery team{companyData ? ` at ${companyData.company.name}` : ""}.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
        >
          <PlusIcon size={16} />
          Add a driver
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {drivers.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-700">
                  {d.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{d.name}</p>
                  <p className="truncate text-xs text-slate-400">{d.user_email}</p>
                </div>
              </div>
              <DriverStatusBadge status={d.status} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>Vehicle: <span className="font-medium text-slate-700">{d.vehicle || "—"}</span></p>
              <p>Phone: <span className="font-medium text-slate-700">{d.phone || "—"}</span></p>
              <p>Driver's license: <span className="font-medium text-slate-700">{d.license_number || "—"}</span></p>
              {d.michigan_board_of_pharmacy_license && (
                <p>Pharmacy license #: <span className="font-medium text-slate-700">{d.michigan_board_of_pharmacy_license}</span></p>
              )}
            </div>
            <button
              onClick={() => setMessaging(d)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
            >
              <ChatIcon size={14} />
              Message
            </button>
          </div>
        ))}
        {!drivers.length && <p className="text-sm text-slate-400">No drivers yet.</p>}
      </div>

      {showAdd && (
        <Modal title="Add a driver" eyebrow="Grow your team" onClose={() => setShowAdd(false)}>
          <form onSubmit={addDriver} className="space-y-3">
            <input required placeholder="Full name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input
              type="email"
              placeholder="Email (so they can sign in)"
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
            <button type="submit" disabled={busy} className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Adding…" : "Add driver"}
            </button>
          </form>
        </Modal>
      )}

      {messaging && (
        <Modal title={messaging.name} eyebrow="Message driver" onClose={() => setMessaging(null)}>
          <MessageThread driverId={messaging.id} driverName={messaging.name} />
        </Modal>
      )}
    </Layout>
  );
}
