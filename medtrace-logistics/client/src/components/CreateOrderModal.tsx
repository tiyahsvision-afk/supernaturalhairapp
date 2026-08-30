import { useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../lib/api";
import type { Order } from "../types";

const PRIORITY_HINT: Record<string, string> = {
  routine: "Deliver on the normal schedule — no rush.",
  urgent: "Deliver as soon as you can today.",
  stat: "Deliver right now — this can't wait.",
};
const PACKAGE_HINT: Record<string, string> = {
  standard: "No special handling needed.",
  refrigerated: "Must stay cold — the driver will log temperature readings.",
  controlled_substance: "Regulated medication — needs an in-person signature.",
  dot_specimen: "Lab specimen — follow DOT shipping rules.",
};

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

  const input = "w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-teal-500 focus:outline-none";
  const label = "mb-1.5 block text-sm font-semibold text-slate-700";
  const hint = "mt-1.5 text-xs text-slate-400";

  return (
    <Modal title="New order" eyebrow="Create a delivery" onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={label}>Patient name</label>
          <input required placeholder="Who is this for?" className={input} value={form.patient_name} onChange={(e) => update("patient_name", e.target.value)} />
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
          <label className={label}>How soon?</label>
          <select className={input} value={form.priority} onChange={(e) => update("priority", e.target.value)}>
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="stat">Immediate</option>
          </select>
          <p className={hint}>{PRIORITY_HINT[form.priority]}</p>
        </div>
        <div>
          <label className={label}>What kind of package?</label>
          <select className={input} value={form.package_type} onChange={(e) => update("package_type", e.target.value)}>
            <option value="standard">Standard</option>
            <option value="refrigerated">Refrigerated</option>
            <option value="controlled_substance">Controlled substance</option>
            <option value="dot_specimen">DOT specimen</option>
          </select>
          <p className={hint}>{PACKAGE_HINT[form.package_type]}</p>
        </div>
        <div className="col-span-2">
          <label className={label}>Pharmacist in charge</label>
          <input className={input} value={form.pharmacist_in_charge} onChange={(e) => update("pharmacist_in_charge", e.target.value)} />
        </div>
        <div className="col-span-2 flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3.5">
          <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-600"
              checked={form.temperature_required}
              onChange={(e) => update("temperature_required", e.target.checked)}
            />
            Needs to stay refrigerated
          </label>
          <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-600"
              checked={form.requires_dual_signature}
              onChange={(e) => update("requires_dual_signature", e.target.checked)}
            />
            Needs an in-person signature
          </label>
        </div>
        {form.temperature_required && (
          <>
            <div>
              <label className={label}>Lowest safe temp (°C)</label>
              <input type="number" className={input} value={form.temperature_min} onChange={(e) => update("temperature_min", e.target.value)} />
            </div>
            <div>
              <label className={label}>Highest safe temp (°C)</label>
              <input type="number" className={input} value={form.temperature_max} onChange={(e) => update("temperature_max", e.target.value)} />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className={label}>Notes for the driver (optional)</label>
          <textarea className={input} rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
        </div>
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? "Creating…" : "Create order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
