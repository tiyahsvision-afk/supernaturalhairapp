import { inflate, pointInRect } from "./geometry";
import { isPathClear } from "./sim";
import type { Rect, Vec2, WorldDef } from "./types";

/**
 * Occupancy grid + A* planner. This plays the role of a warehouse management
 * system's global planner: it only knows MAPPED obstacles, restricted zones and
 * anything the robot has reported. Unmapped obstacles must be found with sensors.
 */
export interface OccupancyGrid {
  cell: number;
  cols: number;
  rows: number;
  /** blocked[row][col]; row 0 is the bottom (y = 0). */
  blocked: boolean[][];
}

export function buildGrid(world: WorldDef, clearance: number, extra: Rect[] = [], cell = 0.1): OccupancyGrid {
  const cols = Math.round(world.width / cell);
  const rows = Math.round(world.height / cell);
  const blockers = [
    ...world.obstacles.filter((o) => !o.unmapped),
    ...world.zones.filter((z) => z.kind === "hazard").map((z) => z.rect),
    ...extra,
  ].map((r) => inflate(r, clearance));
  const blocked: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const p = { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
      const outside =
        p.x < clearance || p.y < clearance || p.x > world.width - clearance || p.y > world.height - clearance;
      row.push(outside || blockers.some((b) => pointInRect(p, b)));
    }
    blocked.push(row);
  }
  return { cell, cols, rows, blocked };
}

const key = (c: number, r: number) => r * 10000 + c;

export function planPath(
  world: WorldDef,
  from: Vec2,
  to: Vec2,
  clearance: number,
  extra: Rect[] = [],
): Vec2[] {
  const g = buildGrid(world, clearance, extra);
  const toCell = (p: Vec2) => ({
    c: Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell))),
    r: Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell))),
  });
  const s = toCell(from);
  let goal = toCell(to);
  if (g.blocked[goal.r][goal.c]) {
    // Snap the goal to the nearest free cell (e.g. a package placed near a shelf).
    let best: { c: number; r: number } | null = null;
    let bestD = Infinity;
    for (let r = 0; r < g.rows; r++)
      for (let c = 0; c < g.cols; c++)
        if (!g.blocked[r][c]) {
          const d = (c - goal.c) ** 2 + (r - goal.r) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { c, r };
          }
        }
    if (!best || bestD > 9) return [];
    goal = best;
  }

  const open = new Map<number, { c: number; r: number; g: number; f: number }>();
  const came = new Map<number, number>();
  const gScore = new Map<number, number>();
  const h = (c: number, r: number) => Math.hypot(c - goal.c, r - goal.r);
  open.set(key(s.c, s.r), { ...s, g: 0, f: h(s.c, s.r) });
  gScore.set(key(s.c, s.r), 0);
  const closed = new Set<number>();
  let found = false;
  while (open.size) {
    let curK = -1;
    let cur: { c: number; r: number; g: number; f: number } | undefined;
    for (const [k, n] of open) if (!cur || n.f < cur.f || (n.f === cur.f && k < curK)) [cur, curK] = [n, k];
    open.delete(curK);
    if (cur!.c === goal.c && cur!.r === goal.r) {
      found = true;
      break;
    }
    closed.add(curK);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = cur!.c + dc;
        const nr = cur!.r + dr;
        if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || g.blocked[nr][nc]) continue;
        if (dr && dc && (g.blocked[cur!.r][nc] || g.blocked[nr][cur!.c])) continue; // no corner cutting
        const nk = key(nc, nr);
        if (closed.has(nk)) continue;
        const ng = cur!.g + Math.hypot(dc, dr);
        if (ng < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, ng);
          came.set(nk, curK);
          open.set(nk, { c: nc, r: nr, g: ng, f: ng + h(nc, nr) });
        }
      }
  }
  if (!found) return [];

  const cells: Vec2[] = [];
  let k = key(goal.c, goal.r);
  while (k !== key(s.c, s.r)) {
    const c = k % 10000;
    const r = Math.floor(k / 10000);
    cells.push({ x: (c + 0.5) * g.cell, y: (r + 0.5) * g.cell });
    k = came.get(k)!;
  }
  cells.reverse();
  if (cells.length) cells[cells.length - 1] = { ...to };
  else cells.push({ ...to });

  // Line-of-sight smoothing: keep only the waypoints needed to stay clear.
  const blockersWorld: WorldDef = {
    ...world,
    obstacles: [...world.obstacles, ...extra.map((r, i) => ({ ...r, id: `reported-${i}` }))],
  };
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !isPathClear(blockersWorld, anchor, cells[j], clearance * 0.9)) j--;
    out.push(cells[j]);
    anchor = cells[j];
    i = j + 1;
  }
  return out.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }));
}
