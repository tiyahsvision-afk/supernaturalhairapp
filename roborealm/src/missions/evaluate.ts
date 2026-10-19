import type { SimMetrics } from "@/engine/types";
import type { CriterionResult, MissionDef, ScenarioOutcome } from "./types";

export interface ScenarioReport {
  index: number;
  name: string;
  hidden: boolean;
  passed: boolean;
  criteria: CriterionResult[];
  metrics: SimMetrics;
}

export interface Rubric {
  correctness: number; // /50
  safety: number; // /20
  efficiency: number; // /15
  independence: number; // /15
}

export interface MissionReport {
  missionId: string;
  passed: boolean;
  score: number;
  rubric: Rubric;
  scenarios: ScenarioReport[];
  codeChecks: CriterionResult[];
  hiddenPassed: number;
  hiddenTotal: number;
  hiddenRequired: number;
  safetyGateFailed: boolean;
  feedback: string[];
}

/**
 * Deterministic grading. The UI never decides success — it only displays this report.
 */
export function gradeMission(
  mission: MissionDef,
  scenarios: { name: string; outcome: ScenarioOutcome; criteria: CriterionResult[] }[],
  code: string,
  hintsUsed: number,
): MissionReport {
  const reports: ScenarioReport[] = scenarios.map((s, index) => ({
    index,
    name: s.name,
    hidden: index > 0,
    passed: s.criteria.every((c) => c.passed),
    criteria: s.criteria,
    metrics: s.outcome.metrics,
  }));
  const codeChecks: CriterionResult[] = (mission.codeChecks ?? []).map((c) => {
    const passed = c.test(code);
    return { id: c.id, label: c.label, passed, detail: passed ? "Requirement met." : "Requirement not met yet." };
  });

  const hidden = reports.filter((r) => r.hidden);
  const hiddenPassed = hidden.filter((r) => r.passed).length;
  const hiddenRequired = mission.minHiddenPasses ?? hidden.length;
  const practicePassed = reports[0]?.passed ?? false;
  const totalViolations = reports.reduce((n, r) => n + r.metrics.safetyViolations, 0);
  const totalCollisions = reports.reduce((n, r) => n + r.metrics.collisions, 0);
  const safetyGateFailed = totalViolations > 0;

  const scenariosOk =
    reports.length === scenarios.length &&
    (hidden.length === 0 ? practicePassed : hiddenPassed >= hiddenRequired && (mission.minHiddenPasses !== undefined || practicePassed));
  const passed = scenariosOk && codeChecks.every((c) => c.passed) && !safetyGateFailed;

  const passedReports = reports.filter((r) => r.passed);
  const correctness = Math.round((50 * passedReports.length) / Math.max(1, reports.length));
  const safety = safetyGateFailed ? 0 : Math.max(0, 20 - 5 * totalCollisions);
  const efficiency = passedReports.length
    ? Math.round(
        (15 * passedReports.reduce((s, r) => s + Math.min(1, mission.parTime / Math.max(r.metrics.time, 0.01)), 0)) /
          passedReports.length,
      )
    : 0;
  const independence = mission.kind === "assessment" || mission.kind === "capstone" ? 15 : Math.max(0, 15 - 5 * hintsUsed);
  const rubric = { correctness, safety, efficiency, independence };
  const score = passed ? correctness + safety + efficiency + independence : Math.min(59, correctness + safety + efficiency + independence);

  const feedback: string[] = [];
  if (safetyGateFailed) {
    feedback.push(
      `Safety first: the robot entered a restricted area ${totalViolations} time(s). A mission with a safety violation never passes, even if the task was completed.`,
    );
  }
  for (const r of reports) {
    const failed = r.criteria.filter((c) => !c.passed);
    if (failed.length) {
      feedback.push(`${r.name}: ${failed.map((c) => `${c.label} — ${c.detail}`).join(" ")}`);
    }
  }
  for (const c of codeChecks) if (!c.passed) feedback.push(`Code requirement: ${c.label}.`);
  if (hidden.length && hiddenPassed < hiddenRequired) {
    feedback.push(
      `Passed ${hiddenPassed} of ${hidden.length} hidden tests (need ${hiddenRequired}). Hidden tests use situations you haven't seen — make sure your program reacts to sensors and world data instead of fixed numbers.`,
    );
  }
  if (passed) {
    feedback.unshift(
      totalCollisions
        ? "Mission passed. Tip: you still had collisions in some tests — a more cautious approach would make the robot more reliable."
        : "Mission passed with a clean run. Nice engineering!",
    );
  }
  return {
    missionId: mission.id,
    passed,
    score,
    rubric,
    scenarios: reports,
    codeChecks,
    hiddenPassed,
    hiddenTotal: hidden.length,
    hiddenRequired,
    safetyGateFailed,
    feedback,
  };
}
