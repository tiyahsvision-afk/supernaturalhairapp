export interface WorldInfo {
  id: string;
  index: number;
  name: string;
  theme: string;
  color: string;
  /** Position on the world map, in % of the map area. */
  map: { x: number; y: number };
  status: "playable" | "planned";
  emoji: string;
}

export const WORLDS: WorldInfo[] = [
  { id: "robot-beginnings", index: 1, name: "Robot Beginnings", theme: "Components and movement", color: "#A78BFA", map: { x: 14, y: 70 }, status: "playable", emoji: "🔧" },
  { id: "code-city", index: 2, name: "Code City", theme: "Programming fundamentals", color: "#7DD3FC", map: { x: 32, y: 42 }, status: "playable", emoji: "🏙️" },
  { id: "sensor-jungle", index: 3, name: "Sensor Jungle", theme: "Sensors and awareness", color: "#6EE7B7", map: { x: 52, y: 70 }, status: "playable", emoji: "🌿" },
  { id: "circuit-island", index: 4, name: "Circuit Island", theme: "Electronics", color: "#FDE68A", map: { x: 70, y: 28 }, status: "planned", emoji: "⚡" },
  { id: "ai-academy", index: 5, name: "AI Academy", theme: "Machine learning", color: "#FDBA9A", map: { x: 86, y: 52 }, status: "planned", emoji: "🧠" },
  { id: "autonomous-arena", index: 6, name: "Autonomous Arena", theme: "Navigation and decisions", color: "#F472B6", map: { x: 66, y: 86 }, status: "playable", emoji: "🏁" },
  { id: "factory-frontier", index: 7, name: "Factory Frontier", theme: "Industrial automation", color: "#93C5FD", map: { x: 45, y: 16 }, status: "planned", emoji: "🏭" },
  { id: "inventors-universe", index: 8, name: "Inventor's Universe", theme: "Open-ended engineering", color: "#C4B5FD", map: { x: 88, y: 14 }, status: "planned", emoji: "🚀" },
];

export const getWorld = (id: string) => WORLDS.find((w) => w.id === id);
