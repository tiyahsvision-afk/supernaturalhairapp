/**
 * Pure progression rules. Two deliberately separate systems:
 *   GAME progression  — XP, levels, Robo Coins, achievements, cosmetics.
 *   TECHNICAL mastery — evidence of demonstrated skill; never purchasable, never granted by XP.
 */
import { COMPETENCIES, type Competency } from "@/content/competencies";
import { getMission, MISSIONS } from "@/missions/missions";
import type { MissionReport } from "@/missions/evaluate";
import type { MissionDef } from "@/missions/types";
import { ACCESSORIES, PAINTS } from "@/robots/components";
import { starterDesign } from "@/robots/design";
import type { Documentation, Evidence, EvidenceKind, SaveState } from "./types";

export const FREE_COSMETICS = [...PAINTS, ...ACCESSORIES].filter((c) => !c.price).map((c) => c.id);

export function initialState(): SaveState {
  return {
    version: 1,
    profile: null,
    game: { xp: 0, coins: 0, achievements: [], ownedCosmetics: [...FREE_COSMETICS], completed: {}, dailyClaimed: {} },
    evidence: [],
    attempts: [],
    garage: [starterDesign()],
    activeRobotId: "robot-1",
    notebook: {},
    hints: {},
    drafts: {},
    settings: { reducedMotion: "system", sound: true, streaks: false, highContrast: false },
  };
}

// ---------------------------------------------------------------- levels

/** Total XP needed to reach `level` (level 1 = 0 XP). */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, needed: next - base, progress: (xp - base) / (next - base) };
}

export const GAME_TITLES = ["Apprentice", "Junior Technician", "Technician", "Specialist", "Senior Specialist", "Advanced Engineer"];
/** In-game rank title. Game proficiency only — not an employment credential. */
export const titleForLevel = (level: number) => GAME_TITLES[Math.min(GAME_TITLES.length - 1, Math.floor((level - 1) / 2))];

// ---------------------------------------------------------------- unlocks

export function isMissionUnlocked(s: SaveState, m: MissionDef): boolean {
  if (m.unlockAfter.every((id) => s.game.completed[id])) return true;
  // Placement: experienced players may attempt independent assessments directly.
  return s.profile?.experience === "experienced" && m.kind === "assessment";
}

export function nextMission(s: SaveState): MissionDef | undefined {
  return [...MISSIONS].sort((a, b) => a.order - b.order).find((m) => !s.game.completed[m.id] && isMissionUnlocked(s, m));
}

// ---------------------------------------------------------------- documentation

export const DOC_FIELDS: { key: keyof Documentation; label: string; prompt: string; min: number }[] = [
  { key: "objective", label: "Objective", prompt: "What problem does your robot solve? What does success look like?", min: 40 },
  { key: "approach", label: "Design & approach", prompt: "Describe your robot's components and how your program works (planning, sensing, gripping).", min: 120 },
  { key: "testing", label: "Testing", prompt: "How did you test it? Which scenarios and what measurements?", min: 60 },
  { key: "problems", label: "Problems & debugging", prompt: "What went wrong along the way and how did you fix it?", min: 60 },
  { key: "results", label: "Results", prompt: "How did it perform? Include numbers (time, collisions, hidden tests passed).", min: 40 },
  { key: "improvements", label: "Lessons & improvements", prompt: "What would you improve with more time? What did you learn?", min: 40 },
];

export function documentationIssues(doc: Documentation | undefined): string[] {
  const issues: string[] = [];
  for (const f of DOC_FIELDS) {
    const text = (doc?.[f.key] ?? "").trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (text.length < f.min) issues.push(`${f.label}: write at least ${f.min} characters (currently ${text.length}).`);
    else if (new Set(words.map((w) => w.toLowerCase())).size < Math.min(8, words.length)) {
      issues.push(`${f.label}: use real sentences, not repeated words.`);
    }
  }
  return issues;
}

// ---------------------------------------------------------------- evidence & mastery

export type MasteryLevel = "none" | "introduced" | "practicing" | "proficient" | "advanced";
export const MASTERY_ORDER: MasteryLevel[] = ["none", "introduced", "practicing", "proficient", "advanced"];
export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  none: "Not started",
  introduced: "Introduced",
  practicing: "Practicing",
  proficient: "Proficient",
  advanced: "Advanced",
};

export function evidenceKindFor(m: MissionDef, hintsUsed: number): EvidenceKind {
  if (m.kind === "assessment") return "assessment";
  if (m.kind === "capstone") return "capstone";
  if (m.kind === "debug" && hintsUsed === 0) return "independent";
  return "practice";
}

/**
 * Mastery comes only from evidence:
 *  Introduced  — opened a mission that teaches it
 *  Practicing  — passed a guided mission for it
 *  Proficient  — passed an independent demonstration listed for the skill
 *                (assessment, capstone, or a debug mission with hidden tests and zero hints)
 *  Advanced    — proficient AND (capstone demonstration OR an assessment scored ≥ 90)
 */
export function masteryFor(skill: Competency, evidence: Evidence[]): MasteryLevel {
  const ev = evidence.filter((e) => e.skillId === skill.id);
  if (!ev.length) return "none";
  const independent = ev.filter(
    (e) => (e.kind === "assessment" || e.kind === "capstone" || e.kind === "independent") && skill.assessments.includes(e.missionId),
  );
  if (independent.length) {
    const advanced = independent.some((e) => e.kind === "capstone" || (e.kind === "assessment" && e.score >= 90));
    return advanced ? "advanced" : "proficient";
  }
  if (ev.some((e) => e.kind !== "introduced")) return "practicing";
  return "introduced";
}

export function masteryMap(s: SaveState): Record<string, MasteryLevel> {
  return Object.fromEntries(COMPETENCIES.map((c) => [c.id, masteryFor(c, s.evidence)]));
}

export function recordIntroduced(s: SaveState, missionId: string, now: string): SaveState {
  const m = getMission(missionId);
  if (!m) return s;
  const add = m.skills
    .filter((id) => !s.evidence.some((e) => e.skillId === id && e.missionId === missionId && e.kind === "introduced"))
    .map((skillId): Evidence => ({ skillId, missionId, kind: "introduced", score: 0, hintsUsed: 0, at: now }));
  return add.length ? { ...s, evidence: [...s.evidence, ...add] } : s;
}

// ---------------------------------------------------------------- rewards

export interface Awards {
  xp: number;
  coins: number;
  achievements: string[];
  firstClear: boolean;
  needsDocumentation: boolean;
}

export const ACHIEVEMENTS: Record<string, { name: string; description: string; icon: string }> = {
  "first-steps": { name: "First Steps", description: "Pass your first mission.", icon: "👣" },
  "loop-de-loop": { name: "Loop-de-Loop", description: "Pass Plaza Patrol using a loop.", icon: "🔁" },
  "no-hints": { name: "Self-Reliant", description: "Pass a guided mission without using hints.", icon: "🧭" },
  "bug-hunter": { name: "Bug Hunter", description: "Repair Work Order #007.", icon: "🐞" },
  "hidden-hero": { name: "Hidden Hero", description: "Pass every hidden test in an assessment.", icon: "🕵️" },
  "safety-champion": { name: "Safety Champion", description: "Complete the capstone with zero collisions and zero safety violations.", icon: "🦺" },
  "notebook-keeper": { name: "Notebook Keeper", description: "Write notes in 3 notebook entries.", icon: "📓" },
  "garage-tinkerer": { name: "Garage Tinkerer", description: "Save 2 different robot designs.", icon: "🛠️" },
};

function grantAchievements(s: SaveState, ids: string[]): { state: SaveState; granted: string[] } {
  const granted = ids.filter((id) => !s.game.achievements.includes(id));
  if (!granted.length) return { state: s, granted };
  return { state: { ...s, game: { ...s.game, achievements: [...s.game.achievements, ...granted] } }, granted };
}

export function checkPassiveAchievements(s: SaveState): { state: SaveState; granted: string[] } {
  const ids: string[] = [];
  if (Object.values(s.notebook).filter((n) => n.notes.trim().length >= 10).length >= 3) ids.push("notebook-keeper");
  if (s.garage.length >= 2) ids.push("garage-tinkerer");
  return grantAchievements(s, ids);
}

/**
 * Apply a graded submission. XP/coins are awarded once per mission (no farming);
 * evidence is recorded for every passing submission.
 */
export function applySubmission(
  s: SaveState,
  m: MissionDef,
  report: MissionReport,
  attemptId: string,
  hintsUsed: number,
  now: string,
): { state: SaveState; awards: Awards } {
  const awards: Awards = { xp: 0, coins: 0, achievements: [], firstClear: false, needsDocumentation: false };
  if (!report.passed) return { state: s, awards };

  if (m.requiresDocumentation && documentationIssues(s.notebook[m.id]?.documentation).length) {
    awards.needsDocumentation = true;
    return { state: s, awards };
  }

  let state = s;
  const kind = evidenceKindFor(m, hintsUsed);
  const evidence: Evidence[] = m.skills.map((skillId) => ({ skillId, missionId: m.id, kind, score: report.score, hintsUsed, at: now, attemptId }));
  state = { ...state, evidence: [...state.evidence, ...evidence] };

  const prev = state.game.completed[m.id];
  if (!prev) {
    awards.firstClear = true;
    awards.xp = m.rewards.xp + (hintsUsed === 0 && m.kind !== "assessment" && m.kind !== "capstone" ? Math.round(m.rewards.xp * 0.2) : 0);
    awards.coins = m.rewards.coins;
  }
  const completed = {
    ...state.game.completed,
    [m.id]: prev && prev.bestScore >= report.score ? prev : { at: prev?.at ?? now, bestScore: report.score, attemptId },
  };
  state = { ...state, game: { ...state.game, xp: state.game.xp + awards.xp, coins: state.game.coins + awards.coins, completed } };

  const ach: string[] = ["first-steps"];
  if (m.id === "m2-plaza-patrol") ach.push("loop-de-loop");
  if (hintsUsed === 0 && (m.kind === "guided" || m.kind === "debug")) ach.push("no-hints");
  if (m.id === "m5-work-order-007") ach.push("bug-hunter");
  if (m.kind === "assessment" && report.hiddenPassed === report.hiddenTotal) ach.push("hidden-hero");
  if (m.kind === "capstone" && report.scenarios.every((r) => r.metrics.collisions === 0 && r.metrics.safetyViolations === 0)) {
    ach.push("safety-champion");
  }
  const g = grantAchievements(state, ach);
  awards.achievements = g.granted;
  return { state: g.state, awards };
}

export function purchaseCosmetic(s: SaveState, id: string): SaveState {
  const item = [...PAINTS, ...ACCESSORIES].find((c) => c.id === id);
  if (!item || !item.price) throw new Error("Only cosmetic items can be bought with Robo Coins.");
  if (s.game.ownedCosmetics.includes(id)) return s;
  if (s.game.coins < item.price) throw new Error("Not enough Robo Coins.");
  return { ...s, game: { ...s.game, coins: s.game.coins - item.price, ownedCosmetics: [...s.game.ownedCosmetics, id] } };
}

// ---------------------------------------------------------------- daily quest

export interface DailyQuest {
  id: string;
  title: string;
  goal: number;
  reward: number;
  progress: (s: SaveState, day: string) => number;
}

const QUESTS: DailyQuest[] = [
  { id: "runs", title: "Run 5 simulations", goal: 5, reward: 15, progress: (s, d) => s.attempts.filter((a) => a.at.startsWith(d)).length },
  { id: "notes", title: "Write a notebook note", goal: 1, reward: 15, progress: (s, d) => Object.values(s.notebook).filter((n) => n.updatedAt.startsWith(d) && n.notes.trim()).length },
  { id: "submit", title: "Submit a mission for grading", goal: 1, reward: 15, progress: (s, d) => s.attempts.filter((a) => a.mode === "submit" && a.at.startsWith(d)).length },
];

export function questForDay(day: string): DailyQuest {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return QUESTS[h % QUESTS.length];
}

export function claimDaily(s: SaveState, day: string): SaveState {
  const q = questForDay(day);
  if (s.game.dailyClaimed[day] || q.progress(s, day) < q.goal) return s;
  return { ...s, game: { ...s.game, coins: s.game.coins + q.reward, dailyClaimed: { ...s.game.dailyClaimed, [day]: true } } };
}
