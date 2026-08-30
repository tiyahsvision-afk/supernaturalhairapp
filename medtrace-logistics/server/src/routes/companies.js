import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { requireAuth, requirePlatformAdmin } from "../auth.js";
import { requireCompanyMember } from "../scope.js";

export const companiesRouter = Router();

function genJoinCode(name) {
  const prefix = name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "CORP";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

// Platform admin only, matching the Company entity's create RLS.
companiesRouter.post("/", requireAuth, requirePlatformAdmin, (req, res) => {
  const { name, address, city, state, license_number, industry, contact_phone } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const data = db.read();
  const company = {
    id: `co_${randomUUID()}`,
    name,
    address: address || "",
    city: city || "",
    state: state || "",
    license_number: license_number || "",
    industry: industry || "",
    contact_phone: contact_phone || "",
    join_code: genJoinCode(name),
    status: "active",
    created_at: new Date().toISOString(),
  };
  data.companies.push(company);
  db.write(data);
  res.status(201).json({ company });
});

companiesRouter.get("/", requireAuth, requirePlatformAdmin, (req, res) => {
  const data = db.read();
  res.json({ companies: data.companies });
});

companiesRouter.get("/mine", requireAuth, requireCompanyMember, (req, res) => {
  const data = db.read();
  const company = data.companies.find((c) => c.id === req.user.company_id);
  if (!company) return res.status(404).json({ error: "No company" });
  res.json({ company });
});
