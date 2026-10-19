"use client";

import { useState } from "react";
import { getCompetency } from "@/content/competencies";
import { CAREER_LINKS, explainError, interpretReport, reviewCode } from "@/content/nova";
import type { MissionReport } from "@/missions/evaluate";
import type { MissionDef } from "@/missions/types";
import type { ScenarioRun } from "@/runtime/missionRunner";
import { playSound } from "@/components/sound";
import { DOC_FIELDS, documentationIssues } from "@/progress/logic";
import { useGame } from "@/progress/store";
import type { Documentation } from "@/progress/types";

type Tab = "brief" | "lesson" | "nova" | "notebook";

export function MissionSidebar({
  mission,
  code,
  run,
  submission,
  hintsUsed,
}: {
  mission: MissionDef;
  code: string;
  run: ScenarioRun | null;
  submission: MissionReport | null;
  hintsUsed: number;
}) {
  const [tab, setTab] = useState<Tab>("brief");
  const tabs: [Tab, string][] = [
    ["brief", "📋 Brief"],
    ["lesson", "📘 Learn"],
    ["nova", "🧭 NOVA"],
    ["notebook", "📓 Notebook"],
  ];
  return (
    <aside className="panel flex max-h-[calc(100dvh-140px)] flex-col overflow-hidden xl:sticky xl:top-20">
      <div role="tablist" aria-label="Mission information" className="flex gap-1 border-b border-white/10 p-2">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold sm:text-sm ${tab === t ? "bg-white/15" : "text-white/65 hover:bg-white/10"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="overflow-y-auto p-4">
        {tab === "brief" && <Brief mission={mission} />}
        {tab === "lesson" && <Lesson mission={mission} />}
        {tab === "nova" && <Nova mission={mission} code={code} run={run} submission={submission} hintsUsed={hintsUsed} />}
        {tab === "notebook" && <MissionNotebook mission={mission} />}
      </div>
    </aside>
  );
}

function Brief({ mission }: { mission: MissionDef }) {
  return (
    <div className="grid gap-4 text-sm">
      <p className="whitespace-pre-line text-white/85">{mission.story}</p>
      <div className="rounded-2xl bg-lavender/15 p-3">
        <h3 className="font-semibold">🎯 Objective</h3>
        <p className="mt-1">{mission.objective}</p>
      </div>
      <div>
        <h3 className="font-semibold">Success criteria</h3>
        <ul className="mt-1 list-disc pl-5 text-white/80">
          {mission.successCriteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Skills</h3>
        <ul className="mt-1 flex flex-wrap gap-1">
          {mission.skills.map((id) => (
            <li key={id} className="chip" title={getCompetency(id)?.description}>
              {id} · {getCompetency(id)?.name}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-white/60">
        Rewards on first completion: {mission.rewards.xp} XP · {mission.rewards.coins} 🪙 · Time limit {mission.timeLimit}s (simulated)
      </p>
      {(mission.kind === "assessment" || mission.kind === "capstone") && (
        <p className="rounded-2xl bg-sun/10 p-3 text-sun">
          Independent work: {mission.kind === "assessment" ? "hints and NOVA chat are disabled." : "hints are available but recorded."} Submissions are
          tested on layouts you haven&apos;t seen.
        </p>
      )}
      {mission.requires && (
        <p className="text-white/60">
          Robot requirements:{" "}
          {[...(mission.requires.sensors ?? []).map((s) => `${s.kind} sensor at ${s.name}`), mission.requires.gripper ? "gripper" : null].filter(Boolean).join(", ")}
        </p>
      )}
      <p className="text-xs text-white/45">Virtual practice builds real skills, but it does not replace supervised training on physical robots.</p>
    </div>
  );
}

function Lesson({ mission }: { mission: MissionDef }) {
  return (
    <div className="grid gap-3">
      {mission.lesson.map((c) => (
        <article key={c.title} className="rounded-2xl bg-white/5 p-3">
          <h3 className="font-display text-lg font-semibold">{c.title}</h3>
          <p className="mt-1 text-sm text-white/80">{c.body}</p>
          {c.code && <pre className="mt-2 overflow-x-auto rounded-xl bg-ink/70 p-2 text-xs text-mint">{c.code}</pre>}
        </article>
      ))}
      {CAREER_LINKS[mission.worldId] && <p className="rounded-2xl bg-sky/10 p-3 text-sm">💼 Career link: {CAREER_LINKS[mission.worldId]}</p>}
    </div>
  );
}

function Nova({ mission, code, run, submission, hintsUsed }: { mission: MissionDef; code: string; run: ScenarioRun | null; submission: MissionReport | null; hintsUsed: number }) {
  const useHint = useGame((s) => s.useHint);
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [asking, setAsking] = useState(false);
  const assessment = mission.kind === "assessment";
  const review = reviewCode(code, mission);
  const notes = submission ? interpretReport(submission) : [];

  const ask = async () => {
    if (!q.trim()) return;
    setAsking(true);
    try {
      const res = await fetch("/api/nova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: mission.id, question: q, code, error: run?.error ? `${run.error.type}: ${run.error.message}` : undefined }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      setChat((c) => [...c, { q, a: data.answer ?? data.error ?? "No answer." }]);
      setQ("");
    } catch {
      setChat((c) => [...c, { q, a: "Couldn't reach NOVA chat. The hints and code review above still work offline." }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="grid gap-4 text-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-sky to-lavender text-2xl" aria-hidden>
          🤖
        </div>
        <p className="text-white/80">Hi, I&apos;m NOVA, your robotics mentor. I give clues, not answers — you&apos;re the engineer!</p>
      </div>

      <section>
        <h3 className="font-semibold">Progressive hints</h3>
        {assessment ? (
          <p className="mt-1 text-white/60">Hints are disabled during independent assessments.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-white/55">Each hint lowers this mission&apos;s independence score a little. Hint 3 is a guided demonstration.</p>
            <ol className="mt-2 grid gap-2">
              {mission.hints.slice(0, hintsUsed).map((h, i) => (
                <li key={i} className="whitespace-pre-line rounded-xl bg-sky/10 p-2">
                  <strong>Hint {i + 1}:</strong> {h}
                </li>
              ))}
            </ol>
            {hintsUsed < 3 && (
              <button
                className="btn btn-ghost mt-2 !py-1 text-sm"
                onClick={() => {
                  useHint(mission.id);
                  playSound("hint");
                }}
              >
                💡 Show hint {hintsUsed + 1}
              </button>
            )}
          </>
        )}
      </section>

      {!assessment && (
        <section>
          <h3 className="font-semibold">Code review</h3>
          <ul className="mt-1 grid gap-1">
            {review.map((n, i) => (
              <li key={i} className={n.tone === "warn" ? "text-sun" : n.tone === "tip" ? "text-sky" : "text-white/80"}>
                {n.tone === "warn" ? "⚠" : n.tone === "tip" ? "💡" : "ℹ"} {n.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {run?.error && (
        <section>
          <h3 className="font-semibold">About your last error</h3>
          <p className="mt-1 text-white/80">
            <strong>{run.error.type}</strong>: {explainError(run.error.type)}
          </p>
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <h3 className="font-semibold">Test results</h3>
          <ul className="mt-1 grid gap-1">
            {notes.map((n, i) => (
              <li key={i}>• {n.text}</li>
            ))}
          </ul>
        </section>
      )}

      {!assessment && (
        <section>
          <h3 className="font-semibold">Ask NOVA</h3>
          <p className="text-xs text-white/55">Sends your question and code (never your profile) to the AI tutor, if your server has it enabled.</p>
          {chat.map((c, i) => (
            <div key={i} className="mt-2 rounded-xl bg-white/5 p-2">
              <p className="text-white/60">You: {c.q}</p>
              <p className="mt-1 whitespace-pre-line">NOVA: {c.a}</p>
            </div>
          ))}
          <div className="mt-2 flex gap-2">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder="Why does my robot stop early?" aria-label="Question for NOVA" onKeyDown={(e) => e.key === "Enter" && ask()} />
            <button className="btn btn-primary !py-1" onClick={ask} disabled={asking || !q.trim()}>
              {asking ? "…" : "Ask"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function MissionNotebook({ mission }: { mission: MissionDef }) {
  const entry = useGame((s) => s.notebook[mission.id]);
  const updateNotes = useGame((s) => s.updateNotes);
  const updateDocumentation = useGame((s) => s.updateDocumentation);
  const allAttempts = useGame((s) => s.attempts);
  const attempts = allAttempts.filter((a) => a.missionId === mission.id);
  const [doc, setDoc] = useState<Documentation>(
    entry?.documentation ?? { objective: "", approach: "", testing: "", problems: "", results: "", improvements: "" },
  );
  const [saved, setSaved] = useState<string | null>(null);
  const issues = documentationIssues(doc);

  return (
    <div className="grid gap-4 text-sm">
      <label className="grid gap-1">
        <span className="font-semibold">My notes</span>
        <textarea
          className="field min-h-24"
          defaultValue={entry?.notes ?? ""}
          onBlur={(e) => updateNotes(mission.id, e.target.value)}
          placeholder="What did you try? What happened? What will you change next?"
        />
        <span className="text-xs text-white/50">Saved when you click away.</span>
      </label>

      {mission.requiresDocumentation && (
        <section className="grid gap-3 rounded-2xl bg-white/5 p-3">
          <h3 className="font-display text-lg font-semibold">Capstone engineering documentation</h3>
          {DOC_FIELDS.map((f) => (
            <label key={f.key} className="grid gap-1">
              <span className="font-semibold">{f.label}</span>
              <span className="text-xs text-white/55">{f.prompt}</span>
              <textarea className="field min-h-20" value={doc[f.key]} onChange={(e) => setDoc({ ...doc, [f.key]: e.target.value })} />
              <span className={`text-xs ${doc[f.key].trim().length >= f.min ? "text-mint" : "text-white/50"}`}>
                {doc[f.key].trim().length} / {f.min}+ characters
              </span>
            </label>
          ))}
          {issues.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-sun">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              const awards = updateDocumentation(mission.id, doc);
              setSaved(awards ? `Capstone complete! +${awards.xp} XP, +${awards.coins} 🪙` : "Documentation saved.");
              if (awards) playSound("success");
            }}
          >
            Save documentation
          </button>
          {saved && (
            <p className="text-mint" role="status">
              {saved}
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="font-semibold">Automatic test log</h3>
        {attempts.length === 0 ? (
          <p className="text-white/55">Every run is logged here automatically.</p>
        ) : (
          <ol className="mt-1 grid gap-1">
            {attempts
              .slice(-12)
              .reverse()
              .map((a) => (
                <li key={a.id} className="rounded-lg bg-white/5 p-2">
                  <span className="text-white/50">{new Date(a.at).toLocaleTimeString()}</span> · {a.summary}
                  {a.metrics && (
                    <span className="block text-xs text-white/55">
                      {a.metrics.time.toFixed(1)}s · {a.metrics.collisions} collisions · {a.metrics.safetyViolations} violations
                    </span>
                  )}
                </li>
              ))}
          </ol>
        )}
      </section>
    </div>
  );
}
