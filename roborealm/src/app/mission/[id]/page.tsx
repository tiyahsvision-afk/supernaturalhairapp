import { MISSIONS } from "@/missions/missions";
import { MissionView } from "./MissionView";

export function generateStaticParams() {
  return MISSIONS.map((m) => ({ id: m.id }));
}

export default function MissionPage() {
  return <MissionView />;
}
