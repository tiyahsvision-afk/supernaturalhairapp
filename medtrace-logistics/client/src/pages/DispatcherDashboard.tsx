import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { StatusBadge, PriorityBadge, PackageBadge } from "../components/Badges";
import { CreateOrderModal } from "../components/CreateOrderModal";
import { OrderDetailModal } from "../components/OrderDetailModal";
import type { Driver, Order } from "../types";

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export function DispatcherDashboard() {
  const { data: ordersData, loading, refetch } = useApi<{ orders: Order[] }>("/orders");
  const { data: driversData, refetch: refetchDrivers } = useApi<{ drivers: Driver[] }>("/drivers");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const orders = ordersData?.orders || [];
  const drivers = driversData?.drivers || [];

  const stats = useMemo(() => {
    const active = orders.filter((o) => !["delivered", "attempted", "cancelled"].includes(o.status));
    const excursions = orders.filter((o) => o.temperature_required && o.status !== "delivered" && o.temperature_min != null);
    return {
      active: active.length,
      pending: orders.filter((o) => o.status === "pending").length,
      deliveredToday: orders.filter((o) => o.status === "delivered").length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
      tempSensitive: excursions.length,
    };
  }, [orders, drivers]);

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  function refreshAll() {
    refetch();
    refetchDrivers();
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Dispatch board</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          + New order
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Active orders" value={stats.active} />
        <StatCard label="Pending assignment" value={stats.pending} tone={stats.pending ? "text-amber-600" : undefined} />
        <StatCard label="Delivered" value={stats.deliveredToday} tone="text-emerald-600" />
        <StatCard label="Available drivers" value={stats.availableDrivers} />
        <StatCard label="Temp-sensitive in transit" value={stats.tempSensitive} tone="text-cyan-600" />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto">
        {["all", "pending", "assigned", "picked_up", "in_transit", "arrived", "delivered", "exception"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Driver</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                onClick={() => setSelected(o)}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
              >
                <td className="px-4 py-3 font-medium text-slate-900">{o.order_number}</td>
                <td className="px-4 py-3 text-slate-600">{o.patient_name}</td>
                <td className="px-4 py-3">
                  <PackageBadge type={o.package_type} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={o.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {drivers.find((d) => d.id === o.driver_id)?.name || "—"}
                </td>
              </tr>
            ))}
            {!loading && !filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No orders in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreated={refreshAll} />}
      {selected && (
        <OrderDetailModal
          order={orders.find((o) => o.id === selected.id) || selected}
          drivers={drivers}
          onClose={() => setSelected(null)}
          onChanged={refreshAll}
        />
      )}
    </Layout>
  );
}
