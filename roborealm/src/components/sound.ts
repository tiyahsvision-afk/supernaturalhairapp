"use client";
import { useGame } from "@/progress/store";

let ctx: AudioContext | null = null;

/** Tiny synthesized UI sounds (no audio files). Purely feedback; every sound has a visual equivalent. */
export function playSound(kind: "click" | "success" | "fail" | "coin" | "hint") {
  if (typeof window === "undefined" || !useGame.getState().settings.sound) return;
  try {
    ctx ??= new AudioContext();
    const notes: Record<typeof kind, [number, number][]> = {
      click: [[660, 0.05]],
      hint: [[520, 0.08], [780, 0.1]],
      coin: [[988, 0.07], [1319, 0.12]],
      success: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
      fail: [[392, 0.15], [311, 0.25]],
    };
    let t = ctx.currentTime;
    for (const [f, d] of notes[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d * 0.9;
    }
  } catch {
    /* audio unavailable — ignore */
  }
}
