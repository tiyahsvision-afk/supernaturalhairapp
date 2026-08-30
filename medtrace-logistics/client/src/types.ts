export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  company_id: string | null;
  company_role: "admin" | "driver" | null;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  license_number: string;
  industry: string;
  contact_phone: string;
  join_code: string;
  status: "active" | "suspended";
}

export interface Driver {
  id: string;
  name: string;
  user_email: string;
  vehicle: string;
  phone: string;
  license_number: string;
  status: "available" | "on_route" | "offline";
  current_lat: number | null;
  current_lng: number | null;
  michigan_board_of_pharmacy_license: string;
  company_id: string;
}

export type OrderStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "attempted"
  | "exception"
  | "cancelled";

export type PackageType = "standard" | "refrigerated" | "controlled_substance" | "dot_specimen";

export interface Order {
  id: string;
  order_number: string;
  patient_name: string;
  patient_dob: string | null;
  patient_address: string;
  patient_phone: string;
  pickup_pharmacy: string;
  pickup_address: string;
  delivery_address: string;
  status: OrderStatus;
  priority: "routine" | "urgent" | "stat";
  package_type: PackageType;
  temperature_required: boolean;
  temperature_min: number | null;
  temperature_max: number | null;
  requires_dual_signature: boolean;
  michigan_board_of_pharmacy_license: string;
  pharmacist_in_charge: string;
  dot_specimen_classification: string | null;
  driver_id: string | null;
  route_sequence: number | null;
  barcode: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  company_id: string;
  signature_url: string | null;
  recipient_signature_url: string | null;
  photo_proof_url: string | null;
  delivered_at: string | null;
  attempted_at: string | null;
  deadline: string | null;
  notes: string;
}

export type CustodyEventType =
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "attempted"
  | "exception"
  | "temp_reading";

export interface ChainOfCustodyEvent {
  id: string;
  order_id: string;
  order_number: string;
  driver_id: string;
  driver_name: string;
  event_type: CustodyEventType;
  timestamp: string;
  gps_lat: number | null;
  gps_lng: number | null;
  barcode_scan: string | null;
  signature_url: string | null;
  temperature_reading: number | null;
  temperature_excursion: boolean;
  company_id: string;
  notes: string;
}

export interface DriverMessage {
  id: string;
  driver_id: string;
  driver_name: string;
  sender_name: string;
  sender_id: string;
  message: string;
  read: boolean;
  company_id: string;
  created_at: string;
}
