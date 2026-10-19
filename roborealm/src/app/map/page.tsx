"use client";

import { Link } from "@/components/nav";
import { motion } from "motion/react";
import { useState } from "react";
import { CAREER_LINKS } from "@/content/nova";
import { WORLDS } from "@/content/worlds";
import { MISSIONS } from "@/missions/missions";
import { KindBadge, PageTitle } from "@/components/ui";
import { isMissionUnlocked } from "@/progress/logic";
import { useGame } from "@/progress/store";

export default function WorldMap() {
  const s = useGame();
  const [sel, setSel] = useState(WORLDS[0].id);
  const world = WORLDS.find((w) => w.id === sel)!;
  const missions = MISSIONS.filter((m) => m.worldId === sel).sort((a, b) => a.order - b.order);
  const worldUnlocked = (id: string) => MISSIONS.some((m) => m.worldId === id && isMissionUnlocked(s, m));

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6">
      <PageTitle title="World Map" sub="Eight worlds, one journey. Choose a world to see its missions." />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel relative aspect-[16/10] overflow-hidden" role="group" aria-label="Map of worlds">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <radialGradient id="sea" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#0b1437" />
              </radialGradient>
            </defs>
            <rect width="100" height="100" fill="url(#sea)" />
            <polyline
              points={WORLDS.map((w) => `${w.map.x},${w.map.y}`).join(" ")}
              fill="none"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.5"
            />
          </svg>
          {WORLDS.map((w, i) => {
            const open = w.status === "playable" && worldUnlocked(w.id);
            const done = MISSIONS.filter((m) => m.worldId === w.id).every((m) => s.game.completed[m.id]) && w.status === "playable";
            return (
              <motion.button
                key={w.id}
                onClick={() => setSel(w.id)}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full text-center ${sel === w.id ? "z-10" : ""}`}
                style={{ left: `${w.map.x}%`, top: `${w.map.y}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05, type: "spring" }}
                whileHover={{ scale: 1.08 }}
                aria-pressed={sel === w.id}
                aria-label={`${w.name}: ${w.theme}. ${w.status === "planned" ? "Coming soon" : open ? (done ? "Completed" : "Open") : "Locked"}`}
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full text-2xl shadow-lg sm:h-20 sm:w-20 sm:text-4xl ${sel === w.id ? "ring-4 ring-white" : ""}`}
                  style={{ background: w.status === "planned" ? "#334155" : w.color, opacity: open || w.status === "planned" ? 1 : 0.55 }}
                >
                  {w.status === "planned" ? "🔒" : w.emoji}
                </span>
                <span className="mt-1 block whitespace-nowrap text-[10px] font-semibold sm:text-xs">
                  {w.index}. {w.name} {done ? "✔" : ""}
                </span>
              </motion.button>
            );
          })}
        </div>
        <section className="panel p-5" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden>
              {world.emoji}
            </span>
            <div>
              <h2 className="font-display text-2xl font-bold">{world.name}</h2>
              <p className="text-white/70">{world.theme}</p>
            </div>
          </div>
          {CAREER_LINKS[world.id] && <p className="mt-3 rounded-2xl bg-white/5 p-3 text-sm text-white/75">💼 {CAREER_LINKS[world.id]}</p>}
          {world.status === "planned" ? (
            <p className="mt-4 text-white/70">
              This world is planned for a future update. Its competencies are already in the skill tree so you can see what&apos;s coming.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {missions.map((m) => {
                const unlocked = isMissionUnlocked(s, m);
                const done = s.game.completed[m.id];
                return (
                  <li key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindBadge kind={m.kind} />
                      {done && <span className="chip bg-mint/20 text-mint">✔ Best {done.bestScore}/100</span>}
                    </div>
                    <h3 className="mt-2 font-display text-lg font-semibold">{m.title}</h3>
                    <p className="text-sm text-white/70">{m.objective}</p>
                    {unlocked ? (
                      <Link href={`/mission/${m.id}`} className="btn btn-primary mt-3 !py-1.5 text-sm">
                        {done ? "Replay" : "Start"} ▶
                      </Link>
                    ) : (
                      <p className="mt-3 text-sm text-white/55">
                        🔒 Complete:{" "}
                        {m.unlockAfter
                          .filter((id) => !s.game.completed[id])
                          .map((id) => MISSIONS.find((x) => x.id === id)?.title)
                          .join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
