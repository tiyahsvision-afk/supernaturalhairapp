"use client";

import { useEffect, useRef, useState } from "react";
import { rayRect } from "@/engine/geometry";
import type { Frame, Rect, RobotSpec, WorldDef, Zone } from "@/engine/types";

interface Props {
  world: WorldDef;
  spec: RobotSpec;
  color: string;
  frame: Frame;
  trail?: Frame[];
  /** Accessible description override. */
  label?: string;
}

const ZONE_STYLE: Record<Zone["kind"], { fill: string; stroke: string; icon: string }> = {
  target: { fill: "rgba(110,231,183,0.22)", stroke: "#6EE7B7", icon: "◎" },
  checkpoint: { fill: "rgba(125,211,252,0.18)", stroke: "#7DD3FC", icon: "⚑" },
  hazard: { fill: "rgba(253,230,138,0.12)", stroke: "#FDE68A", icon: "⚠" },
  pickup: { fill: "rgba(253,186,154,0.2)", stroke: "#FDBA9A", icon: "⬆" },
  dropoff: { fill: "rgba(167,139,250,0.25)", stroke: "#A78BFA", icon: "⬇" },
};

/**
 * 2.5D top-down renderer of simulation frames. It draws exactly what the
 * deterministic engine recorded — it never animates anything the engine did not compute.
 */
export function SimCanvas({ world, spec, color, frame, trail, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 24;
  const scale = (width - pad * 2) / world.width;
  const height = Math.round(world.height * scale + pad * 2);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, { world, spec, color, frame, trail, width, height, pad, scale });
  }, [world, spec, color, frame, trail, width, height, pad, scale]);

  return (
    <div ref={wrap} className="w-full min-w-0">
      <canvas
        ref={canvas}
        style={{ width: "100%", maxWidth: width, height }}
        className="block rounded-2xl"
        role="img"
        aria-label={
          label ??
          `Simulation view. Robot at x ${frame.x.toFixed(2)} m, y ${frame.y.toFixed(2)} m, heading ${Math.round((frame.theta * 180) / Math.PI)} degrees, time ${frame.t.toFixed(1)} seconds.`
        }
      />
    </div>
  );
}

interface DrawArgs {
  world: WorldDef;
  spec: RobotSpec;
  color: string;
  frame: Frame;
  trail?: Frame[];
  width: number;
  height: number;
  pad: number;
  scale: number;
}

function draw(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  const { world, spec, frame, width, height, pad, scale } = a;
  const X = (x: number) => pad + x * scale;
  const Y = (y: number) => height - pad - y * scale;
  const rectPx = (r: Rect) => ({ x: X(r.x), y: Y(r.y + r.h), w: r.w * scale, h: r.h * scale });

  // Floor
  ctx.clearRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "#1b2a6b");
  g.addColorStop(1, "#13205a");
  ctx.fillStyle = g;
  roundRect(ctx, X(0), Y(world.height), world.width * scale, world.height * scale, 14);
  ctx.fill();

  // Grid every 0.5 m with metre labels
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.width + 1e-9; x += 0.5) {
    ctx.strokeStyle = Math.abs(x % 1) < 1e-9 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(X(x), Y(0));
    ctx.lineTo(X(x), Y(world.height));
    ctx.stroke();
  }
  for (let y = 0; y <= world.height + 1e-9; y += 0.5) {
    ctx.strokeStyle = Math.abs(y % 1) < 1e-9 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.moveTo(X(0), Y(y));
    ctx.lineTo(X(world.width), Y(y));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "10px ui-sans-serif, system-ui";
  for (let x = 0; x <= world.width + 1e-9; x += 1) ctx.fillText(`${x}m`, X(x) + 2, Y(0) + 12);
  for (let y = 1; y <= world.height + 1e-9; y += 1) ctx.fillText(`${y}m`, X(0) - 20, Y(y) + 3);

  // Zones
  for (const z of world.zones) {
    const st = ZONE_STYLE[z.kind];
    const p = rectPx(z.rect);
    ctx.save();
    roundRect(ctx, p.x, p.y, p.w, p.h, 8);
    ctx.fillStyle = st.fill;
    ctx.fill();
    if (z.kind === "hazard") {
      ctx.clip();
      ctx.strokeStyle = "rgba(253,230,138,0.35)";
      ctx.lineWidth = 6;
      for (let s = -p.h; s < p.w + p.h; s += 18) {
        ctx.beginPath();
        ctx.moveTo(p.x + s, p.y + p.h);
        ctx.lineTo(p.x + s + p.h, p.y);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash(z.kind === "checkpoint" ? [5, 4] : []);
    roundRect(ctx, p.x, p.y, p.w, p.h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = st.stroke;
    ctx.font = "600 11px ui-sans-serif, system-ui";
    const text = `${st.icon} ${z.label ?? z.kind}`;
    ctx.fillText(text, p.x + 4, p.y + 13, Math.max(30, p.w - 6));
  }

  // Obstacles: 2.5D extruded blocks
  const lift = Math.min(10, scale * 0.06);
  for (const o of world.obstacles) {
    const p = rectPx(o);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRect(ctx, p.x + 4, p.y + 6, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = o.unmapped ? "#b45309" : "#3b4b8f";
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.fillStyle = o.unmapped ? "#f59e0b" : "#6272c4";
    roundRect(ctx, p.x, p.y - lift, p.w, p.h, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    roundRect(ctx, p.x, p.y - lift, p.w, p.h, 6);
    ctx.stroke();
    if (o.label && p.w > 40 && p.h > 14) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 10px ui-sans-serif, system-ui";
      ctx.fillText(o.label, p.x + 4, p.y - lift + 12, p.w - 8);
    }
  }

  // Items
  for (const it of frame.items) drawPackage(ctx, X(it.x), Y(it.y), scale);

  // Trail
  if (a.trail && a.trail.length > 1) {
    ctx.strokeStyle = "rgba(167,139,250,0.55)";
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    a.trail.forEach((f, i) => (i ? ctx.lineTo(X(f.x), Y(f.y)) : ctx.moveTo(X(f.x), Y(f.y))));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Sensor beams (computed from the same geometry the engine uses)
  const walls: Rect[] = [
    { x: -1, y: -1, w: world.width + 2, h: 1 },
    { x: -1, y: world.height, w: world.width + 2, h: 1 },
    { x: -1, y: 0, w: 1, h: world.height },
    { x: world.width, y: 0, w: 1, h: world.height },
  ];
  for (const s of spec.sensors) {
    if (s.kind !== "distance") continue;
    const ang = frame.theta + s.angle;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    let hit = Infinity;
    for (const r of [...walls, ...world.obstacles]) hit = Math.min(hit, rayRect(frame, dir, r));
    const range = s.range + spec.radius;
    const len = Math.min(hit, range);
    const sx = frame.x + dir.x * spec.radius;
    const sy = frame.y + dir.y * spec.radius;
    const ex = frame.x + dir.x * len;
    const ey = frame.y + dir.y * len;
    const grad = ctx.createLinearGradient(X(sx), Y(sy), X(ex), Y(ey));
    grad.addColorStop(0, "rgba(125,211,252,0.55)");
    grad.addColorStop(1, "rgba(125,211,252,0.05)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(X(sx), Y(sy));
    ctx.lineTo(X(ex), Y(ey));
    ctx.stroke();
    if (hit <= range) {
      ctx.fillStyle = "#7DD3FC";
      ctx.beginPath();
      ctx.arc(X(ex), Y(ey), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Robot
  const rx = X(frame.x);
  const ry = Y(frame.y);
  const rr = spec.radius * scale;
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(-frame.theta);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(3, 5, rr, rr, 0, 0, Math.PI * 2);
  ctx.fill();
  const wb = (spec.wheelBase / 2) * scale;
  const ww = Math.max(4, spec.wheelRadius * 2 * scale);
  const wl = Math.max(8, rr * 1.0);
  for (const [side, angle] of [
    [-1, frame.wl], // canvas -y in the robot's frame is its left side
    [1, frame.wr],
  ] as const) {
    const wy = side * wb;
    ctx.fillStyle = "#1e293b";
    roundRect(ctx, -wl / 2, wy - ww / 2, wl, ww, 3);
    ctx.fill();
    // Tread marks move with the recorded wheel rotation.
    ctx.strokeStyle = "rgba(148,163,184,0.8)";
    ctx.lineWidth = 1.5;
    const spacing = 6;
    const offset = ((((angle * spec.wheelRadius * scale) % spacing) + spacing) % spacing) - spacing;
    ctx.save();
    roundRect(ctx, -wl / 2, wy - ww / 2, wl, ww, 3);
    ctx.clip();
    for (let tx = -wl / 2 + offset; tx < wl / 2 + spacing; tx += spacing) {
      ctx.beginPath();
      ctx.moveTo(tx, wy - ww / 2);
      ctx.lineTo(tx, wy + ww / 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = a.color;
  ctx.beginPath();
  ctx.arc(0, 0, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(11,20,55,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#0b1437";
  ctx.beginPath();
  ctx.arc(0, 0, rr * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // face / heading marker
  ctx.fillStyle = "#6EE7B7";
  ctx.beginPath();
  ctx.arc(rr * 0.55, -rr * 0.25, Math.max(2, rr * 0.12), 0, Math.PI * 2);
  ctx.arc(rr * 0.55, rr * 0.25, Math.max(2, rr * 0.12), 0, Math.PI * 2);
  ctx.fill();
  if (spec.hasGripper) {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    const open = frame.carrying ? 0.12 : 0.22;
    ctx.beginPath();
    ctx.moveTo(rr, -rr * 0.3);
    ctx.lineTo(rr + 0.06 * scale, -rr * open);
    ctx.moveTo(rr, rr * 0.3);
    ctx.lineTo(rr + 0.06 * scale, rr * open);
    ctx.stroke();
  }
  ctx.restore();
  if (frame.carrying) {
    const gx = frame.x + Math.cos(frame.theta) * (spec.radius + 0.06);
    const gy = frame.y + Math.sin(frame.theta) * (spec.radius + 0.06);
    drawPackage(ctx, X(gx), Y(gy), scale);
  }

  // HUD
  ctx.fillStyle = "rgba(11,20,55,0.75)";
  roundRect(ctx, width - 150, 8, 142, 40, 10);
  ctx.fill();
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "600 11px ui-monospace, monospace";
  ctx.fillText(`t = ${frame.t.toFixed(2)} s`, width - 142, 24);
  const bat = Math.max(0, Math.min(1, frame.battery));
  ctx.fillText(`🔋 ${(bat * 100).toFixed(1)}%`, width - 142, 40);
  ctx.fillStyle = world.physics === "realistic" ? "#FDBA9A" : "#6EE7B7";
  ctx.font = "600 10px ui-sans-serif, system-ui";
  ctx.fillText(world.physics === "realistic" ? "Realistic physics (simplified model)" : "Simplified physics", pad, 14);
}

function drawPackage(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const s = Math.max(10, 0.14 * scale);
  ctx.fillStyle = "#FDBA9A";
  roundRect(ctx, x - s / 2, y - s / 2, s, s, 3);
  ctx.fill();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - s / 2, y);
  ctx.lineTo(x + s / 2, y);
  ctx.moveTo(x, y - s / 2);
  ctx.lineTo(x, y + s / 2);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
