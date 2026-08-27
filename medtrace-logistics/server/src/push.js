import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import webpush from "web-push";
import { db } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAPID_FILE = path.join(__dirname, "..", "data", "vapid.json");

function loadOrCreateVapidKeys() {
  const dir = path.dirname(VAPID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(VAPID_FILE)) {
    return JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2));
  return keys;
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails("mailto:dispatch@medtrace.app", vapidKeys.publicKey, vapidKeys.privateKey);

export function getPublicKey() {
  return vapidKeys.publicKey;
}

// Removes a subscription that the push service reports as gone (unsubscribed,
// expired, or the browser/profile no longer exists).
function dropSubscription(data, endpoint) {
  data.pushSubscriptions = data.pushSubscriptions.filter((s) => s.subscription.endpoint !== endpoint);
  db.write(data);
}

async function sendToSubscription(data, sub, payload) {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      dropSubscription(data, sub.subscription.endpoint);
    } else {
      console.error("Push send failed:", err.statusCode, err.body || err.message);
    }
  }
}

export function pushToUser(data, userId, payload) {
  const subs = data.pushSubscriptions.filter((s) => s.user_id === userId);
  for (const sub of subs) sendToSubscription(data, sub, payload);
}

export function pushToDriver(data, driver, payload) {
  if (!driver?.user_email) return;
  const user = data.users.find((u) => u.email === driver.user_email);
  if (user) pushToUser(data, user.id, payload);
}

export function pushToCompanyAdmins(data, companyId, payload) {
  const admins = data.users.filter((u) => u.company_id === companyId && u.company_role === "admin");
  for (const admin of admins) pushToUser(data, admin.id, payload);
}
