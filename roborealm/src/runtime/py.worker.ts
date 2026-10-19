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

export type WorkerRequest = { base: string } & (
  | { id: number; kind: "warmup" }
  | { id: number; kind: "test"; missionId: string; design: RobotDesign; code: string; scenario: number }
  | { id: number; kind: "submit"; missionId: string; design: RobotDesign; code: string; hintsUsed: number }
);

let pyPromise: Promise<PyodideLike> | null = null;

/** `base` is the page's directory URL, so the runtime also loads when the app is hosted under a sub-path. */
function loadPy(base: string): Promise<PyodideLike> {
  pyPromise ??= (async () => {
    const indexURL = new URL("pyodide/", base).href;
    const mod = await import(/* webpackIgnore: true */ `${indexURL}pyodide.mjs`);
    // Some static hosts refuse .zip files; the static build ships the stdlib as base64 text instead.
    let stdLibURL: string | undefined;
    if (process.env.NEXT_PUBLIC_STATIC === "1") {
      const b64 = await (await fetch(`${indexURL}python_stdlib.b64.txt`)).text();
      const bytes = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
      stdLibURL = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    }
    return (await mod.loadPyodide({ indexURL, stdLibURL })) as PyodideLike;
  })();
  return pyPromise;
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    const py = await loadPy(req.base);
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
