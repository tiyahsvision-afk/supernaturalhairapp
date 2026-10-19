"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { download, PageTitle } from "@/components/ui";
import { SAVE_KEY, useGame } from "@/progress/store";

export default function SettingsPage() {
  const s = useGame();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const set = s.updateSettings;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageTitle title="Settings & privacy" />
      <section className="panel grid gap-5 p-6">
        <fieldset>
          <legend className="font-semibold">Motion</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["system", "Follow my device"],
                ["reduce", "Reduce motion"],
                ["full", "Full animation"],
              ] as const
            ).map(([v, l]) => (
              <button key={v} className={`btn ${s.settings.reducedMotion === v ? "btn-primary" : "btn-ghost"}`} aria-pressed={s.settings.reducedMotion === v} onClick={() => set({ reducedMotion: v })}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm text-white/60">Reduced motion turns off decorative animation. Robot replays still show movement because they are the content.</p>
        </fieldset>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-lavender" checked={s.settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
          <span>
            <span className="font-semibold">Sound effects</span>
            <span className="block text-sm text-white/60">Short beeps for feedback. Every sound also has a visual message.</span>
          </span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-lavender" checked={s.settings.highContrast} onChange={(e) => set({ highContrast: e.target.checked })} />
          <span>
            <span className="font-semibold">High contrast</span>
            <span className="block text-sm text-white/60">Stronger borders and solid backgrounds.</span>
          </span>
        </label>
      </section>

      <section className="panel mt-5 grid gap-4 p-6">
        <h2 className="font-display text-xl font-bold">Your data</h2>
        <p className="text-sm text-white/70">
          ROBOREALM stores your call sign, age band, avatar, robots, code and progress <strong>only in this browser</strong> (localStorage key{" "}
          <code>{SAVE_KEY}</code>). Nothing is uploaded, shared or published. If your school enables NOVA chat, only your question, the mission and your
          code are sent to the tutor — never your profile.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => download("roborealm-save.json", localStorage.getItem(SAVE_KEY) ?? "{}", "application/json")}
          >
            ⬇ Export my save
          </button>
          <label className="btn btn-ghost cursor-pointer">
            ⬆ Import save
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text());
                  if (parsed?.state?.version !== 1) throw new Error("Not a ROBOREALM save file.");
                  localStorage.setItem(SAVE_KEY, JSON.stringify(parsed));
                  await useGame.persist.rehydrate();
                  setMsg("Save imported.");
                } catch (err) {
                  setMsg((err as Error).message);
                }
              }}
            />
          </label>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm("Delete ALL ROBOREALM data from this browser? This cannot be undone.")) {
                s.resetAll();
                localStorage.removeItem(SAVE_KEY);
                router.replace("/");
              }
            }}
          >
            Delete all my data
          </button>
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>
    </div>
  );
}
