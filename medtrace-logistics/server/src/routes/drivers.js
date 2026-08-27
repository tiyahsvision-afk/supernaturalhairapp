import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { requireCompanyMember, requireCompanyAdmin, scopedToCompany } from "../scope.js";

export const driversRouter = Router();

driversRouter.use(requireAuth, requireCompanyMember);

driversRouter.get("/", (req, res) => {
  const data = db.read();
  const drivers = data.drivers.filter((d) => scopedToCompany(req, d));
  res.json({ drivers });
});

driversRouter.post("/", requireCompanyAdmin, (req, res) => {
  const { name, user_email, vehicle, phone, license_number, michigan_board_of_pharmacy_license } =
    req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const data = db.read();
  const driver = {
    id: `drv_${randomUUID()}`,
    name,
    user_email: user_email || "",
    vehicle: vehicle || "",
    phone: phone || "",
    license_number: license_number || "",
    status: "available",
    current_lat: null,
    current_lng: null,
    michigan_board_of_pharmacy_license: michigan_board_of_pharmacy_license || "",
    company_id: req.isPlatformAdmin ? req.body.company_id : req.user.company_id,
    created_at: new Date().toISOString(),
  };
  data.drivers.push(driver);
  db.write(data);
  res.status(201).json({ driver });
});

driversRouter.patch("/:id", (req, res) => {
  const data = db.read();
  const driver = data.drivers.find((d) => d.id === req.params.id);
  if (!driver || !scopedToCompany(req, driver)) {
    return res.status(404).json({ error: "Driver not found" });
  }
  const isSelf = driver.user_email === req.user.email;
  if (!isSelf && req.user.company_role !== "admin" && !req.isPlatformAdmin) {
    return res.status(403).json({ error: "Not allowed" });
  }
  const allowed = ["status", "current_lat", "current_lng", "vehicle", "phone", "license_number"];
  for (const key of allowed) {
    if (key in req.body) driver[key] = req.body[key];
  }
  db.write(data);
  res.json({ driver });
});
