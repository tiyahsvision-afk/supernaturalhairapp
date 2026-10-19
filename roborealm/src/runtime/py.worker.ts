/// <reference lib="webworker" />
/**
 * Runs student Python (Pyodide) and the deterministic simulation together,
 * off the main thread. The page terminates this worker if it stops responding
 * (e.g. a tight infinite loop), so the UI never freezes.
 */
import { getMission } from "@/missions/missions";
import { deriveSpec, type RobotDesign } from "@/robots/design";
import { runScenario, submitMission } from "./missionRunner";
import type { PyodideLike } from "./runner";

export type WorkerRequest =
  | { id: number; kind: "warmup" }
  | { id: number; kind: "test"; missionId: string; design: RobotDesign; code: string; scenario: number }
  | { id: number; kind: "submit"; missionId: string; design: RobotDesign; code: string; hintsUsed: number };

let pyPromise: Promise<PyodideLike> | null = null;

function loadPy(): Promise<PyodideLike> {
  pyPromise ??= (async () => {
    const url = new URL("/pyodide/pyodide.mjs", self.location.origin).href;
    const mod = await import(/* webpackIgnore: true */ url);
    return (await mod.loadPyodide({ indexURL: new URL("/pyodide/", self.location.origin).href })) as PyodideLike;
  })();
  return pyPromise;
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    const py = await loadPy();
    if (req.kind === "warmup") {
      self.postMessage({ id: req.id, ok: true, result: null });
      return;
    }
    const mission = getMission(req.missionId);
    if (!mission) throw new Error(`Unknown mission ${req.missionId}`);
    const spec = deriveSpec(req.design);
    if (req.kind === "test") {
      const run = runScenario(py, mission, spec, req.code, req.scenario, true);
      self.postMessage({ id: req.id, ok: true, result: run });
    } else {
      const res = submitMission(py, mission, spec, req.code, req.hintsUsed);
      self.postMessage({ id: req.id, ok: true, result: res });
    }
  } catch (e) {
    self.postMessage({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
