"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getMission } from "@/missions/missions";
import type { MissionReport } from "@/missions/evaluate";
import { validateDesign, type RobotDesign } from "@/robots/design";
import {
  applySubmission,
  checkPassiveAchievements,
  claimDaily,
  initialState,
  purchaseCosmetic,
  recordIntroduced,
  type Awards,
} from "./logic";
import type { Attempt, Documentation, Draft, Profile, SaveState, Settings } from "./types";

/**
 * Local-first persistence: progress lives in this browser's localStorage and is
 * never sent anywhere. A cloud adapter (Supabase) is an extension point — see
 * docs/ARCHITECTURE.md and supabase/schema.sql.
 */
export const SAVE_KEY = "roborealm-save-v1";
const MAX_ATTEMPTS = 300;

interface Actions {
  setProfile(p: Profile): void;
  introduce(missionId: string): void;
  useHint(missionId: string): number;
  saveDraft(missionId: string, d: Draft): void;
  recordAttempt(a: Attempt): void;
  submit(a: Attempt, report: MissionReport): Awards;
  saveDesign(d: RobotDesign): void;
  deleteDesign(id: string): void;
  setActiveRobot(id: string): void;
  buyCosmetic(id: string): void;
  updateNotes(missionId: string, notes: string): void;
  updateDocumentation(missionId: string, doc: Documentation): Awards | null;
  claimDaily(day: string): void;
  updateSettings(s: Partial<Settings>): void;
  resetAll(): void;
}

export type Store = SaveState & Actions;

const now = () => new Date().toISOString();

const data = (s: Store): SaveState => ({
  version: s.version,
  profile: s.profile,
  game: s.game,
  evidence: s.evidence,
  attempts: s.attempts,
  garage: s.garage,
  activeRobotId: s.activeRobotId,
  notebook: s.notebook,
  hints: s.hints,
  drafts: s.drafts,
  settings: s.settings,
});

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      const commit = (next: SaveState) => {
        const passive = checkPassiveAchievements(next);
        set(passive.state);
        return passive.granted;
      };
      return {
        ...initialState(),
        setProfile: (p) => set({ profile: p }),
        introduce: (id) => commit(recordIntroduced(data(get()), id, now())),
        useHint: (id) => {
          const n = Math.min(3, (get().hints[id] ?? 0) + 1);
          set({ hints: { ...get().hints, [id]: n } });
          return n;
        },
        saveDraft: (id, d) => set({ drafts: { ...get().drafts, [id]: d } }),
        recordAttempt: (a) => set({ attempts: [...get().attempts, a].slice(-MAX_ATTEMPTS) }),
        submit: (a, report) => {
          const s = data(get());
          const withAttempt = { ...s, attempts: [...s.attempts, a].slice(-MAX_ATTEMPTS) };
          const m = getMission(a.missionId)!;
          const { state, awards } = applySubmission(withAttempt, m, report, a.id, a.hintsUsed, now());
          commit(state);
          return awards;
        },
        saveDesign: (d) => {
          const check = validateDesign(d);
          if (!check.ok) throw new Error(check.errors.join(" "));
          const garage = get().garage.some((g) => g.id === d.id) ? get().garage.map((g) => (g.id === d.id ? d : g)) : [...get().garage, d];
          commit({ ...data(get()), garage });
        },
        deleteDesign: (id) => {
          const garage = get().garage.filter((g) => g.id !== id);
          if (!garage.length) return;
          set({ garage, activeRobotId: get().activeRobotId === id ? garage[0].id : get().activeRobotId });
        },
        setActiveRobot: (id) => set({ activeRobotId: id }),
        buyCosmetic: (id) => set(purchaseCosmetic(data(get()), id)),
        updateNotes: (missionId, notes) => {
          const prev = get().notebook[missionId];
          commit({
            ...data(get()),
            notebook: { ...get().notebook, [missionId]: { ...prev, missionId, notes, updatedAt: now() } },
          });
        },
        updateDocumentation: (missionId, documentation) => {
          const prev = get().notebook[missionId];
          const s: SaveState = {
            ...data(get()),
            notebook: { ...get().notebook, [missionId]: { ...prev, notes: prev?.notes ?? "", missionId, documentation, updatedAt: now() } },
          };
          // If a technically-passing capstone is waiting on documentation, complete it now.
          const m = getMission(missionId);
          const pending = [...s.attempts].reverse().find((a) => a.missionId === missionId && a.mode === "submit" && a.report?.passed);
          if (m?.requiresDocumentation && pending?.report && !s.game.completed[missionId]) {
            const { state, awards } = applySubmission(s, m, pending.report, pending.id, pending.hintsUsed, now());
            commit(state);
            return awards.needsDocumentation ? null : awards;
          }
          commit(s);
          return null;
        },
        claimDaily: (day) => set(claimDaily(data(get()), day)),
        updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
        resetAll: () => set(initialState()),
      };
    },
    {
      name: SAVE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => data(s as Store),
      merge: (persisted, current) => {
        const p = persisted as Partial<SaveState> | undefined;
        if (!p || p.version !== 1) return current;
        const base = initialState();
        return { ...current, ...base, ...p, game: { ...base.game, ...p.game }, settings: { ...base.settings, ...p.settings } };
      },
    },
  ),
);

export function activeDesign(s: SaveState): RobotDesign {
  return s.garage.find((g) => g.id === s.activeRobotId) ?? s.garage[0];
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
