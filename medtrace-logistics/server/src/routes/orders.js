import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { requireCompanyMember, requireCompanyAdmin, scopedToCompany } from "../scope.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireCompanyMember);

function nextOrderNumber(data, companyId) {
  const company = data.companies.find((c) => c.id === companyId);
  const prefix = (company?.name || "ORD").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "ORD";
  const count = data.orders.filter((o) => o.company_id === companyId).length + 1;
  return `${prefix}-${1000 + count}`;
}

ordersRouter.get("/", (req, res) => {
  const data = db.read();
  let orders = data.orders.filter((o) => scopedToCompany(req, o));
  if (req.user.company_role === "driver" && !req.isPlatformAdmin) {
    const myDriver = data.drivers.find((d) => d.user_email === req.user.email);
    if (myDriver) orders = orders.filter((o) => o.driver_id === myDriver.id);
    else orders = [];
  }
  res.json({ orders });
});

ordersRouter.post("/", requireCompanyAdmin, (req, res) => {
  const body = req.body || {};
  if (!body.patient_name || !body.delivery_address) {
    return res.status(400).json({ error: "patient_name and delivery_address are required" });
  }
  const data = db.read();
  const companyId = req.isPlatformAdmin ? body.company_id : req.user.company_id;
  const order = {
    id: `ord_${randomUUID()}`,
    order_number: body.order_number || nextOrderNumber(data, companyId),
    patient_name: body.patient_name,
    patient_dob: body.patient_dob || null,
    patient_address: body.patient_address || "",
    patient_phone: body.patient_phone || "",
    pickup_pharmacy: body.pickup_pharmacy || "",
    pickup_address: body.pickup_address || "",
    delivery_address: body.delivery_address,
    status: "pending",
    priority: body.priority || "routine",
    package_type: body.package_type || "standard",
    temperature_required: !!body.temperature_required,
    temperature_min: body.temperature_min ?? null,
    temperature_max: body.temperature_max ?? null,
    requires_dual_signature: !!body.requires_dual_signature,
    michigan_board_of_pharmacy_license: body.michigan_board_of_pharmacy_license || "",
    pharmacist_in_charge: body.pharmacist_in_charge || "",
    dot_specimen_classification: body.dot_specimen_classification || null,
    driver_id: null,
    route_sequence: null,
    barcode: body.barcode || `${(body.order_number || "ORD").replace(/\s/g, "")}BC`,
    delivery_lat: body.delivery_lat ?? null,
    delivery_lng: body.delivery_lng ?? null,
    company_id: companyId,
    signature_url: null,
    recipient_signature_url: null,
    photo_proof_url: null,
    delivered_at: null,
    attempted_at: null,
    deadline: body.deadline || null,
    notes: body.notes || "",
    created_at: new Date().toISOString(),
  };
  data.orders.push(order);
  db.write(data);
  res.status(201).json({ order });
});

function loadOrderOr404(req, res, data) {
  const order = data.orders.find((o) => o.id === req.params.id);
  if (!order || !scopedToCompany(req, order)) {
    res.status(404).json({ error: "Order not found" });
    return null;
  }
  return order;
}

// Assign / reassign a driver to an order.
ordersRouter.post("/:id/assign", requireCompanyAdmin, (req, res) => {
  const { driver_id, route_sequence } = req.body || {};
  const data = db.read();
  const order = loadOrderOr404(req, res, data);
  if (!order) return;
  const driver = data.drivers.find((d) => d.id === driver_id && scopedToCompany(req, d));
  if (!driver) return res.status(404).json({ error: "Driver not found" });

  order.driver_id = driver.id;
  order.route_sequence = route_sequence ?? order.route_sequence ?? 1;
  order.status = "assigned";
  driver.status = "on_route";

  data.custodyEvents.push({
    id: `evt_${randomUUID()}`,
    order_id: order.id,
    order_number: order.order_number,
    driver_id: driver.id,
    driver_name: driver.name,
    event_type: "assigned",
    timestamp: new Date().toISOString(),
    gps_lat: driver.current_lat,
    gps_lng: driver.current_lng,
    barcode_scan: null,
    signature_url: null,
    temperature_reading: null,
    temperature_excursion: false,
    company_id: order.company_id,
    notes: `Assigned to ${driver.name}`,
  });

  db.write(data);
  res.json({ order });
});

const VALID_TRANSITIONS = [
  "picked_up",
  "in_transit",
  "arrived",
  "delivered",
  "attempted",
  "exception",
];

// Advance an order's status and append a chain-of-custody event, matching the
// ChainOfCustodyEvent entity (which shares its event_type enum with this list plus temp_reading).
ordersRouter.post("/:id/events", (req, res) => {
  const { event_type, notes, gps_lat, gps_lng, barcode_scan, signature_url, temperature_reading } =
    req.body || {};
  if (!VALID_TRANSITIONS.includes(event_type) && event_type !== "temp_reading") {
    return res.status(400).json({ error: `event_type must be one of ${VALID_TRANSITIONS.join(", ")}, temp_reading` });
  }
  const data = db.read();
  const order = loadOrderOr404(req, res, data);
  if (!order) return;
  const driver = data.drivers.find((d) => d.id === order.driver_id);
  if (!driver) return res.status(400).json({ error: "Order has no assigned driver" });
  const isSelf = driver.user_email === req.user.email;
  if (!isSelf && req.user.company_role !== "admin" && !req.isPlatformAdmin) {
    return res.status(403).json({ error: "Only the assigned driver or a dispatcher can log events" });
  }

  let temperature_excursion = false;
  if (event_type === "temp_reading" && typeof temperature_reading === "number") {
    if (order.temperature_min != null && temperature_reading < order.temperature_min) temperature_excursion = true;
    if (order.temperature_max != null && temperature_reading > order.temperature_max) temperature_excursion = true;
  }

  data.custodyEvents.push({
    id: `evt_${randomUUID()}`,
    order_id: order.id,
    order_number: order.order_number,
    driver_id: driver.id,
    driver_name: driver.name,
    event_type,
    timestamp: new Date().toISOString(),
    gps_lat: gps_lat ?? driver.current_lat,
    gps_lng: gps_lng ?? driver.current_lng,
    barcode_scan: barcode_scan || null,
    signature_url: signature_url || null,
    temperature_reading: temperature_reading ?? null,
    temperature_excursion,
    company_id: order.company_id,
    notes: notes || "",
  });

  if (event_type !== "temp_reading") {
    order.status = event_type;
    if (event_type === "delivered") {
      order.delivered_at = new Date().toISOString();
      order.recipient_signature_url = signature_url || order.recipient_signature_url;
      driver.status = "available";
    }
    if (event_type === "attempted") {
      order.attempted_at = new Date().toISOString();
    }
    if (["delivered", "attempted", "exception", "cancelled"].includes(event_type)) {
      const stillActive = data.orders.some(
        (o) => o.driver_id === driver.id && o.id !== order.id && !["delivered", "attempted", "exception", "cancelled"].includes(o.status)
      );
      if (!stillActive) driver.status = "available";
    }
  }

  db.write(data);
  res.json({ order, driver });
});

ordersRouter.get("/:id/events", (req, res) => {
  const data = db.read();
  const order = loadOrderOr404(req, res, data);
  if (!order) return;
  const events = data.custodyEvents
    .filter((e) => e.order_id === order.id)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json({ events });
});
