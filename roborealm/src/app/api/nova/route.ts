import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getMission } from "@/missions/missions";

/**
 * Optional conversational layer for NOVA. Enabled only when the server has
 * Anthropic credentials (e.g. ANTHROPIC_API_KEY). Grading, hints and code review
 * stay deterministic on the client; this route only explains and coaches.
 *
 * Privacy: the request carries the mission id, the student's code, the last error
 * and their question — never their nickname, age band or any other profile data.
 */
export const runtime = "nodejs";

const SYSTEM = `You are NOVA, a friendly robotics mentor inside ROBOREALM, a learning game for students aged 13-24.
Rules:
- Coach, don't solve. Never write the full solution or a complete working program. Point to the next step, ask a guiding question, or explain a concept with a tiny generic example that is not the mission's answer.
- Keep answers under 120 words, plain language, encouraging but honest.
- Talk about robotics, programming, maths, engineering and careers only. If asked about anything else, gently steer back to the mission.
- Never ask for or repeat personal information.
- Safety matters: never suggest bypassing restricted zones or the emergency stop.
- Grading is automatic and you cannot change scores or mark anything as passed.`;

const hits = new Map<string, { n: number; reset: number }>();
function limited(key: string) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  h.n++;
  return h.n > 8;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "NOVA chat is not configured on this server." }, { status: 501 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "NOVA needs a short break. Try again in a minute." }, { status: 429 });

  let body: { missionId?: string; question?: string; code?: string; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const mission = body.missionId ? getMission(body.missionId) : undefined;
  if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 400 });
  if (mission.kind === "assessment") {
    return NextResponse.json({ error: "NOVA is unavailable during independent assessments." }, { status: 403 });
  }
  const question = (body.question ?? "").slice(0, 600).trim();
  if (!question) return NextResponse.json({ error: "Ask NOVA a question." }, { status: 400 });

  const context = [
    `Mission: ${mission.title} (${mission.kind})`,
    `Objective: ${mission.objective}`,
    `Student code:\n${(body.code ?? "").slice(0, 4000)}`,
    body.error ? `Last error: ${body.error.slice(0, 500)}` : "",
    `Question: ${question}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000, // replies are deliberately short
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: context }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ answer: "I can't help with that one — let's get back to your robot. What is it doing that you didn't expect?" });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ answer });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "NOVA is busy right now. Try again shortly." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: "NOVA couldn't reach the AI service." }, { status: 502 });
    }
    throw error;
  }
}
