"use client";

import Link from "next/link";
import { Modal, PassMark } from "@/components/ui";
import { ACHIEVEMENTS, type Awards } from "@/progress/logic";
import type { MissionReport } from "@/missions/evaluate";
import type { MissionDef } from "@/missions/types";
import type { ScenarioRun } from "@/runtime/missionRunner";
import { interpretReport } from "@/content/nova";

const RUBRIC: [keyof MissionReport["rubric"], string, number][] = [
  ["correctness", "Correctness & reliability", 50],
  ["safety", "Safety", 20],
  ["efficiency", "Efficiency", 15],
  ["independence", "Independence", 15],
];

export function ResultsModal({
  open,
  onClose,
  mission,
  report,
  runs,
  awards,
  onReplay,
}: {
  open: boolean;
  onClose: () => void;
  mission: MissionDef;
  report: MissionReport;
  runs: ScenarioRun[];
  awards: Awards;
  onReplay: (r: ScenarioRun) => void;
}) {
  const notes = interpretReport(report);
  return (
    <Modal open={open} onClose={onClose} title={report.passed ? "Mission passed! 🎉" : "Not passed yet"}>
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className={`grid h-24 w-24 place-items-center rounded-full text-3xl font-bold ${report.passed ? "bg-mint/25 text-mint" : "bg-danger/20 text-danger"}`}>
            {report.score}
            <span className="sr-only">out of 100</span>
          </div>
          <div className="flex-1">
            <PassMark passed={report.passed} />
            {report.hiddenTotal > 0 && (
              <p className="text-sm text-white/75">
                Hidden tests: {report.hiddenPassed} / {report.hiddenTotal} passed (need {report.hiddenRequired})
              </p>
            )}
            {report.safetyGateFailed && <p className="text-sm font-semibold text-sun">⚠ Safety violation — automatic fail.</p>}
          </div>
        </div>

        {awards.needsDocumentation && (
          <div className="rounded-2xl bg-sun/15 p-4 text-sun" role="status">
            Your robot passed the technical tests! To complete the capstone, finish the engineering documentation in the{" "}
            <strong>Notebook</strong> tab. Rewards and mastery are granted once it&apos;s complete.
          </div>
        )}
        {(awards.xp > 0 || awards.coins > 0 || awards.achievements.length > 0) && (
          <div className="rounded-2xl bg-lavender/15 p-4">
            <h3 className="font-semibold">Game rewards</h3>
            <p className="mt-1">
              +{awards.xp} XP · +{awards.coins} 🪙
            </p>
            {awards.achievements.map((a) => (
              <p key={a} className="mt-1">
                {ACHIEVEMENTS[a]?.icon} Achievement unlocked: <strong>{ACHIEVEMENTS[a]?.name}</strong>
              </p>
            ))}
            <p className="mt-1 text-xs text-white/60">Rewards are given once per mission. Mastery evidence is recorded separately in your skill tree.</p>
          </div>
        )}

        <div>
          <h3 className="font-semibold">Rubric</h3>
          <ul className="mt-2 grid gap-2">
            {RUBRIC.map(([k, label, max]) => (
              <li key={k}>
                <div className="flex justify-between text-sm">
                  <span>{label}</span>
                  <span>
                    {report.rubric[k]} / {max}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-sky" style={{ width: `${(report.rubric[k] / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Test scenarios</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="py-1">Scenario</th>
                  <th>Result</th>
                  <th>Criteria</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {report.scenarios.map((sc, i) => (
                  <tr key={i} className="border-t border-white/10 align-top">
                    <td className="py-2">{sc.name}</td>
                    <td>
                      <PassMark passed={sc.passed} />
                    </td>
                    <td>
                      <ul>
                        {sc.criteria.map((c) => (
                          <li key={c.id} title={c.detail}>
                            <span aria-hidden>{c.passed ? "✔" : "✖"}</span> {c.label}
                            {!c.passed && <span className="block text-xs text-white/60">{c.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>{sc.metrics.time.toFixed(1)}s</td>
                    <td>
                      {runs[i]?.frames.length > 0 && (
                        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => onReplay(runs[i])}>
                          Replay
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(mission.kind === "assessment" || mission.kind === "capstone") && (
            <p className="mt-1 text-xs text-white/50">Hidden layouts stay secret so assessments stay fair — only the results are shown.</p>
          )}
          {report.codeChecks.map((c) => (
            <p key={c.id} className="mt-2 text-sm">
              <span aria-hidden>{c.passed ? "✔" : "✖"}</span> {c.label}
            </p>
          ))}
        </div>

        <div>
          <h3 className="font-semibold">Feedback</h3>
          <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-white/85">
            {report.feedback.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
            {notes.map((n, i) => (
              <li key={`n${i}`}>🧭 {n.text}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={onClose}>
            {report.passed ? "Keep improving" : "Back to debugging"}
          </button>
          <Link href="/map" className="btn btn-ghost">
            World map
          </Link>
          <Link href="/notebook" className="btn btn-ghost">
            Notebook
          </Link>
        </div>
      </div>
    </Modal>
  );
}
