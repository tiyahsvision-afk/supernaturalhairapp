import { loadPyodide } from "pyodide";
import type { PyodideLike } from "@/runtime/runner";

let instance: Promise<PyodideLike> | null = null;

/** One shared Pyodide per test file — the same runtime the browser worker uses. */
export function getPy(): Promise<PyodideLike> {
  instance ??= loadPyodide() as unknown as Promise<PyodideLike>;
  return instance;
}
