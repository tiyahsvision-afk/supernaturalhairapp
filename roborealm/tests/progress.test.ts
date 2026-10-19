import { describe, expect, it } from "vitest";
import { COMPETENCIES, getCompetency } from "@/content/competencies";
import { gradeMission } from "@/missions/evaluate";
import { getMission, MISSIONS } from "@/missions/missions";
import type { CriterionResult, ScenarioOutcome } from "@/missions/types";
import {
  applySubmission,
  claimDaily,
  documentationIssues,
  initialState,
  isMissionUnlocked,
  levelInfo,
  masteryFor,
  masteryMap,
  purchaseCosmetic,
  questForDay,
  recordIntroduced,
} from "@/progress/logic";
import type { Documentation } from "@/progress/types";

const NOW = "2026-10-19T12:00:00.000Z";
const outcome = (over: Partial<ScenarioOutcome["metrics"]> = {}): ScenarioOutcome => ({
  finalPose: { x: 0, y: 0, theta: 0 },
  items: [],
  carrying: null,
  events: [],
  metrics: { time: 10, distance: 1, collisions: 0, safetyViolations: 0, batteryUsedPct: 1, commands: 1, sensorReads: 0, ...over },
});
const crit = (passed: boolean): CriterionResult[] => [{ id: "x", label: "x", passed, detail: "" }];

function report(id: string, passed: boolean, opts: { collisions?: number; violations?: number; hints?: number } = {}) {
  const m = getMission(id)!;
  const scen = Array.from({ length: m.scenarioCount }, (_, i) => ({
    name: `s${i}`,
    outcome: outcome({ collisions: opts.collisions ?? 0, safetyViolations: opts.violations ?? 0 }),
    criteria: crit(passed),
  }));
  const code = "for i in range(4):\n    pass\n";
  return gradeMission(m, scen, code, opts.hints ?? 0);
}

describe("grading", () => {
  it("a safety violation fails the mission even if every criterion passed", () => {
    const r = report("m1-wake-up", true, { violations: 1 });
    expect(r.passed).toBe(false);
    expect(r.safetyGateFailed).toBe(true);
    expect(r.rubric.safety).toBe(0);
  });

  it("assessments require the minimum hidden passes", () => {
    const m = getMission("a1-precision-movement")!;
    const scen = [true, true, true, false, false].map((p, i) => ({ name: `s${i}`, outcome: outcome(), criteria: crit(p) }));
    const r = gradeMission(m, scen, "", 0);
    expect(r.hiddenPassed).toBe(2);
    expect(r.passed).toBe(false);
    const scen2 = [false, true, true, true, false].map((p, i) => ({ name: `s${i}`, outcome: outcome(), criteria: crit(p) }));
    expect(gradeMission(m, scen2, "", 0).passed).toBe(true);
  });

  it("hints reduce the independence score on guided missions", () => {
    expect(report("m1-wake-up", true, { hints: 0 }).rubric.independence).toBe(15);
    expect(report("m1-wake-up", true, { hints: 2 }).rubric.independence).toBe(5);
  });

  it("a failed mission scores below 60", () => {
    expect(report("m1-wake-up", false).score).toBeLessThan(60);
  });
});

describe("XP and rewards", () => {
  it("awards XP and coins once, with a no-hint bonus", () => {
    const m = getMission("m1-wake-up")!;
    const r = report(m.id, true);
    const first = applySubmission(initialState(), m, r, "a1", 0, NOW);
    expect(first.awards.xp).toBe(120);
    expect(first.awards.coins).toBe(20);
    expect(first.awards.firstClear).toBe(true);
    const again = applySubmission(first.state, m, r, "a2", 0, NOW);
    expect(again.awards.xp).toBe(0);
    expect(again.state.game.xp).toBe(120);
  });

  it("failed submissions award nothing", () => {
    const m = getMission("m1-wake-up")!;
    const res = applySubmission(initialState(), m, report(m.id, false), "a1", 0, NOW);
    expect(res.state.game.xp).toBe(0);
    expect(res.state.evidence).toHaveLength(0);
  });

  it("levels follow the XP curve", () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100).level).toBe(2);
    expect(levelInfo(300).level).toBe(3);
  });

  it("coins only buy cosmetics, never mastery or functional parts", () => {
    const s = { ...initialState(), game: { ...initialState().game, coins: 500 } };
    const bought = purchaseCosmetic(s, "paint-peach");
    expect(bought.game.coins).toBe(460);
    expect(bought.game.ownedCosmetics).toContain("paint-peach");
    expect(() => purchaseCosmetic(s, "lidar-point")).toThrow();
    expect(masteryMap(bought)).toEqual(masteryMap(s));
  });

  it("daily quests pay out once when complete", () => {
    const day = "2026-10-19";
    const q = questForDay(day);
    let s = initialState();
    expect(claimDaily(s, day)).toBe(s);
    s = {
      ...s,
      attempts: Array.from({ length: 5 }, (_, i) => ({
        id: `t${i}`, missionId: "m1-wake-up", at: `${day}T10:00:00Z`, mode: "submit" as const, editor: "python" as const,
        code: "", robot: s.garage[0], hintsUsed: 0, passed: false, summary: "",
      })),
      notebook: { m: { missionId: "m", notes: "note", updatedAt: `${day}T10:00:00Z` } },
    };
    const claimed = claimDaily(s, day);
    expect(claimed.game.coins).toBe(q.reward);
    expect(claimDaily(claimed, day).game.coins).toBe(q.reward);
  });
});

describe("competency mastery", () => {
  it("every mission skill exists in the catalogue and every active skill has an independent assessment", () => {
    for (const m of MISSIONS) for (const id of m.skills) expect(getCompetency(id), id).toBeDefined();
    for (const c of COMPETENCIES.filter((c) => !c.planned)) expect(c.assessments.length, c.id).toBeGreaterThan(0);
  });

  it("progresses Introduced → Practicing → Proficient → Advanced only through evidence", () => {
    let s = initialState();
    const skill = getCompetency("PRG-101")!;
    expect(masteryFor(skill, s.evidence)).toBe("none");
    s = recordIntroduced(s, "m1-wake-up", NOW);
    expect(masteryFor(skill, s.evidence)).toBe("introduced");
    s = applySubmission(s, getMission("m1-wake-up")!, report("m1-wake-up", true), "a", 0, NOW).state;
    expect(masteryFor(skill, s.evidence)).toBe("practicing");
    const a1 = getMission("a1-precision-movement")!;
    const r = report(a1.id, true);
    s = applySubmission(s, a1, { ...r, score: 85 }, "b", 0, NOW).state;
    expect(masteryFor(skill, s.evidence)).toBe("proficient");
    s = applySubmission(s, a1, { ...r, score: 95 }, "c", 0, NOW).state;
    expect(masteryFor(skill, s.evidence)).toBe("advanced");
  });

  it("XP alone never grants mastery", () => {
    const s = { ...initialState(), game: { ...initialState().game, xp: 99999 } };
    expect(Object.values(masteryMap(s)).every((l) => l === "none")).toBe(true);
  });

  it("debug missions count as independent only without hints", () => {
    const m = getMission("m5-work-order-007")!;
    const sk = getCompetency("SEN-102")!;
    const withHints = applySubmission(initialState(), m, report(m.id, true, { hints: 2 }), "a", 2, NOW).state;
    expect(masteryFor(sk, withHints.evidence)).toBe("practicing");
    const noHints = applySubmission(initialState(), m, report(m.id, true), "a", 0, NOW).state;
    expect(masteryFor(sk, noHints.evidence)).toBe("proficient");
  });
});

describe("capstone documentation", () => {
  const goodDoc: Documentation = {
    objective: "Deliver a package autonomously across a changing warehouse without any collisions.",
    approach:
      "The rover uses a front ultrasonic sensor and a claw. My program asks the planner for a path, drives each leg in short re-aimed steps, and checks the sensor before every step so unmapped boxes are reported and avoided.",
    testing: "I ran the practice warehouse twelve times and logged time, collisions and battery use after each change.",
    problems: "The robot drifted off course in realistic physics, so I re-aim toward the waypoint before every short step.",
    results: "Practice layout delivered in 61 seconds with zero collisions and zero safety violations.",
    improvements: "Next I would smooth the turns and add a side sensor so the robot can pass obstacles faster.",
  };

  it("validates documentation deterministically", () => {
    expect(documentationIssues(undefined)).toHaveLength(6);
    expect(documentationIssues(goodDoc)).toEqual([]);
    expect(documentationIssues({ ...goodDoc, approach: "word ".repeat(40) })).toHaveLength(1);
  });

  it("capstone completion requires documentation", () => {
    const m = getMission("cap-autonomous-delivery")!;
    const r = report(m.id, true);
    const without = applySubmission(initialState(), m, r, "a", 0, NOW);
    expect(without.awards.needsDocumentation).toBe(true);
    expect(without.state.game.completed[m.id]).toBeUndefined();
    const s = { ...initialState(), notebook: { [m.id]: { missionId: m.id, notes: "", documentation: goodDoc, updatedAt: NOW } } };
    const withDoc = applySubmission(s, m, r, "a", 0, NOW);
    expect(withDoc.state.game.completed[m.id]).toBeDefined();
    expect(masteryFor(getCompetency("COM-101")!, withDoc.state.evidence)).toBe("advanced");
  });
});

describe("unlocks and placement", () => {
  it("missions unlock in order; experienced players may take assessments directly", () => {
    const s = initialState();
    expect(isMissionUnlocked(s, getMission("m1-wake-up")!)).toBe(true);
    expect(isMissionUnlocked(s, getMission("m2-plaza-patrol")!)).toBe(false);
    expect(isMissionUnlocked(s, getMission("a1-precision-movement")!)).toBe(false);
    const exp = { ...s, profile: { nickname: "x", ageBand: "18-24" as const, avatar: {} as never, companionName: "b", experience: "experienced" as const, createdAt: NOW } };
    expect(isMissionUnlocked(exp, getMission("a1-precision-movement")!)).toBe(true);
    expect(isMissionUnlocked(exp, getMission("cap-autonomous-delivery")!)).toBe(false);
  });
});
