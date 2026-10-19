import type { Rect, Vec2 } from "./types";

export const TAU = Math.PI * 2;

export function normalizeAngle(a: number): number {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r <= -Math.PI) r += TAU;
  return r;
}

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (degrees: number) => (degrees * Math.PI) / 180;

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function circleIntersectsRect(c: Vec2, radius: number, r: Rect): boolean {
  const cx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - cx;
  const dy = c.y - cy;
  return dx * dx + dy * dy < radius * radius;
}

export function inflate(r: Rect, m: number): Rect {
  return { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
}

/**
 * Ray / AABB intersection (slab method). Returns the distance along the ray
 * to the first hit, or Infinity. Rays starting inside the rect return 0.
 */
export function rayRect(origin: Vec2, dir: Vec2, r: Rect): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [origin.x, dir.x, r.x, r.x + r.w],
    [origin.y, dir.y, r.y, r.y + r.h],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  if (tmax < 0) return Infinity;
  return Math.max(0, tmin);
}

/** Does the segment a→b pass through rect r? */
export function segmentIntersectsRect(a: Vec2, b: Vec2, r: Rect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-12) return false;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  return rayRect(a, dir, r) <= len;
}

export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
