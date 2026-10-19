import type { Pose, RobotSpec, SimEvent, SimMetrics, Vec2, WorldDef } from "@/engine/types";
import type { RobotRequirements } from "@/robots/design";

export type MissionKind = "guided" | "debug" | "assessment" | "capstone";
export type EditorMode = "blocks" | "python";

/** Facts about the scenario that the program may query through the `world` API. */
export interface ScenarioInfo {
  target?: Vec2;
  waypoints?: Vec2[];
  package?: string;
  dropoff?: string;
  /** Free-form values used by the evaluator only (never exposed to student code). */
  hidden?: Record<string, number | string>;
}

export interface BuiltScenario {
  name: string;
  world: WorldDef;
  start: Pose;
  info: ScenarioInfo;
  /** Hardware faults injected for troubleshooting missions. */
  faults?: { sensorBias?: Record<string, number>; motorPolarity?: RobotSpec["motorPolarity"] };
}

export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

/** What happened when a program ran in one scenario — the evaluator's only input. */
export interface ScenarioOutcome {
  finalPose: Pose;
  items: { id: string; x: number; y: number }[];
  carrying: string | null;
  events: SimEvent[];
  metrics: SimMetrics;
  /** Error that stopped the program early, if any. */
  error?: { type: string; message: string; line?: number | null };
}

export interface LessonCard {
  title: string;
  body: string;
  /** Optional small code or formula sample. */
  code?: string;
}

export interface MissionDef {
  id: string;
  worldId: string;
  order: number;
  title: string;
  kind: MissionKind;
  /** Editors this mission allows; the first is the default. */
  editors: EditorMode[];
  story: string;
  objective: string;
  successCriteria: string[];
  lesson: LessonCard[];
  skills: string[];
  rewards: { xp: number; coins: number };
  requires?: RobotRequirements;
  unlockAfter: string[];
  starterPython: string;
  /** Blockly XML/JSON serialization for the starter blocks, if blocks are allowed. */
  starterBlocks?: object;
  hints: [string, string, string];
  timeLimit: number;
  /** Scenario 0 is the visible practice scenario; the rest are hidden test scenarios. */
  scenarioCount: number;
  buildScenario: (index: number, spec: RobotSpec) => BuiltScenario;
  /** Deterministic per-scenario grading. */
  evaluate: (outcome: ScenarioOutcome, scenario: BuiltScenario, spec: RobotSpec) => CriterionResult[];
  /** Minimum number of hidden scenarios that must pass (defaults to all). */
  minHiddenPasses?: number;
  /** Show sensor ground-truth comparison in the diagnostics panel. */
  diagnostics?: boolean;
  /** Extra static checks on the program text (e.g. "uses a loop"). */
  codeChecks?: { id: string; label: string; test: (code: string) => boolean }[];
  /** Par time in seconds used for the efficiency score. */
  parTime: number;
  /** Capstone: documentation is required to complete. */
  requiresDocumentation?: boolean;
}
