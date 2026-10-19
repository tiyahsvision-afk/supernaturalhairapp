"use client";

import type { MissionReport } from "@/missions/evaluate";
import type { RobotDesign } from "@/robots/design";
import type { ScenarioRun } from "./missionRunner";

type Status = "idle" | "loading" | "ready" | "running";
type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

/**
 * Main-thread handle on the Python worker. Enforces a wall-clock timeout as the
 * last line of defence: if Python is stuck, the worker is terminated and recreated.
 */
class PythonClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private listeners = new Set<(s: Status) => void>();
  status: Status = "idle";

  private setStatus(s: Status) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  onStatus(fn: (s: Status) => void) {
    this.listeners.add(fn);
    fn(this.status);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL("./py.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (ev: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = this.pending.get(ev.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(ev.data.id);
      if (!this.pending.size) this.setStatus("ready");
      if (ev.data.ok) p.resolve(ev.data.result);
      else p.reject(new Error(ev.data.error));
    };
    w.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "The Python worker crashed."));
      this.reset();
    };
    this.worker = w;
    return w;
  }

  private reset() {
    for (const p of this.pending.values()) clearTimeout(p.timer);
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.setStatus("idle");
  }

  private request<T>(msg: Record<string, unknown>, timeoutMs: number, status: Status): Promise<T> {
    const w = this.ensure();
    const id = ++this.seq;
    this.setStatus(status);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.reset();
        reject(
          new Error(
            "Your program took too long to run and was stopped. Check for a loop that never ends, or one that never calls a robot command.",
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      w.postMessage({ id, ...msg });
    });
  }

  warmup() {
    if (this.status === "idle") void this.request({ kind: "warmup" }, 120_000, "loading").catch(() => {});
  }

  test(missionId: string, design: RobotDesign, code: string, scenario = 0) {
    return this.request<ScenarioRun>({ kind: "test", missionId, design, code, scenario }, 60_000, "running");
  }

  submit(missionId: string, design: RobotDesign, code: string, hintsUsed: number) {
    return this.request<{ report: MissionReport; runs: ScenarioRun[] }>(
      { kind: "submit", missionId, design, code, hintsUsed },
      180_000,
      "running",
    );
  }

  /** Abort whatever is running (Stop button). */
  stop() {
    for (const p of this.pending.values()) p.reject(new Error("Stopped."));
    this.reset();
  }
}

let client: PythonClient | null = null;
export const python = () => (client ??= new PythonClient());
export type { Status as PythonStatus };
