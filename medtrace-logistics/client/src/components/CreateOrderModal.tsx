import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../lib/api";
import type { Order } from "../types";

export function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    patient_name: "",
    patient_dob: "",
    patient_address: "",
    patient_phone: "",
    pickup_pharmacy: "",
    pickup_address: "",
    delivery_address: "",
    priority: "routine",
    package_type: "standard",
    temperature_required: false,
    temperature_min: "",
    temperature_max: "",
    requires_dual_signature: false,
    pharmacist_in_charge: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<{ order: Order }>("/orders", {
        method: "POST",
        body: {
          ...form,
          temperature_min: form.temperature_min ? Number(form.temperature_min) : null,
          temperature_max: form.temperature_max ? Number(form.temperature_max) : null,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create order");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <Modal title="New delivery order" onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={label}>Patient name</label>
          <input required className={input} value={form.patient_name} onChange={(e) => update("patient_name", e.target.value)} />
        </div>
        <div>
          <label className={label}>Date of birth</label>
          <input type="date" className={input} value={form.patient_dob} onChange={(e) => update("patient_dob", e.target.value)} />
        </div>
        <div>
          <label className={label}>Patient phone</label>
          <input className={input} value={form.patient_phone} onChange={(e) => update("patient_phone", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={label}>Delivery address</label>
          <input required className={input} value={form.delivery_address} onChange={(e) => update("delivery_address", e.target.value)} />
        </div>
        <div>
          <label className={label}>Pickup pharmacy</label>
          <input className={input} value={form.pickup_pharmacy} onChange={(e) => update("pickup_pharmacy", e.target.value)} />
        </div>
        <div>
          <label className={label}>Pickup address</label>
          <input className={input} value={form.pickup_address} onChange={(e) => update("pickup_address", e.target.value)} />
        </div>
        <div>
          <label className={label}>Priority</label>
          <select className={input} value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">STAT</option>
          </select>
        </div>
        <div>
          <label className={label}>Package type</label>
          <select className={input} value={form.package_type} onChange={(e) => update("package_type", e.target.value)}>
            <option value="standard">Standard</option>
            <option value="refrigerated">Cold-chain (refrigerated)</option>
            <option value="controlled_substance">Controlled substance</option>
            <option value="dot_specimen">DOT specimen</option>
          </select>
        </div>
        <div>
          <label className={label}>Pharmacist in charge</label>
          <input className={input} value={form.pharmacist_in_charge} onChange={(e) => update("pharmacist_in_charge", e.target.value)} />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.temperature_required} onChange={(e) => update("temperature_required", e.target.checked)} />
            Temp-controlled
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.requires_dual_signature} onChange={(e) => update("requires_dual_signature", e.target.checked)} />
            Dual signature
          </label>
        </div>
        {form.temperature_required && (
          <>
            <div>
              <label className={label}>Min temp (°C)</label>
              <input type="number" className={input} value={form.temperature_min} onChange={(e) => update("temperature_min", e.target.value)} />
            </div>
            <div>
              <label className={label}>Max temp (°C)</label>
              <input type="number" className={input} value={form.temperature_max} onChange={(e) => update("temperature_max", e.target.value)} />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className={label}>Notes</label>
          <textarea className={input} rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
