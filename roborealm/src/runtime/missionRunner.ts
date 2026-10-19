import type { RobotSpec } from "@/engine/types";
import { gradeMission, type MissionReport } from "@/missions/evaluate";
import type { CriterionResult, MissionDef } from "@/missions/types";
import { meetsRequirements } from "@/robots/design";
import { runProgram, type PyodideLike, type RunResult } from "./runner";

export interface ScenarioRun extends RunResult {
  index: number;
  hidden: boolean;
  criteria: CriterionResult[];
}

const seedFor = (missionId: string, index: number) => {
  let h = 2166136261;
  for (const ch of `${missionId}#${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

export function runScenario(
  py: PyodideLike,
  mission: MissionDef,
  spec: RobotSpec,
  code: string,
  index: number,
  recordFrames = true,
): ScenarioRun {
  const missing = meetsRequirements(spec, mission.requires);
  if (missing.length) {
    throw new Error(`This mission needs ${missing.join(" and ")}. Update your robot in the Workshop.`);
  }
  const scenario = mission.buildScenario(index, spec);
  const res = runProgram(py, {
    code,
    scenario,
    spec,
    seed: seedFor(mission.id, index),
    timeLimit: mission.timeLimit,
    recordFrames,
  });
  return { ...res, index, hidden: index > 0, criteria: mission.evaluate(res.outcome, scenario, spec) };
}

/** Hidden-scenario layouts in assessments stay secret: no replay frames are returned for them. */
export function revealsHidden(mission: MissionDef) {
  return mission.kind === "guided" || mission.kind === "debug";
}

export function submitMission(
  py: PyodideLike,
  mission: MissionDef,
  spec: RobotSpec,
  code: string,
  hintsUsed: number,
): { report: MissionReport; runs: ScenarioRun[] } {
  const runs: ScenarioRun[] = [];
  for (let i = 0; i < mission.scenarioCount; i++) {
    const run = runScenario(py, mission, spec, code, i, i === 0 || revealsHidden(mission));
    if (run.hidden && !revealsHidden(mission)) {
      run.events = [];
      run.trace = [];
      run.output = [];
    }
    runs.push(run);
  }
  const report = gradeMission(
    mission,
    runs.map((r) => ({ name: r.scenarioName, outcome: r.outcome, criteria: r.criteria })),
    code,
    hintsUsed,
  );
  // Outcome events were only needed for grading; drop them from hidden runs we are not revealing.
  for (const r of runs) if (r.hidden && !revealsHidden(mission)) r.outcome = { ...r.outcome, events: [] };
  return { report, runs };
}
