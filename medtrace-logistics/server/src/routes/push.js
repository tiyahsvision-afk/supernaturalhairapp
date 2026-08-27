import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { getPublicKey } from "../push.js";

export const pushRouter = Router();

pushRouter.get("/public-key", (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

pushRouter.post("/subscribe", requireAuth, (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription?.endpoint) return res.status(400).json({ error: "subscription is required" });
  const data = db.read();
  data.pushSubscriptions = data.pushSubscriptions.filter((s) => s.subscription.endpoint !== subscription.endpoint);
  data.pushSubscriptions.push({
    id: `sub_${randomUUID()}`,
    user_id: req.auth.sub,
    subscription,
    created_at: new Date().toISOString(),
  });
  db.write(data);
  res.status(201).json({ ok: true });
});

pushRouter.post("/unsubscribe", requireAuth, (req, res) => {
  const { endpoint } = req.body || {};
  const data = db.read();
  data.pushSubscriptions = data.pushSubscriptions.filter((s) => s.subscription.endpoint !== endpoint);
  db.write(data);
  res.json({ ok: true });
});
