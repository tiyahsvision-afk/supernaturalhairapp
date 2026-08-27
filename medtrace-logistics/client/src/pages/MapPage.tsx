import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layout } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useLive } from "../context/LiveContext";
import type { Driver, Order } from "../types";

const DRIVER_COLOR: Record<string, string> = {
  available: "#059669",
  on_route: "#2563eb",
  offline: "#94a3b8",
};
const ORDER_COLOR: Record<string, string> = {
  pending: "#64748b",
  assigned: "#0284c7",
  picked_up: "#4f46e5",
  in_transit: "#2563eb",
  arrived: "#7c3aed",
  delivered: "#059669",
  attempted: "#d97706",
  exception: "#dc2626",
  cancelled: "#94a3b8",
};

function dotIcon(color: string, glyph: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:30px;height:30px;border-radius:9999px;background:${color};
      display:flex;align-items:center;justify-content:center;color:#fff;
      font-size:14px;font-weight:700;border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
    ">${glyph}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

const LANSING: [number, number] = [42.7325, -84.5555];

export function MapPage() {
  const live = useLive();
  const { data: driversData } = useApi<{ drivers: Driver[] }>("/drivers", [live.versions.drivers]);
  const { data: ordersData } = useApi<{ orders: Order[] }>("/orders", [live.versions.orders]);
  const drivers = driversData?.drivers || [];
  const orders = ordersData?.orders || [];

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { center: LANSING, zoom: 11, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const points: [number, number][] = [];

    for (const d of drivers) {
      if (d.current_lat == null || d.current_lng == null) continue;
      const pos: [number, number] = [d.current_lat, d.current_lng];
      points.push(pos);
      L.marker(pos, { icon: dotIcon(DRIVER_COLOR[d.status] || "#0f766e", "🚚") })
        .addTo(layer)
        .bindPopup(
          `<div style="font-family:inherit"><strong>${d.name}</strong><br/>${d.status.replace("_", " ")}<br/><span style="color:#64748b">${d.vehicle || ""}</span></div>`
        );
    }

    for (const o of orders) {
      if (o.delivery_lat == null || o.delivery_lng == null) continue;
      if (o.status === "delivered" || o.status === "cancelled") continue;
      const pos: [number, number] = [o.delivery_lat, o.delivery_lng];
      points.push(pos);
      L.marker(pos, { icon: dotIcon(ORDER_COLOR[o.status] || "#0f766e", "📦") })
        .addTo(layer)
        .bindPopup(
          `<div style="font-family:inherit"><strong>${o.patient_name}</strong><br/>${o.order_number} — ${o.status.replace("_", " ")}<br/><span style="color:#64748b">${o.delivery_address}</span></div>`
        );
    }

    if (points.length) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView(LANSING, 11);
    }
  }, [drivers, orders]);

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-900">🗺️ Map</h1>
        <p className="mt-1 text-sm text-slate-500">Drivers and active deliveries, live on the map.</p>
      </div>
      <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DRIVER_COLOR.available }} />Driver available</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: DRIVER_COLOR.on_route }} />Driver on a delivery</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ORDER_COLOR.exception }} />Delivery needs attention</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#64748b" }} />Delivery pending / on the way</span>
      </div>
      <div ref={mapElRef} className="mt-4 h-[65vh] w-full overflow-hidden rounded-2xl border border-slate-200" />
    </Layout>
  );
}
