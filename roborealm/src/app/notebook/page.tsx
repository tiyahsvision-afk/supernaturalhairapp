"use client";

import Link from "next/link";
import { useState } from "react";
import { MISSIONS } from "@/missions/missions";
import { PageTitle } from "@/components/ui";
import { DOC_FIELDS } from "@/progress/logic";
import { useGame } from "@/progress/store";

export default function Notebook() {
  const s = useGame();
  const started = MISSIONS.filter((m) => s.attempts.some((a) => a.missionId === m.id) || s.notebook[m.id]);
  const [sel, setSel] = useState(started[0]?.id ?? null);
  const m = MISSIONS.find((x) => x.id === sel);
  const entry = sel ? s.notebook[sel] : undefined;
  const attempts = s.attempts.filter((a) => a.missionId === sel);
  const submits = attempts.filter((a) => a.mode === "submit");
  const best = submits.filter((a) => a.passed).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const errors = attempts.filter((a) => a.error);

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6">
      <PageTitle title="Engineering Notebook" sub="Generated automatically from your work — objectives, designs, code, test runs, errors and results. Add your own notes too." />
      {started.length === 0 ? (
        <p className="panel p-6 text-white/70">
          Your notebook fills in as you play. <Link href="/map" className="text-sky underline">Start a mission</Link>.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <nav className="panel h-fit p-3" aria-label="Notebook entries">
            <ul className="grid gap-1">
              {started.map((x) => (
                <li key={x.id}>
                  <button className={`w-full rounded-xl px-3 py-2 text-left text-sm ${x.id === sel ? "bg-white/15" : "hover:bg-white/10"}`} onClick={() => setSel(x.id)} aria-current={x.id === sel}>
                    {s.game.completed[x.id] ? "✔ " : ""}
                    {x.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {m && (
            <article className="panel grid gap-5 p-6">
              <header>
                <h2 className="font-display text-2xl font-bold">{m.title}</h2>
                <p className="mt-1 text-white/75">
                  <strong>Objective:</strong> {m.objective}
                </p>
              </header>
              <section>
                <h3 className="font-semibold">Summary</h3>
                <p className="text-sm text-white/75">
                  {attempts.length} runs · {submits.length} submissions · {errors.length} runs with errors · status:{" "}
                  {s.game.completed[m.id] ? `completed (best ${s.game.completed[m.id].bestScore}/100)` : "in progress"}
                </p>
              </section>
              {best && (
                <section>
                  <h3 className="font-semibold">Best passing solution</h3>
                  <p className="text-sm text-white/65">
                    Robot: {best.robot.name} ({best.robot.chassis}, {best.robot.drive}, {best.robot.motor}, sensors: {best.robot.sensors.map((x) => `${x.part}@${x.mount}`).join(", ") || "none"}
                    {best.robot.gripper ? ", gripper" : ""})
                  </p>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-ink/70 p-3 text-xs">{best.code}</pre>
                  {best.report && (
                    <p className="mt-1 text-sm">
                      Score {best.report.score}/100 · hidden {best.report.hiddenPassed}/{best.report.hiddenTotal} · hints used {best.hintsUsed}
                    </p>
                  )}
                </section>
              )}
              <section>
                <h3 className="font-semibold">Test runs & debugging log</h3>
                <ol className="mt-2 grid gap-1 text-sm">
                  {attempts
                    .slice()
                    .reverse()
                    .slice(0, 30)
                    .map((a) => (
                      <li key={a.id} className="rounded-lg bg-white/5 p-2">
                        <span className="text-white/50">{new Date(a.at).toLocaleString()}</span> · {a.summary}
                        {a.error && (
                          <span className="block text-xs text-danger">
                            {a.error.type}
                            {a.error.line ? ` (line ${a.error.line})` : ""}: {a.error.message}
                          </span>
                        )}
                        {a.metrics && (
                          <span className="block text-xs text-white/55">
                            {a.metrics.time}s · {a.metrics.distance} m · {a.metrics.collisions} collisions · battery {a.metrics.batteryUsedPct}%
                          </span>
                        )}
                      </li>
                    ))}
                </ol>
              </section>
              <section>
                <h3 className="font-semibold">My notes</h3>
                <textarea
                  key={m.id}
                  className="field mt-2 min-h-28"
                  defaultValue={entry?.notes ?? ""}
                  onBlur={(e) => s.updateNotes(m.id, e.target.value)}
                  aria-label="Notes"
                  placeholder="Design decisions, what failed, what you'd try next…"
                />
              </section>
              {m.requiresDocumentation && (
                <section>
                  <h3 className="font-semibold">Capstone documentation</h3>
                  {entry?.documentation ? (
                    <dl className="mt-2 grid gap-2 text-sm">
                      {DOC_FIELDS.map((f) => (
                        <div key={f.key}>
                          <dt className="font-semibold text-white/70">{f.label}</dt>
                          <dd className="whitespace-pre-line">{entry.documentation![f.key] || "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-white/60">Write it from the Notebook tab inside the capstone mission.</p>
                  )}
                </section>
              )}
              <Link href={`/mission/${m.id}`} className="btn btn-primary w-fit">
                Open mission
              </Link>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
