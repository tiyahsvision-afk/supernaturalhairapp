"use client";

import { Link } from "@/components/nav";
import { COMPETENCIES, type SkillCategory } from "@/content/competencies";
import { MISSIONS } from "@/missions/missions";
import { PageTitle } from "@/components/ui";
import { MASTERY_LABEL, masteryMap, type MasteryLevel } from "@/progress/logic";
import { useGame } from "@/progress/store";

const LEVEL_STYLE: Record<MasteryLevel, { icon: string; cls: string; fill: number }> = {
  none: { icon: "○", cls: "text-white/45", fill: 0 },
  introduced: { icon: "◔", cls: "text-sky", fill: 1 },
  practicing: { icon: "◑", cls: "text-lavender", fill: 2 },
  proficient: { icon: "◕", cls: "text-mint", fill: 3 },
  advanced: { icon: "●", cls: "text-sun", fill: 4 },
};

const title = (id: string) => MISSIONS.find((m) => m.id === id)?.title ?? id;

export default function Skills() {
  const s = useGame();
  const mastery = masteryMap(s);
  const categories = [...new Set(COMPETENCIES.map((c) => c.category))] as SkillCategory[];

  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6">
      <PageTitle
        title="Skill Tree"
        sub="Technical mastery is earned by demonstrating skills in the simulator. XP, levels and coins never count toward mastery."
      />
      <div className="panel mb-6 grid gap-2 p-4 text-sm sm:grid-cols-4">
        {(["introduced", "practicing", "proficient", "advanced"] as const).map((l) => (
          <div key={l}>
            <span className={`font-semibold ${LEVEL_STYLE[l].cls}`}>
              {LEVEL_STYLE[l].icon} {MASTERY_LABEL[l]}
            </span>
            <p className="text-white/60">
              {l === "introduced" && "You started a mission that teaches it."}
              {l === "practicing" && "You passed a guided mission using it."}
              {l === "proficient" && "You passed an independent demonstration: an assessment, the capstone, or a work order with zero hints and hidden tests."}
              {l === "advanced" && "Proficient, plus the capstone or an assessment score of 90+."}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-6">
        {categories.map((cat) => (
          <section key={cat} aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="mb-3 font-display text-xl font-bold">
              {cat}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {COMPETENCIES.filter((c) => c.category === cat).map((c) => {
                const lvl = mastery[c.id];
                const st = LEVEL_STYLE[lvl];
                const ev = s.evidence.filter((e) => e.skillId === c.id && e.kind !== "introduced");
                return (
                  <li key={c.id} className={`panel p-4 ${c.planned ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-white/50">{c.id}</span>
                        <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                      </div>
                      <span className={`chip ${st.cls}`}>
                        {c.planned ? "🔒 Planned" : `${st.icon} ${MASTERY_LABEL[lvl]}`}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1" aria-hidden>
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= st.fill ? "bg-mint" : "bg-white/10"}`} />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-white/75">{c.description}</p>
                    <dl className="mt-2 grid gap-1 text-xs">
                      {c.prerequisites.length > 0 && (
                        <div>
                          <dt className="inline text-white/50">Prerequisites: </dt>
                          <dd className="inline">{c.prerequisites.join(", ")}</dd>
                        </div>
                      )}
                      {c.practice.length > 0 && (
                        <div>
                          <dt className="inline text-white/50">Practice: </dt>
                          <dd className="inline">
                            {c.practice.map((id, i) => (
                              <span key={id}>
                                {i > 0 && ", "}
                                <Link className="text-sky hover:underline" href={`/mission/${id}`}>
                                  {title(id)}
                                </Link>
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                      {c.assessments.length > 0 && (
                        <div>
                          <dt className="inline text-white/50">Demonstrated in: </dt>
                          <dd className="inline">{c.assessments.map(title).join(", ")}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline text-white/50">Passing criteria: </dt>
                        <dd className="inline">{c.passingCriteria}</dd>
                      </div>
                    </dl>
                    {ev.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-white/70">Evidence ({ev.length})</summary>
                        <ul className="mt-1 grid gap-0.5">
                          {ev.slice(-6).map((e, i) => (
                            <li key={i}>
                              {new Date(e.at).toLocaleDateString()} · {title(e.missionId)} · {e.kind} · score {e.score} · hints {e.hintsUsed}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
