import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../context/LiveContext";
import type { DriverMessage } from "../types";

export function MessageThread({ driverId, driverName }: { driverId: string; driverName: string }) {
  const { user } = useAuth();
  const live = useLive();
  const { data, refetch } = useApi<{ messages: DriverMessage[] }>(`/messages?driver_id=${driverId}`, [
    driverId,
    live.versions.messages,
  ]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api("/messages", { method: "POST", body: { driver_id: driverId, message: text } });
      setText("");
      await refetch();
    } finally {
      setSending(false);
    }
  }

  const messages = data?.messages || [];

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs font-medium text-slate-500">Messages with {driverName}</p>
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${mine ? "bg-teal-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
                <p>{m.message}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-teal-100" : "text-slate-400"}`}>
                  {m.sender_name} · {new Date(m.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        {!messages.length && <p className="text-center text-sm text-slate-400">No messages yet — say hello.</p>}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
