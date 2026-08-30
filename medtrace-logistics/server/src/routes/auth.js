import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { signToken, requireAuth } from "../auth.js";

export const authRouter = Router();

function publicUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

authRouter.post("/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password and name are required" });
  }
  const data = db.read();
  if (data.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }
  const user = {
    id: `user_${randomUUID()}`,
    email,
    name,
    password_hash: bcrypt.hashSync(password, 8),
    role: "user",
    company_id: null,
    company_role: null,
    created_at: new Date().toISOString(),
  };
  data.users.push(user);
  db.write(data);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  const data = db.read();
  const user = data.users.find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const data = db.read();
  const user = data.users.find((u) => u.id === req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

// Join a company via its shareable join_code (defaults to the "driver" company role).
authRouter.post("/join-company", requireAuth, (req, res) => {
  const { join_code } = req.body || {};
  const data = db.read();
  const company = data.companies.find(
    (c) => c.join_code.toLowerCase() === (join_code || "").toLowerCase()
  );
  if (!company) return res.status(404).json({ error: "No company matches that join code" });
  const user = data.users.find((u) => u.id === req.auth.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.company_id = company.id;
  user.company_role = user.company_role || "driver";
  db.write(data);
  const token = signToken(user);
  res.json({ token, user: publicUser(user), company });
});
