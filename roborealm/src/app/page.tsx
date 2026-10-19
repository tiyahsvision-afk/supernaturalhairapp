"use client";

import { STATIC, usePathname } from "@/components/nav";
import { Landing } from "./Landing";
import Educators from "./educators/page";
import Hub from "./hub/page";
import WorldMap from "./map/page";
import { MissionView } from "./mission/[id]/MissionView";
import Notebook from "./notebook/page";
import Onboarding from "./onboarding/page";
import Portfolio from "./portfolio/page";
import SettingsPage from "./settings/page";
import Skills from "./skills/page";
import Workshop from "./workshop/page";

const ROUTES: Record<string, () => React.ReactNode> = {
  "/onboarding": Onboarding,
  "/hub": Hub,
  "/map": WorldMap,
  "/workshop": Workshop,
  "/skills": Skills,
  "/notebook": Notebook,
  "/portfolio": Portfolio,
  "/settings": SettingsPage,
  "/educators": Educators,
};

/** In the single-file static build every screen is served from this page via the URL hash. */
function StaticRoutes() {
  const path = usePathname();
  if (path.startsWith("/mission/")) return <MissionView key={path} />;
  const Page = ROUTES[path];
  return Page ? <Page key={path} /> : <Landing />;
}

export default function Home() {
  return STATIC ? <StaticRoutes /> : <Landing />;
}
