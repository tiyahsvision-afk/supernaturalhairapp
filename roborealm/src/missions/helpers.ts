import { circleIntersectsRect, dist, pointInRect } from "@/engine/geometry";
import type { Obstacle, Rect, Vec2, WorldDef, Zone } from "@/engine/types";
import type { CriterionResult, ScenarioOutcome } from "./types";

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function zoneAround(id: string, kind: Zone["kind"], c: Vec2, size: number, label?: string): Zone {
  return { id, kind, rect: rect(c.x - size / 2, c.y - size / 2, size, size), label };
}

export function obstacle(id: string, x: number, y: number, w: number, h: number, extra: Partial<Obstacle> = {}): Obstacle {
  return { id, x, y, w, h, ...extra };
}

export function world(width: number, height: number, parts: Partial<WorldDef> = {}): WorldDef {
  return { width, height, obstacles: [], zones: [], items: [], physics: "simplified", ...parts };
}

export const zoneCenter = (z: Zone): Vec2 => ({ x: z.rect.x + z.rect.w / 2, y: z.rect.y + z.rect.h / 2 });

export function zoneById(w: WorldDef, id: string): Zone {
  const z = w.zones.find((z) => z.id === id);
  if (!z) throw new Error(`zone ${id} missing`);
  return z;
}

// ---------------------------------------------------------------- shared criteria

export function noCollisions(o: ScenarioOutcome): CriterionResult {
  return {
    id: "no-collisions",
    label: "No collisions",
    passed: o.metrics.collisions === 0,
    detail: o.metrics.collisions === 0 ? "Clean run — never touched an obstacle." : `${o.metrics.collisions} collision(s) recorded.`,
  };
}

export function noSafetyViolations(o: ScenarioOutcome): CriterionResult {
  return {
    id: "safety",
    label: "Stayed out of restricted areas",
    passed: o.metrics.safetyViolations === 0,
    detail:
      o.metrics.safetyViolations === 0
        ? "No safety violations."
        : `${o.metrics.safetyViolations} entry(ies) into a restricted area. In a real facility this is a stop-work event.`,
  };
}

export function programFinished(o: ScenarioOutcome): CriterionResult {
  return {
    id: "finished",
    label: "Program ran to completion",
    passed: !o.error,
    detail: o.error ? `${o.error.type}: ${o.error.message}` : "Finished without errors.",
  };
}

export function endedInZone(o: ScenarioOutcome, z: Zone, label: string): CriterionResult {
  const inside = pointInRect(o.finalPose, z.rect);
  const c = zoneCenter(z);
  return {
    id: `in-${z.id}`,
    label,
    passed: inside,
    detail: inside
      ? `Robot finished inside ${z.label ?? z.id}.`
      : `Robot finished ${dist(o.finalPose, c).toFixed(2)} m from the centre of ${z.label ?? z.id}.`,
  };
}

export function visitedZones(o: ScenarioOutcome, zones: Zone[], label: string): CriterionResult {
  const entered = new Set(
    o.events.filter((e) => e.type === "zone_enter").map((e) => (e.data as { zone: string }).zone),
  );
  const missing = zones.filter((z) => !entered.has(z.id));
  return {
    id: "visited",
    label,
    passed: missing.length === 0,
    detail: missing.length ? `Missed: ${missing.map((z) => z.label ?? z.id).join(", ")}.` : "Visited every checkpoint.",
  };
}

/** Were the zones entered in the given order (each one after the previous)? */
export function visitedInOrder(o: ScenarioOutcome, zones: Zone[]): CriterionResult {
  let idx = 0;
  for (const e of o.events) {
    if (e.type === "zone_enter" && idx < zones.length && (e.data as { zone: string }).zone === zones[idx].id) idx++;
  }
  return {
    id: "order",
    label: "Waypoints reached in order",
    passed: idx === zones.length,
    detail: idx === zones.length ? "All waypoints reached in the right order." : `Reached ${idx} of ${zones.length} waypoints in order.`,
  };
}

export function itemDelivered(o: ScenarioOutcome, itemId: string, zone: Zone): CriterionResult {
  const item = o.items.find((i) => i.id === itemId);
  const ok = !!item && o.carrying !== itemId && pointInRect(item, zone.rect);
  return {
    id: "delivered",
    label: "Package delivered to the drop-off",
    passed: ok,
    detail: ok
      ? "Package released inside the drop-off zone."
      : o.carrying === itemId
        ? "The robot is still holding the package."
        : item
          ? `Package is ${dist(item, zoneCenter(zone)).toFixed(2)} m from the drop-off centre.`
          : "Package not found.",
  };
}

export function overlapsAny(p: Vec2, r: number, rects: Rect[]) {
  return rects.some((q) => circleIntersectsRect(p, r, q));
}

export const usesLoop = (code: string) => /^\s*(for|while)\b/m.test(stripComments(code));

export function stripComments(code: string) {
  return code
    .split("\n")
    .map((l) => l.replace(/#.*$/, ""))
    .join("\n");
}
