"use client";

import { Link, usePathname, useRouter } from "@/components/nav";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { levelInfo, titleForLevel } from "@/progress/logic";
import { useGame } from "@/progress/store";
import { useHydrated } from "./useHydrated";

const NAV = [
  { href: "/hub", label: "Hub", icon: "🏠" },
  { href: "/map", label: "World Map", icon: "🗺️" },
  { href: "/workshop", label: "Workshop", icon: "🔧" },
  { href: "/skills", label: "Skills", icon: "🌳" },
  { href: "/notebook", label: "Notebook", icon: "📓" },
  { href: "/portfolio", label: "Portfolio", icon: "🎓" },
];

const PUBLIC = ["/", "/onboarding", "/educators", "/about"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const xp = useGame((s) => s.game.xp);
  const coins = useGame((s) => s.game.coins);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", settings.reducedMotion === "reduce");
    root.classList.toggle("full-motion", settings.reducedMotion === "full");
    root.classList.toggle("hc", settings.highContrast);
  }, [hydrated, settings]);

  useEffect(() => {
    if (hydrated && !profile && !PUBLIC.includes(path)) router.replace("/onboarding");
  }, [hydrated, profile, path, router]);

  const reduced = settings.reducedMotion === "reduce" ? "always" : settings.reducedMotion === "full" ? "never" : "user";

  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="font-display text-3xl font-bold tracking-wide">ROBOREALM</div>
          <div className="mt-2 text-sm text-white/60">Booting robot systems…</div>
        </div>
      </div>
    );
  }

  const lvl = levelInfo(xp);
  const showNav = !!profile && path !== "/onboarding";

  return (
    <MotionConfig reducedMotion={reduced}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 btn btn-primary">
        Skip to content
      </a>
      {showNav && (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2">
            <Link href="/hub" className="font-display text-xl font-bold tracking-wide">
              <span className="text-lavender">ROBO</span>
              <span className="text-sky">REALM</span>
            </Link>
            <nav aria-label="Main" className="ml-2 flex flex-1 gap-1 overflow-x-auto">
              {NAV.map((n) => {
                const active = path === n.href || path.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                      active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span aria-hidden>{n.icon}</span> {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-3">
              <div className="hidden min-w-40 sm:block" title={`${lvl.into} / ${lvl.needed} XP to next level`}>
                <div className="flex justify-between text-xs font-semibold">
                  <span>
                    Lv {lvl.level} · {titleForLevel(lvl.level)}
                  </span>
                  <span className="text-white/60">{xp} XP</span>
                </div>
                <div
                  className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Experience to next level"
                  aria-valuemin={0}
                  aria-valuemax={lvl.needed}
                  aria-valuenow={lvl.into}
                >
                  <div className="h-full rounded-full bg-gradient-to-r from-lavender to-sky" style={{ width: `${lvl.progress * 100}%` }} />
                </div>
              </div>
              <span className="chip bg-sun/20 text-sun" title="Robo Coins (cosmetics only)">
                <span aria-hidden>🪙</span> {coins}
                <span className="sr-only">Robo Coins</span>
              </span>
              <Link href="/settings" className="btn btn-ghost !px-3 !py-1.5" aria-label="Settings">
                ⚙️
              </Link>
            </div>
          </div>
        </header>
      )}
      <main id="main">{children}</main>
    </MotionConfig>
  );
}
