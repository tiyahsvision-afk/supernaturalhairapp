"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Avatar } from "@/components/Avatar";
import { RobotPortrait } from "@/components/RobotArt";
import { playSound } from "@/components/sound";
import { COMPETENCIES } from "@/content/competencies";
import { struggles } from "@/content/nova";
import { getWorld } from "@/content/worlds";
import { MISSIONS } from "@/missions/missions";
import { KindBadge } from "@/components/ui";
import {
  ACHIEVEMENTS,
  levelInfo,
  MASTERY_LABEL,
  MASTERY_ORDER,
  masteryMap,
  nextMission,
  questForDay,
  titleForLevel,
} from "@/progress/logic";
import { activeDesign, useGame } from "@/progress/store";

export default function Hub() {
  const s = useGame();
  if (!s.profile) return null;
  const lvl = levelInfo(s.game.xp);
  const next = nextMission(s);
  const mastery = masteryMap(s);
  const active = COMPETENCIES.filter((c) => !c.planned);
  const counts = MASTERY_ORDER.slice(1).map((l) => ({ l, n: active.filter((c) => MASTERY_ORDER.indexOf(mastery[c.id]) >= MASTERY_ORDER.indexOf(l)).length }));
  const day = new Date().toISOString().slice(0, 10);
  const quest = questForDay(day);
  const qp = Math.min(quest.goal, quest.progress(s, day));
  const robot = activeDesign(s);
  const stuck = struggles(s.attempts);
  const assessmentsPassed = MISSIONS.filter((m) => (m.kind === "assessment" || m.kind === "capstone") && s.game.completed[m.id]).length;

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6">
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel relative overflow-hidden p-6">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-sky/20 blur-3xl" aria-hidden />
          <div className="flex flex-wrap items-center gap-5">
            <Avatar a={s.profile.avatar} size={110} title={`${s.profile.nickname}'s avatar`} />
            <div className="flex-1">
              <p className="text-white/60">Welcome back,</p>
              <h1 className="font-display text-4xl font-bold">{s.profile.nickname}</h1>
              <p className="mt-1 text-sm">
                Level {lvl.level} · <span className="text-lavender">{titleForLevel(lvl.level)}</span>{" "}
                <span className="text-white/50">(in-game rank, not a job credential)</span>
              </p>
              <div className="mt-2 h-3 max-w-md overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={lvl.into} aria-valuemax={lvl.needed} aria-label="XP progress">
                <div className="h-full bg-gradient-to-r from-lavender to-sky" style={{ width: `${lvl.progress * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/60">
                {lvl.into} / {lvl.needed} XP to level {lvl.level + 1} · 🪙 {s.game.coins} Robo Coins
              </p>
            </div>
            <Link href="/workshop" className="float hidden sm:block" aria-label={`Open the workshop to edit ${robot.name}`}>
              <RobotPortrait d={robot} size={130} />
            </Link>
          </div>
          {next ? (
            <div className="mt-6 rounded-3xl bg-gradient-to-r from-lavender/30 to-sky/20 p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="chip">Suggested next</span>
                <KindBadge kind={next.kind} />
                <span className="text-white/60">{getWorld(next.worldId)?.name}</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold">{next.title}</h2>
              <p className="mt-1 text-white/75">{next.objective}</p>
              <Link href={`/mission/${next.id}`} className="btn btn-go mt-4" onClick={() => playSound("click")}>
                Play mission ▶
              </Link>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-mint/15 p-5">
              <h2 className="font-display text-2xl font-bold">Pathway complete! 🏆</h2>
              <p className="mt-1 text-white/75">You finished every available mission. Export your portfolio, or replay missions to beat your best score.</p>
              <Link href="/portfolio" className="btn btn-go mt-3">
                Open portfolio
              </Link>
            </div>
          )}
        </motion.section>

        <section className="panel p-6" aria-labelledby="mastery-h">
          <div className="flex items-center justify-between">
            <h2 id="mastery-h" className="font-display text-xl font-bold">
              🛠️ Engineering mastery
            </h2>
            <Link href="/skills" className="text-sm text-sky underline-offset-4 hover:underline">
              Skill tree →
            </Link>
          </div>
          <p className="mt-1 text-sm text-white/60">Earned only by demonstrating skills. XP and coins never count here.</p>
          <ul className="mt-4 grid gap-3">
            {counts.map(({ l, n }) => (
              <li key={l}>
                <div className="flex justify-between text-sm">
                  <span>{MASTERY_LABEL[l]}</span>
                  <span className="text-white/60">
                    {n} / {active.length} skills
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-mint" style={{ width: `${(n / active.length) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Independent assessments passed: <strong>{assessmentsPassed}</strong>
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold">📅 Daily quest</h2>
          <p className="mt-1">{quest.title}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-sun" style={{ width: `${(qp / quest.goal) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-white/60">
            {qp} / {quest.goal} · reward 🪙 {quest.reward}
          </p>
          <button
            className="btn btn-primary mt-3 !py-1.5 text-sm"
            disabled={qp < quest.goal || !!s.game.dailyClaimed[day]}
            onClick={() => {
              s.claimDaily(day);
              playSound("coin");
            }}
          >
            {s.game.dailyClaimed[day] ? "Claimed ✔" : "Claim reward"}
          </button>
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold">🧭 NOVA recommends</h2>
          {stuck.length ? (
            <ul className="mt-2 grid gap-2 text-sm">
              {stuck.map((x) => (
                <li key={x.skillId}>
                  <strong>{x.name}</strong> — {x.fails} unsuccessful runs recently. {x.suggestion}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-white/70">No sticking points detected. Keep experimenting — mistakes are data!</p>
          )}
        </section>
        <section className="panel p-5">
          <h2 className="font-display text-lg font-bold">🏅 Achievements</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
              const got = s.game.achievements.includes(id);
              return (
                <li key={id} className={`chip ${got ? "bg-sun/20 text-sun" : "opacity-50"}`} title={a.description}>
                  <span aria-hidden>{got ? a.icon : "🔒"}</span> {a.name}
                  <span className="sr-only">{got ? "(earned)" : "(locked)"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
