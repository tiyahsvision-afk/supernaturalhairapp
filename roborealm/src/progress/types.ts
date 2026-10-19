import type { SimMetrics } from "@/engine/types";
import type { MissionReport } from "@/missions/evaluate";
import type { EditorMode } from "@/missions/types";
import type { RobotDesign } from "@/robots/design";

export type AgeBand = "13-15" | "16-17" | "18-24";

export interface AvatarConfig {
  skin: string;
  hair: "short" | "curly" | "long" | "buns" | "shaved";
  hairColor: string;
  outfit: string;
  accessory: "none" | "goggles" | "headset" | "cap";
}

export interface Profile {
  nickname: string;
  ageBand: AgeBand;
  avatar: AvatarConfig;
  companionName: string;
  experience: "new" | "some" | "experienced";
  createdAt: string;
}

export interface Attempt {
  id: string;
  missionId: string;
  at: string;
  mode: "test" | "submit";
  editor: EditorMode;
  code: string;
  robot: RobotDesign;
  hintsUsed: number;
  passed: boolean;
  score?: number;
  /** One-line summary for the notebook log. */
  summary: string;
  error?: { type: string; message: string; line: number | null };
  metrics?: SimMetrics;
  report?: MissionReport;
}

export type EvidenceKind = "introduced" | "practice" | "independent" | "assessment" | "capstone";

export interface Evidence {
  skillId: string;
  missionId: string;
  kind: EvidenceKind;
  score: number;
  hintsUsed: number;
  at: string;
  attemptId?: string;
}

export interface Documentation {
  objective: string;
  approach: string;
  testing: string;
  problems: string;
  results: string;
  improvements: string;
}

export interface NotebookEntry {
  missionId: string;
  notes: string;
  documentation?: Documentation;
  updatedAt: string;
}

export interface GameState {
  xp: number;
  coins: number;
  achievements: string[];
  ownedCosmetics: string[];
  completed: Record<string, { at: string; bestScore: number; attemptId: string }>;
  dailyClaimed: Record<string, boolean>;
}

export interface Settings {
  reducedMotion: "system" | "reduce" | "full";
  sound: boolean;
  streaks: boolean;
  highContrast: boolean;
}

export interface Draft {
  editor: EditorMode;
  python?: string;
  blocks?: object;
}

export interface SaveState {
  version: 1;
  profile: Profile | null;
  game: GameState;
  evidence: Evidence[];
  attempts: Attempt[];
  garage: RobotDesign[];
  activeRobotId: string;
  notebook: Record<string, NotebookEntry>;
  hints: Record<string, number>;
  drafts: Record<string, Draft>;
  settings: Settings;
}
