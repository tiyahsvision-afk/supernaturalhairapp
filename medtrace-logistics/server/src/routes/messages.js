import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { requireCompanyMember, scopedToCompany } from "../scope.js";
import { broadcast } from "../live.js";
import { pushToDriver, pushToCompanyAdmins } from "../push.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth, requireCompanyMember);

// Dispatchers see the whole company thread list; drivers see only their own messages.
messagesRouter.get("/", (req, res) => {
  const data = db.read();
  let messages = data.messages.filter((m) => scopedToCompany(req, m));
  if (req.user.company_role === "driver" && !req.isPlatformAdmin) {
    const myDriver = data.drivers.find((d) => d.user_email === req.user.email);
    messages = myDriver ? messages.filter((m) => m.driver_id === myDriver.id) : [];
  }
  const driverId = req.query.driver_id;
  if (driverId) messages = messages.filter((m) => m.driver_id === driverId);
  messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json({ messages });
});

messagesRouter.post("/", (req, res) => {
  const { driver_id, message } = req.body || {};
  if (!driver_id || !message) return res.status(400).json({ error: "driver_id and message are required" });
  const data = db.read();
  const driver = data.drivers.find((d) => d.id === driver_id && scopedToCompany(req, d));
  if (!driver) return res.status(404).json({ error: "Driver not found" });

  const entry = {
    id: `msg_${randomUUID()}`,
    driver_id: driver.id,
    driver_name: driver.name,
    sender_name: req.user.name,
    sender_id: req.user.id,
    message,
    read: false,
    company_id: driver.company_id,
    created_at: new Date().toISOString(),
  };
  data.messages.push(entry);
  db.write(data);
  broadcast("messages");

  const senderIsDriver = driver.user_email === req.user.email;
  if (senderIsDriver) {
    pushToCompanyAdmins(data, driver.company_id, {
      title: `Message from ${driver.name}`,
      body: message,
      url: "/drivers",
    });
  } else {
    pushToDriver(data, driver, {
      title: `Message from ${req.user.name}`,
      body: message,
      url: "/messages",
    });
  }

  res.status(201).json({ message: entry });
});

messagesRouter.patch("/:id/read", (req, res) => {
  const data = db.read();
  const message = data.messages.find((m) => m.id === req.params.id);
  if (!message || !scopedToCompany(req, message)) return res.status(404).json({ error: "Not found" });
  message.read = true;
  db.write(data);
  broadcast("messages");
  res.json({ message });
});
