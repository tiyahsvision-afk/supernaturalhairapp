import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { PackageBadge, PriorityBadge, StatusBadge } from "../components/Badges";
import { CreateOrderModal } from "../components/CreateOrderModal";
import { OrderDetailModal } from "../components/OrderDetailModal";
import { AlertIcon, CheckIcon, ClockIcon, PlusIcon, SnowIcon, TruckIcon, UsersIcon } from "../components/Icons";
import type { Driver, Order } from "../types";

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone || "bg-teal-50 text-teal-600"}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

const ON_THE_WAY = ["assigned", "picked_up", "in_transit", "arrived"];
const FILTERS: { key: string; label: string; test?: (o: Order) => boolean }[] = [
  { key: "all", label: "All" },
  { key: "needs_driver", label: "Needs a driver", test: (o) => o.status === "pending" },
  { key: "on_the_way", label: "On the way", test: (o) => ON_THE_WAY.includes(o.status) },
  { key: "delivered", label: "Delivered", test: (o) => o.status === "delivered" },
  { key: "attention", label: "Needs attention", test: (o) => ["exception", "attempted"].includes(o.status) },
];

export function DispatcherDashboard() {
  const { data: ordersData, refetch } = useApi<{ orders: Order[] }>("/orders");
  const { data: driversData, refetch: refetchDrivers } = useApi<{ drivers: Driver[] }>("/drivers");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState("all");

  const orders = ordersData?.orders || [];
  const drivers = driversData?.drivers || [];

  const stats = useMemo(() => {
    const active = orders.filter((o) => ON_THE_WAY.includes(o.status));
    const cold = orders.filter((o) => o.temperature_required && o.status !== "delivered");
    return {
      active: active.length,
      pending: orders.filter((o) => o.status === "pending").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
      cold: cold.length,
    };
  }, [orders, drivers]);

  const filtered = useMemo(() => {
    const f = FILTERS.find((f) => f.key === filter);
    return !f || !f.test ? orders : orders.filter(f.test);
  }, [orders, filter]);

  function refreshAll() {
    refetch();
    refetchDrivers();
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <TruckIcon size={22} className="text-teal-600" />
            Deliveries
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tap an order to see details or assign a driver.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
        >
          <PlusIcon size={16} />
          New order
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="On the way" value={stats.active} icon={<TruckIcon size={16} />} tone="bg-teal-50 text-teal-600" />
        <StatCard
          label="Need a driver"
          value={stats.pending}
          icon={<ClockIcon size={16} />}
          tone={stats.pending ? "bg-orange-50 text-orange-600" : "bg-slate-100 text-slate-400"}
        />
        <StatCard label="Delivered today" value={stats.delivered} icon={<CheckIcon size={16} />} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Drivers ready" value={stats.availableDrivers} icon={<UsersIcon size={16} />} tone="bg-sky-50 text-sky-600" />
        <StatCard label="Refrigerated, on the way" value={stats.cold} icon={<SnowIcon size={16} />} tone="bg-cyan-50 text-cyan-600" />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const count = f.test ? orders.filter(f.test).length : orders.length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === f.key ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-teal-300"
              }`}
            >
              {f.label} <span className={filter === f.key ? "opacity-75" : "text-slate-400"}>({count})</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((o) => {
          const driver = drivers.find((d) => d.id === o.driver_id);
          return (
            <button
              key={o.id}
              onClick={() => setSelected(o)}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-300 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={o.status} />
                <PriorityBadge priority={o.priority} />
              </div>
              <p className="text-base font-bold text-slate-900">{o.patient_name}</p>
              <p className="text-sm text-slate-500">{o.delivery_address}</p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="font-mono text-slate-400">{o.order_number}</span>
                <PackageBadge type={o.package_type} />
              </div>
              <div className="text-sm">
                {driver ? (
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    <TruckIcon size={14} />
                    {driver.name}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 font-semibold text-orange-600">
                    <AlertIcon size={14} />
                    Needs a driver
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {!filtered.length && (
          <p className="col-span-full py-10 text-center text-sm text-slate-400">Nothing to show in this view.</p>
        )}
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
