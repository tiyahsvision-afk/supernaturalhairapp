import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "..", "data", "db.json");

const COLLECTIONS = [
  "companies",
  "users",
  "drivers",
  "orders",
  "custodyEvents",
  "messages",
];

function seed() {
  const now = new Date().toISOString();
  const companyId = "co_greatlakes";
  const adminUserEmail = "admin@medtrace.app";
  const dispatcherEmail = "dispatch@greatlakesrx.com";
  const driver1Email = "j.rivera@greatlakesrx.com";
  const driver2Email = "s.okafor@greatlakesrx.com";

  const passwordHash = bcrypt.hashSync("password123", 8);

  const data = {
    companies: [
      {
        id: companyId,
        name: "Great Lakes Pharmacy Courier",
        address: "4400 Grand River Ave",
        city: "Lansing",
        state: "MI",
        license_number: "MI-BOP-88231",
        industry: "Pharmaceutical Delivery",
        contact_phone: "517-555-0142",
        join_code: "GLRX-2026",
        status: "active",
        created_at: now,
      },
    ],
    users: [
      {
        id: "user_admin",
        email: adminUserEmail,
        name: "Platform Admin",
        password_hash: passwordHash,
        role: "admin",
        company_id: null,
        company_role: null,
        created_at: now,
      },
      {
        id: "user_dispatch",
        email: dispatcherEmail,
        name: "Dana Whitfield",
        password_hash: passwordHash,
        role: "user",
        company_id: companyId,
        company_role: "admin",
        created_at: now,
      },
      {
        id: "user_driver1",
        email: driver1Email,
        name: "Javier Rivera",
        password_hash: passwordHash,
        role: "user",
        company_id: companyId,
        company_role: "driver",
        created_at: now,
      },
      {
        id: "user_driver2",
        email: driver2Email,
        name: "Simi Okafor",
        password_hash: passwordHash,
        role: "user",
        company_id: companyId,
        company_role: "driver",
        created_at: now,
      },
    ],
    drivers: [
      {
        id: "drv_1",
        name: "Javier Rivera",
        user_email: driver1Email,
        vehicle: "Ford Transit - Refrigerated Van 3",
        phone: "517-555-0110",
        license_number: "MI-DL-5521098",
        status: "on_route",
        current_lat: 42.7325,
        current_lng: -84.5555,
        michigan_board_of_pharmacy_license: "MI-BOP-DRV-4471",
        company_id: companyId,
        created_at: now,
      },
      {
        id: "drv_2",
        name: "Simi Okafor",
        user_email: driver2Email,
        vehicle: "Chevy Bolt EUV 1",
        phone: "517-555-0187",
        license_number: "MI-DL-6690231",
        status: "available",
        current_lat: 42.7409,
        current_lng: -84.5495,
        michigan_board_of_pharmacy_license: "MI-BOP-DRV-4488",
        company_id: companyId,
        created_at: now,
      },
    ],
    orders: [
      {
        id: "ord_1001",
        order_number: "GLRX-1001",
        patient_name: "Harold Beckett",
        patient_dob: "1958-03-11",
        patient_address: "812 Maplewood Dr, Lansing, MI",
        patient_phone: "517-555-2231",
        pickup_pharmacy: "Great Lakes Specialty Pharmacy",
        pickup_address: "4400 Grand River Ave, Lansing, MI",
        delivery_address: "812 Maplewood Dr, Lansing, MI",
        status: "in_transit",
        priority: "stat",
        package_type: "controlled_substance",
        temperature_required: false,
        temperature_min: null,
        temperature_max: null,
        requires_dual_signature: true,
        michigan_board_of_pharmacy_license: "MI-BOP-88231",
        pharmacist_in_charge: "Dr. Alicia Munroe, PharmD",
        dot_specimen_classification: null,
        driver_id: "drv_1",
        route_sequence: 1,
        barcode: "GLRX1001BC",
        delivery_lat: 42.751,
        delivery_lng: -84.5312,
        company_id: companyId,
        signature_url: null,
        recipient_signature_url: null,
        photo_proof_url: null,
        delivered_at: null,
        attempted_at: null,
        deadline: new Date(Date.now() + 1000 * 60 * 90).toISOString(),
        notes: "Schedule II — requires dual signature on delivery.",
        created_at: now,
      },
      {
        id: "ord_1002",
        order_number: "GLRX-1002",
        patient_name: "Renee Castillo",
        patient_dob: "1972-09-02",
        patient_address: "215 Sparrow Ln, East Lansing, MI",
        patient_phone: "517-555-9910",
        pickup_pharmacy: "Great Lakes Specialty Pharmacy",
        pickup_address: "4400 Grand River Ave, Lansing, MI",
        delivery_address: "215 Sparrow Ln, East Lansing, MI",
        status: "pending",
        priority: "urgent",
        package_type: "refrigerated",
        temperature_required: true,
        temperature_min: 2,
        temperature_max: 8,
        requires_dual_signature: false,
        michigan_board_of_pharmacy_license: "MI-BOP-88231",
        pharmacist_in_charge: "Dr. Alicia Munroe, PharmD",
        dot_specimen_classification: null,
        driver_id: null,
        route_sequence: null,
        barcode: "GLRX1002BC",
        delivery_lat: 42.7369,
        delivery_lng: -84.4839,
        company_id: companyId,
        signature_url: null,
        recipient_signature_url: null,
        photo_proof_url: null,
        delivered_at: null,
        attempted_at: null,
        deadline: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
        notes: "Cold-chain biologic — keep 2-8C, log temp on pickup and delivery.",
        created_at: now,
      },
      {
        id: "ord_1003",
        order_number: "GLRX-1003",
        patient_name: "Wanda Price",
        patient_dob: "1965-12-20",
        patient_address: "77 Birchwood Ct, Okemos, MI",
        patient_phone: "517-555-4420",
        pickup_pharmacy: "Great Lakes Specialty Pharmacy",
        pickup_address: "4400 Grand River Ave, Lansing, MI",
        delivery_address: "77 Birchwood Ct, Okemos, MI",
        status: "delivered",
        priority: "routine",
        package_type: "standard",
        temperature_required: false,
        temperature_min: null,
        temperature_max: null,
        requires_dual_signature: false,
        michigan_board_of_pharmacy_license: "MI-BOP-88231",
        pharmacist_in_charge: "Dr. Alicia Munroe, PharmD",
        dot_specimen_classification: null,
        driver_id: "drv_2",
        route_sequence: 1,
        barcode: "GLRX1003BC",
        delivery_lat: 42.7175,
        delivery_lng: -84.4297,
        company_id: companyId,
        signature_url: null,
        recipient_signature_url: "signed:Wanda Price",
        photo_proof_url: null,
        delivered_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        attempted_at: null,
        deadline: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        notes: "",
        created_at: now,
      },
    ],
    custodyEvents: [
      {
        id: "evt_1",
        order_id: "ord_1001",
        order_number: "GLRX-1001",
        driver_id: "drv_1",
        driver_name: "Javier Rivera",
        event_type: "assigned",
        timestamp: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        gps_lat: 42.7325,
        gps_lng: -84.5555,
        barcode_scan: null,
        signature_url: null,
        temperature_reading: null,
        temperature_excursion: false,
        company_id: companyId,
        notes: "Assigned to Javier Rivera",
      },
      {
        id: "evt_2",
        order_id: "ord_1001",
        order_number: "GLRX-1001",
        driver_id: "drv_1",
        driver_name: "Javier Rivera",
        event_type: "picked_up",
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        gps_lat: 42.7325,
        gps_lng: -84.5555,
        barcode_scan: "GLRX1001BC",
        signature_url: null,
        temperature_reading: null,
        temperature_excursion: false,
        company_id: companyId,
        notes: "Picked up from Great Lakes Specialty Pharmacy",
      },
      {
        id: "evt_3",
        order_id: "ord_1001",
        order_number: "GLRX-1001",
        driver_id: "drv_1",
        driver_name: "Javier Rivera",
        event_type: "in_transit",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        gps_lat: 42.742,
        gps_lng: -84.542,
        barcode_scan: null,
        signature_url: null,
        temperature_reading: null,
        temperature_excursion: false,
        company_id: companyId,
        notes: "En route to patient",
      },
      {
        id: "evt_4",
        order_id: "ord_1003",
        order_number: "GLRX-1003",
        driver_id: "drv_2",
        driver_name: "Simi Okafor",
        event_type: "delivered",
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        gps_lat: 42.7175,
        gps_lng: -84.4297,
        barcode_scan: "GLRX1003BC",
        signature_url: null,
        temperature_reading: null,
        temperature_excursion: false,
        company_id: companyId,
        notes: "Delivered, signed by patient",
      },
    ],
    messages: [
      {
        id: "msg_1",
        driver_id: "drv_1",
        driver_name: "Javier Rivera",
        sender_name: "Dana Whitfield",
        sender_id: "user_dispatch",
        message: "Heads up — GLRX-1001 requires a dual signature, Schedule II.",
        read: false,
        company_id: companyId,
        created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      },
    ],
  };
  return data;
}

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(seed(), null, 2));
  }
}

function load() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  for (const key of COLLECTIONS) {
    if (!Array.isArray(parsed[key])) parsed[key] = [];
  }
  return parsed;
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  read: load,
  write: save,
};
