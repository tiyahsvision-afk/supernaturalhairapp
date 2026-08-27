import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

type Topic = "orders" | "drivers" | "messages";
type Versions = Record<Topic, number>;

interface LiveContextValue {
  versions: Versions;
  connected: boolean;
}

const ZERO_VERSIONS: Versions = { orders: 0, drivers: 0, messages: 0 };
const LiveContext = createContext<LiveContextValue>({ versions: ZERO_VERSIONS, connected: false });

// Keeps one WebSocket open while signed in and bumps a per-topic counter
// whenever the server says that topic changed — pages pass the counter into
// useApi's deps so they refetch through the normal authorized REST route
// instead of trusting data pushed straight over the socket.
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<Versions>(ZERO_VERSIONS);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      socketRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "changed" && msg.topic) {
            setVersions((v) => ({ ...v, [msg.topic as Topic]: (v[msg.topic as Topic] ?? 0) + 1 }));
          }
        } catch {
          // ignore malformed frames
        }
      };
    }
    connect();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [user]);

  return <LiveContext.Provider value={{ versions, connected }}>{children}</LiveContext.Provider>;
}

export function useLive() {
  return useContext(LiveContext);
}
