import { WebSocketServer } from "ws";

let wss = null;

export function initLive(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
  });

  // Drop dead connections so a broadcast never blocks on a stale socket.
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on("close", () => clearInterval(interval));

  return wss;
}

// Tells every connected tab "something in `topic` changed, go refetch it" —
// deliberately payload-free so the client always re-reads through the normal
// authorized REST routes instead of trusting data pushed over the socket.
export function broadcast(topic) {
  if (!wss) return;
  const payload = JSON.stringify({ type: "changed", topic, at: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  });
}
