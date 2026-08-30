import { db } from "./db.js";

// Loads the acting user onto req.user and enforces that they belong to a company
// (mirrors the {{user.data.company_id}} RLS checks in the Base44 schemas), unless
// they are the platform admin, who bypasses all tenant scoping.
export function requireCompanyMember(req, res, next) {
  const data = db.read();
  const user = data.users.find((u) => u.id === req.auth.sub);
  if (!user) return res.status(401).json({ error: "User not found" });
  req.user = user;
  req.isPlatformAdmin = user.role === "admin";
  if (!req.isPlatformAdmin && !user.company_id) {
    return res.status(403).json({ error: "Join a company before accessing this resource" });
  }
  next();
}

export function scopedToCompany(req, record) {
  return req.isPlatformAdmin || record.company_id === req.user.company_id;
}

export function requireCompanyAdmin(req, res, next) {
  if (req.isPlatformAdmin) return next();
  if (req.user.company_role !== "admin") {
    return res.status(403).json({ error: "Company admin only" });
  }
  next();
}
