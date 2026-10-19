"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Frame } from "@/engine/types";
import { getMission } from "@/missions/missions";
import type { MissionReport } from "@/missions/evaluate";
import type { EditorMode } from "@/missions/types";
import { deriveSpec, meetsRequirements, paintColor } from "@/robots/design";
import { python, type PythonStatus } from "@/runtime/client";
import type { ScenarioRun } from "@/runtime/missionRunner";
import { getWorld } from "@/content/worlds";
import { SimCanvas } from "@/components/SimCanvas";
import { KindBadge } from "@/components/ui";
import { playSound } from "@/components/sound";
import { activeDesign, newId, useGame } from "@/progress/store";
import type { Attempt } from "@/progress/types";
import type { Awards } from "@/progress/logic";
import { MissionSidebar } from "./Sidebar";
import { ResultsModal } from "./Results";
import { ConsolePanel, Inspector } from "./Panels";

const BlocklyEditor = dynamic(() => import("@/components/BlocklyEditor").then((m) => m.BlocklyEditor), {
  ssr: false,
  loading: () => <div className="grid h-[420px] place-items-center text-white/60">Loading blocks…</div>,
});
const CodeEditor = dynamic(() => import("@/components/CodeEditor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <div className="grid h-[420px] place-items-center text-white/60">Loading code editor…</div>,
});

const SPEEDS = [0.5, 1, 2, 4];

export default function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const mission = getMission(id);
  const s = useGame();
  const design = activeDesign(s);
  const spec = useMemo(() => deriveSpec(design), [design]);
  const missing = mission ? meetsRequirements(spec, mission.requires) : [];
  const draft = mission ? s.drafts[mission.id] : undefined;

  const [mode, setMode] = useState<EditorMode>(draft?.editor && mission?.editors.includes(draft.editor) ? draft.editor : (mission?.editors[0] ?? "python"));
  const [pyCode, setPyCode] = useState<string>(draft?.python ?? mission?.starterPython ?? "");
  const [blockState, setBlockState] = useState<object | undefined>(draft?.blocks ?? mission?.starterBlocks);
  const [blockCode, setBlockCode] = useState("");
  const [orphans, setOrphans] = useState(0);
  const [status, setStatus] = useState<PythonStatus>("idle");
  const [run, setRun] = useState<ScenarioRun | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState<"test" | "submit" | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<{ report: MissionReport; runs: ScenarioRun[]; awards: Awards } | null>(null);
  const [showResults, setShowResults] = useState(false);

  const code = mode === "blocks" ? blockCode : pyCode;
  const introduce = s.introduce;
  const saveDraft = s.saveDraft;

  useEffect(() => {
    if (mission) introduce(mission.id);
    python().warmup();
    return python().onStatus(setStatus);
  }, [mission, introduce]);

  // Persist the draft (debounced) so students can resume later.
  useEffect(() => {
    if (!mission) return;
    const t = setTimeout(() => saveDraft(mission.id, { editor: mode, python: pyCode, blocks: blockState }), 400);
    return () => clearTimeout(t);
  }, [mission, mode, pyCode, blockState, saveDraft]);

  const preview = useMemo(() => (mission ? mission.buildScenario(0, spec) : null), [mission, spec]);
  const viewScenario = useMemo(() => (mission && run ? mission.buildScenario(run.index, spec) : preview), [mission, run, spec, preview]);

  const startFrame: Frame | null = preview
    ? {
        t: 0,
        x: preview.start.x,
        y: preview.start.y,
        theta: preview.start.theta,
        wl: 0,
        wr: 0,
        battery: 1,
        carrying: null,
        items: preview.world.items.map((i) => ({ id: i.id, x: i.x, y: i.y })),
      }
    : null;
  const frames = run?.frames ?? [];
  const frame = frames.length ? frames[Math.min(frames.length - 1, Math.floor(frameIdx))] : startFrame;
  const trail = useMemo(() => frames.slice(0, Math.floor(frameIdx) + 1).filter((_, i) => i % 3 === 0), [frames, frameIdx]);
  const stepIdx = run ? findStep(run, frameIdx) : -1;
  const step = run && stepIdx >= 0 ? run.trace[stepIdx] : null;

  // Playback loop: replays the frames the engine computed.
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing || !frames.length) return;
    let raf = 0;
    const tick = (ts: number) => {
      const dt = last.current === null ? 0 : (ts - last.current) / 1000;
      last.current = ts;
      setFrameIdx((f) => {
        const n = f + (dt / 0.02) * speed;
        if (n >= frames.length - 1) {
          setPlaying(false);
          return frames.length - 1;
        }
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, frames.length, speed]);

  const record = useCallback(
    (mode2: "test" | "submit", r: ScenarioRun | null, passed: boolean, summary: string, report?: MissionReport): Attempt => ({
      id: newId("att"),
      missionId: mission!.id,
      at: new Date().toISOString(),
      mode: mode2,
      editor: mode,
      code,
      robot: design,
      hintsUsed: s.hints[mission!.id] ?? 0,
      passed,
      score: report?.score,
      summary,
      error: r?.error ?? undefined,
      metrics: r?.metrics,
      report,
    }),
    [mission, mode, code, design, s.hints],
  );

  if (!mission || !preview || !frame || !viewScenario) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <p>Mission not found.</p>
        <Link href="/map" className="btn btn-primary mt-4">
          Back to map
        </Link>
      </div>
    );
  }

  const hintsUsed = s.hints[mission.id] ?? 0;
  const world = getWorld(mission.worldId);
  const canRun = !missing.length && !busy && code.trim().length > 0;

  const doTest = async () => {
    if (!canRun) return;
    setBusy("test");
    setRunError(null);
    setPlaying(false);
    playSound("click");
    try {
      const r = await python().test(mission.id, design, code, 0);
      setRun(r);
      setFrameIdx(0);
      setPlaying(true);
      const passed = r.criteria.every((c) => c.passed);
      s.recordAttempt(record("test", r, passed, `Practice run: ${r.criteria.filter((c) => c.passed).length}/${r.criteria.length} criteria${r.error ? ` · ${r.error.type}` : ""}`));
    } catch (e) {
      setRunError((e as Error).message);
      playSound("fail");
    } finally {
      setBusy(null);
    }
  };

  const doSubmit = async () => {
    if (!canRun) return;
    setBusy("submit");
    setRunError(null);
    setPlaying(false);
    try {
      const res = await python().submit(mission.id, design, code, hintsUsed);
      const attempt = record("submit", res.runs[0], res.report.passed, `Submitted: ${res.report.passed ? "PASSED" : "not passed"} · score ${res.report.score}/100`, res.report);
      const awards = s.submit(attempt, res.report);
      setSubmission({ ...res, awards });
      setShowResults(true);
      setRun(res.runs[0]);
      setFrameIdx(0);
      playSound(res.report.passed ? "success" : "fail");
    } catch (e) {
      setRunError((e as Error).message);
      playSound("fail");
    } finally {
      setBusy(null);
    }
  };

  const gotoStep = (i: number) => {
    if (!run || !run.trace.length) return;
    const k = Math.max(0, Math.min(run.trace.length - 1, i));
    setPlaying(false);
    setFrameIdx(run.trace[k].frame1);
  };

  const switchMode = (m: EditorMode) => {
    if (m === mode) return;
    if (m === "python" && mode === "blocks" && blockCode.trim()) {
      if (window.confirm("Copy the Python generated from your blocks into the Python editor? (Your current Python text will be replaced.)")) {
        setPyCode(blockCode.replace(/^# Generated from blocks\n/, ""));
      }
    }
    setMode(m);
  };

  return (
    <div className="mx-auto max-w-[1700px] px-3 py-4 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/map" className="btn btn-ghost !px-3 !py-1 text-sm">
          ← Map
        </Link>
        <span className="text-sm text-white/60">
          {world?.emoji} {world?.name}
        </span>
        <KindBadge kind={mission.kind} />
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{mission.title}</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_minmax(0,1fr)]">
        <MissionSidebar mission={mission} code={code} run={run} submission={submission?.report ?? null} hintsUsed={hintsUsed} />

        <section className="grid min-w-0 content-start gap-3" aria-label="Simulation">
          {missing.length > 0 && (
            <div className="rounded-2xl bg-peach/15 p-4 text-peach" role="alert">
              Your robot <strong>{design.name}</strong> is missing {missing.join(" and ")}.{" "}
              <Link href="/workshop" className="underline">
                Open the Workshop
              </Link>{" "}
              to add it.
            </div>
          )}
          <div className="panel p-3">
            <SimCanvas world={viewScenario.world} spec={spec} color={paintColor(design)} frame={frame} trail={trail} />
            <div className="mt-2 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Simulation controls">
              <button className="btn btn-go" onClick={doTest} disabled={!canRun} title="Run on the practice scenario (Ctrl+Enter)">
                {busy === "test" ? "Running…" : "▶ Run"}
              </button>
              <button className="btn btn-ghost" onClick={() => setPlaying((p) => !p)} disabled={!frames.length}>
                {playing ? "⏸ Pause" : "⏵ Play"}
              </button>
              <button className="btn btn-ghost" onClick={() => gotoStep(stepIdx - 1)} disabled={!run?.trace.length} aria-label="Previous command">
                ⏮
              </button>
              <button className="btn btn-ghost" onClick={() => gotoStep(stepIdx + 1)} disabled={!run?.trace.length} aria-label="Next command">
                ⏭
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (busy) python().stop();
                  setPlaying(false);
                }}
                aria-label="Stop"
              >
                ⏹
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPlaying(false);
                  setRun(null);
                  setFrameIdx(0);
                }}
              >
                ↺ Reset
              </button>
              <label className="ml-auto flex items-center gap-1 text-sm">
                Speed
                <select className="field !w-auto !py-1" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                  {SPEEDS.map((v) => (
                    <option key={v} value={v}>
                      {v}×
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {frames.length > 1 && (
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={Math.floor(frameIdx)}
                onChange={(e) => {
                  setPlaying(false);
                  setFrameIdx(Number(e.target.value));
                }}
                className="mt-2 w-full accent-lavender"
                aria-label="Timeline"
              />
            )}
            <p className="mt-1 text-xs text-white/50" aria-live="polite">
              {status === "loading" && "Loading the Python engine (first time only)…"}
              {status === "running" && "Simulating…"}
              {run && `Showing: ${run.scenarioName}. The engine runs your whole program first, then replays it here.`}
            </p>
          </div>
          <Inspector run={run} step={step} stepIdx={stepIdx} />
          <ConsolePanel run={run} frameT={frame.t} runError={runError} diagnostics={!!mission.diagnostics} />
        </section>

        <section className="grid min-w-0 content-start gap-3" aria-label="Program">
          <div className="flex flex-wrap items-center gap-2">
            {mission.editors.length > 1 &&
              (["blocks", "python"] as const)
                .filter((m) => mission.editors.includes(m))
                .map((m) => (
                  <button key={m} className={`btn !py-1.5 ${mode === m ? "btn-primary" : "btn-ghost"}`} aria-pressed={mode === m} onClick={() => switchMode(m)}>
                    {m === "blocks" ? "🧩 Blocks" : "🐍 Python"}
                  </button>
                ))}
            <button className="btn btn-primary ml-auto" onClick={doSubmit} disabled={!canRun}>
              {busy === "submit" ? "Testing…" : mission.kind === "guided" || mission.kind === "debug" ? "✅ Submit for grading" : "📝 Submit for assessment"}
            </button>
          </div>
          <div className="h-[460px]" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && doTest()}>
            {mode === "blocks" ? (
              <BlocklyEditor
                initial={blockState ?? { blocks: { languageVersion: 0, blocks: [{ type: "rr_start", x: 30, y: 30 }] } }}
                onChange={(st, c, o) => {
                  setBlockState(st);
                  setBlockCode(c);
                  setOrphans(o);
                }}
              />
            ) : (
              <CodeEditor value={pyCode} onChange={setPyCode} activeLine={step?.line ?? null} errorLine={run?.error?.line ?? null} />
            )}
          </div>
          {mode === "blocks" && (
            <details className="panel p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">🐍 Python generated from your blocks</summary>
              {orphans > 0 && (
                <p className="mt-2 text-sm text-sun">
                  ⚠ {orphans} block group(s) aren&apos;t attached to “▶ when program starts” and won&apos;t run.
                </p>
              )}
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-ink/70 p-3 text-sm">{blockCode}</pre>
            </details>
          )}
          <p className="text-xs text-white/50">
            Tip: Ctrl/⌘ + Enter runs the practice scenario. {mission.scenarioCount > 1 && `Submitting also runs ${mission.scenarioCount - 1} hidden test(s).`}
          </p>
          <button
            className="btn btn-ghost !py-1 text-sm"
            onClick={() => {
              if (window.confirm("Reset the program to the mission's starter code?")) {
                setPyCode(mission.starterPython);
                setBlockState(mission.starterBlocks);
              }
            }}
          >
            Restore starter code
          </button>
        </section>
      </div>

      {submission && (
        <ResultsModal
          open={showResults}
          onClose={() => setShowResults(false)}
          mission={mission}
          report={submission.report}
          runs={submission.runs}
          awards={submission.awards}
          onReplay={(r) => {
            setRun(r);
            setFrameIdx(0);
            setPlaying(true);
            setShowResults(false);
          }}
        />
      )}
    </div>
  );
}

function findStep(run: ScenarioRun, frameIdx: number): number {
  let k = -1;
  for (let i = 0; i < run.trace.length; i++) {
    if (run.trace[i].frame0 <= frameIdx) k = i;
    else break;
  }
  return k;
}
