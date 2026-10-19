"use client";

import { explainError } from "@/content/nova";
import type { ScenarioRun } from "@/runtime/missionRunner";
import type { TraceStep } from "@/runtime/runner";

const EVENT_STYLE: Record<string, { icon: string; cls: string }> = {
  print: { icon: "›", cls: "text-white/85" },
  collision: { icon: "💥", cls: "text-danger" },
  safety_violation: { icon: "⚠", cls: "text-sun font-semibold" },
  zone_enter: { icon: "⤵", cls: "text-sky" },
  pickup: { icon: "✋", cls: "text-peach" },
  drop: { icon: "📦", cls: "text-peach" },
  delivered: { icon: "✅", cls: "text-mint font-semibold" },
  battery_depleted: { icon: "🪫", cls: "text-danger" },
  estop: { icon: "🛑", cls: "text-danger font-semibold" },
  error: { icon: "✖", cls: "text-danger" },
  command: { icon: "•", cls: "text-white/60" },
};

export function ConsolePanel({ run, frameT, runError, diagnostics }: { run: ScenarioRun | null; frameT: number; runError: string | null; diagnostics: boolean }) {
  const shown = (run?.events ?? []).filter((e) => e.t <= frameT + 1e-9 && e.type !== "sensor" && e.type !== "zone_exit");
  return (
    <div className="panel p-3">
      <h2 className="mb-2 text-sm font-semibold">🖥️ Console & event log</h2>
      <div className="max-h-56 overflow-y-auto rounded-xl bg-ink/70 p-3 font-mono text-xs" role="log" aria-live="polite" aria-label="Console output">
        {runError && <p className="text-danger">⚠ {runError}</p>}
        {!run && !runError && <p className="text-white/50">Press Run to start the simulation. Output from print() and robot events appear here.</p>}
        {shown.map((e, i) => {
          const st = EVENT_STYLE[e.type] ?? EVENT_STYLE.command;
          return (
            <p key={i} className={st.cls}>
              <span className="text-white/40">[{e.t.toFixed(2)}s{e.line ? ` L${e.line}` : ""}]</span> <span aria-hidden>{st.icon}</span> {e.message}
            </p>
          );
        })}
        {run?.error && frameT >= (run.frames.at(-1)?.t ?? 0) - 1e-9 && (
          <div className="mt-2 rounded-lg bg-danger/15 p-2 font-sans text-sm text-white">
            <strong className="text-danger">
              {run.error.type}
              {run.error.line ? ` on line ${run.error.line}` : ""}:
            </strong>{" "}
            {run.error.message}
            <p className="mt-1 text-white/75">🧭 NOVA: {explainError(run.error.type)}</p>
          </div>
        )}
      </div>
      {diagnostics && run && <DiagnosticsTable run={run} />}
    </div>
  );
}

function DiagnosticsTable({ run }: { run: ScenarioRun }) {
  const reads = run.events.filter((e) => e.type === "sensor" && e.data && "truth" in e.data).slice(0, 40);
  return (
    <details className="mt-3" open>
      <summary className="cursor-pointer text-sm font-semibold">🔬 Diagnostics: sensor vs reference laser</summary>
      {reads.length === 0 ? (
        <p className="mt-2 text-sm text-white/60">No distance readings recorded in the last run.</p>
      ) : (
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-white/60">
              <tr>
                <th className="py-1">t (s)</th>
                <th>Line</th>
                <th>Sensor reported</th>
                <th>Reference</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {reads.map((e, i) => {
                const v = Number(e.data!.value);
                const truth = Number(e.data!.truth);
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-0.5">{e.t.toFixed(2)}</td>
                    <td>{e.line ?? "–"}</td>
                    <td>{v.toFixed(3)} m</td>
                    <td>{truth.toFixed(3)} m</td>
                    <td className={Math.abs(v - truth) > 0.02 ? "text-sun" : ""}>{(v - truth >= 0 ? "+" : "") + (v - truth).toFixed(3)} m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-white/50">Readings at maximum range are clamped by the sensor.</p>
        </div>
      )}
    </details>
  );
}

export function Inspector({ run, step, stepIdx }: { run: ScenarioRun | null; step: TraceStep | null; stepIdx: number }) {
  if (!run) return null;
  const m = run.metrics;
  return (
    <div className="panel grid gap-3 p-3 md:grid-cols-2">
      <div>
        <h2 className="text-sm font-semibold">🔎 Step inspector</h2>
        {step ? (
          <div className="mt-1 text-sm">
            <p>
              Command {stepIdx + 1} / {run.trace.length} · line <strong>{step.line || "–"}</strong>
            </p>
            <p className="font-mono text-mint">
              {step.call}
              {step.result !== undefined && step.result !== null && <span className="text-white/60"> → {JSON.stringify(step.result)}</span>}
            </p>
            <p className="text-xs text-white/50">
              t = {step.t0.toFixed(2)}s → {step.t1.toFixed(2)}s
            </p>
            {Object.keys(step.vars).length > 0 ? (
              <table className="mt-2 w-full text-xs">
                <caption className="sr-only">Variables at this step</caption>
                <tbody className="font-mono">
                  {Object.entries(step.vars).map(([k, v]) => (
                    <tr key={k} className="border-t border-white/5">
                      <th scope="row" className="py-0.5 pr-2 text-left font-normal text-sky">
                        {k}
                      </th>
                      <td className="break-all">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 text-xs text-white/50">No variables yet.</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-white/60">{run.trace.length ? "Before the first command." : "No robot commands were executed."}</p>
        )}
      </div>
      <div>
        <h2 className="text-sm font-semibold">📈 Performance</h2>
        <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-white/60">Sim time</dt>
          <dd>{m.time.toFixed(1)} s</dd>
          <dt className="text-white/60">Distance</dt>
          <dd>{m.distance.toFixed(2)} m</dd>
          <dt className="text-white/60">Collisions</dt>
          <dd className={m.collisions ? "text-danger" : ""}>{m.collisions}</dd>
          <dt className="text-white/60">Safety violations</dt>
          <dd className={m.safetyViolations ? "text-sun" : ""}>{m.safetyViolations}</dd>
          <dt className="text-white/60">Battery used</dt>
          <dd>{m.batteryUsedPct.toFixed(2)}%</dd>
          <dt className="text-white/60">Commands / reads</dt>
          <dd>
            {m.commands} / {m.sensorReads}
          </dd>
          <dt className="text-white/60">Lines executed</dt>
          <dd>{run.linesExecuted}</dd>
        </dl>
        <ul className="mt-2 grid gap-0.5 text-sm" aria-label="Practice criteria">
          {run.criteria.map((c) => (
            <li key={c.id}>
              <span aria-hidden>{c.passed ? "✔" : "✖"}</span> <span className={c.passed ? "text-mint" : "text-danger"}>{c.label}</span>
              <span className="sr-only">{c.passed ? "met" : "not met"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
