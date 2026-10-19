"use client";

import { RobotPortrait } from "@/components/RobotArt";
import { Avatar } from "@/components/Avatar";
import { download, PageTitle } from "@/components/ui";
import { STATIC } from "@/components/nav";
import { COMPETENCIES } from "@/content/competencies";
import { MISSIONS } from "@/missions/missions";
import { DOC_FIELDS, MASTERY_LABEL, MASTERY_ORDER, masteryMap } from "@/progress/logic";
import { useGame } from "@/progress/store";
import type { Attempt } from "@/progress/types";

export default function Portfolio() {
  const s = useGame();
  if (!s.profile) return null;
  const mastery = masteryMap(s);
  const demonstrated = COMPETENCIES.filter((c) => MASTERY_ORDER.indexOf(mastery[c.id]) >= MASTERY_ORDER.indexOf("proficient"));
  const projects = MISSIONS.filter((m) => s.game.completed[m.id])
    .map((m) => ({ m, a: s.attempts.find((a) => a.id === s.game.completed[m.id].attemptId) ?? bestAttempt(s.attempts, m.id) }))
    .filter((p): p is { m: (typeof MISSIONS)[number]; a: Attempt } => !!p.a);
  const capstone = projects.find((p) => p.m.kind === "capstone");
  const capDoc = s.notebook["cap-autonomous-delivery"]?.documentation;

  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 print-text">
      <PageTitle title="Engineering Portfolio" sub="Evidence of what you have demonstrated. Stored only in this browser — nothing is published.">
        <div className="no-print flex flex-wrap gap-2">
          {!STATIC && (
            <button className="btn btn-primary" onClick={() => window.print()} title="Use your browser's 'Save as PDF' destination">
              🖨️ Print / Save as PDF
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() =>
              download(
                "roborealm-results.json",
                JSON.stringify(
                  projects.map(({ m, a }) => ({ mission: m.id, title: m.title, kind: m.kind, at: a.at, score: a.report?.score, report: a.report, robot: a.robot })),
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            ⬇ Results (JSON)
          </button>
          <button className="btn btn-ghost" onClick={() => download("roborealm-robots.json", JSON.stringify(s.garage, null, 2), "application/json")}>
            ⬇ Robot configs
          </button>
        </div>
      </PageTitle>

      <section className="panel mb-5 flex flex-wrap items-center gap-5 p-5">
        <Avatar a={s.profile.avatar} size={90} />
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">{s.profile.nickname}</h2>
          <p className="text-sm text-white/70">ROBOREALM engineering portfolio · generated {new Date().toLocaleDateString()}</p>
          <p className="mt-1 text-xs text-white/50">
            Simulated, game-based evidence. Not an accredited certification or employment credential. Virtual practice does not replace supervised
            hands-on training.
          </p>
        </div>
      </section>

      <section className="panel mb-5 p-5">
        <h2 className="font-display text-xl font-bold">Demonstrated skills</h2>
        {demonstrated.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {demonstrated.map((c) => (
              <li key={c.id} className="rounded-xl bg-white/5 p-3 text-sm">
                <span className="font-mono text-xs text-white/50">{c.id}</span> <strong>{c.name}</strong> — {MASTERY_LABEL[mastery[c.id]]}
                <span className="block text-xs text-white/60">{c.passingCriteria}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/60">Pass an independent assessment to add your first demonstrated skill.</p>
        )}
      </section>

      <section className="panel mb-5 p-5">
        <h2 className="font-display text-xl font-bold">Robot designs</h2>
        <ul className="mt-3 flex flex-wrap gap-4">
          {s.garage.map((g) => (
            <li key={g.id} className="text-center text-sm">
              <RobotPortrait d={g} size={90} />
              <div className="font-semibold">{g.name}</div>
              <div className="text-xs text-white/60">
                {g.chassis} · {g.motor} · {g.sensors.length} sensors{g.gripper ? " · gripper" : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {capstone && (
        <section className="panel mb-5 p-5">
          <h2 className="font-display text-xl font-bold">🏆 Capstone: {capstone.m.title}</h2>
          <p className="mt-1 text-sm">
            Score {capstone.a.report?.score}/100 · hidden layouts passed {capstone.a.report?.hiddenPassed}/{capstone.a.report?.hiddenTotal} · robot {capstone.a.robot.name}
          </p>
          {capDoc && (
            <dl className="mt-3 grid gap-3 text-sm">
              {DOC_FIELDS.map((f) => (
                <div key={f.key}>
                  <dt className="font-semibold">{f.label}</dt>
                  <dd className="whitespace-pre-line text-white/85">{capDoc[f.key]}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}

      <section className="grid gap-4">
        <h2 className="font-display text-xl font-bold">Completed projects</h2>
        {projects.length === 0 && <p className="text-white/60">Complete missions to build your portfolio.</p>}
        {projects.map(({ m, a }) => (
          <article key={m.id} className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                <p className="text-sm text-white/70">{m.objective}</p>
                <p className="mt-1 text-xs text-white/55">
                  {m.kind} · {new Date(a.at).toLocaleDateString()} · score {a.report?.score ?? "–"}/100 · hints {a.hintsUsed} · skills {m.skills.join(", ")}
                </p>
              </div>
              <button className="btn btn-ghost no-print !py-1 text-sm" onClick={() => download(`${slug(m.title)}.py`, a.code, "text/x-python")}>
                ⬇ .py
              </button>
            </div>
            {a.report && (
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-white/55">
                  <tr>
                    <th>Scenario</th>
                    <th>Result</th>
                    <th>Time</th>
                    <th>Collisions</th>
                    <th>Battery</th>
                  </tr>
                </thead>
                <tbody>
                  {a.report.scenarios.map((sc) => (
                    <tr key={sc.index} className="border-t border-white/5">
                      <td className="py-0.5">{sc.name}</td>
                      <td>{sc.passed ? "✔ pass" : "✖ fail"}</td>
                      <td>{sc.metrics.time}s</td>
                      <td>{sc.metrics.collisions}</td>
                      <td>{sc.metrics.batteryUsedPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <details className="mt-3">
              <summary className="no-print cursor-pointer text-sm text-sky">Source code</summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded-xl bg-ink/70 p-3 text-xs">{a.code}</pre>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}

function bestAttempt(attempts: Attempt[], missionId: string) {
  return attempts.filter((a) => a.missionId === missionId && a.mode === "submit" && a.passed).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}
