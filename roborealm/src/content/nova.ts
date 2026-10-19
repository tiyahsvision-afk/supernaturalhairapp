/**
 * NOVA — deterministic tutoring layer. Everything here is rule-based and
 * reproducible: error explanations, code review heuristics, result
 * interpretation and struggle tracking. An optional LLM layer (/api/nova)
 * can add conversational explanations, but grading never depends on it.
 */
import type { MissionReport } from "@/missions/evaluate";
import type { MissionDef } from "@/missions/types";
import { stripComments } from "@/missions/helpers";
import type { Attempt } from "@/progress/types";
import { COMPETENCIES } from "./competencies";
import { MISSIONS } from "@/missions/missions";

export interface NovaNote {
  tone: "info" | "warn" | "tip";
  text: string;
}

const EXPLAIN: Record<string, string> = {
  SyntaxError: "Python couldn't understand this line. Look for a missing colon ':' after if/for/while/def, an unclosed bracket, or a typo.",
  IndentationError: "Python uses indentation (spaces at the start of a line) to group code. Lines inside a loop or if-statement must be indented by the same amount (4 spaces).",
  NameError: "You used a name Python doesn't know. Check the spelling (Python is case-sensitive) and make sure the variable was created before this line.",
  TypeError: "A value of the wrong type was used — for example text where a number was expected, or a function called with the wrong number of arguments.",
  ValueError: "The value has the right type but doesn't make sense here (for example infinity or an impossible number).",
  ZeroDivisionError: "Your program divided by zero. Check the values before dividing.",
  AttributeError: "That object doesn't have this attribute or method. Check the spelling: e.g. robot.turn_left, not robot.turnLeft.",
  IndexError: "You asked for a list position that doesn't exist. Lists start at index 0 and the last index is len(list) - 1.",
  ImportError: "Only safe modules (math, random, collections, ...) are available in the ROBOREALM sandbox.",
  RobotError: "The robot couldn't do what you asked. Read the message: maybe a sensor or gripper is missing, or the emergency stop is active.",
  MissionTimeLimit: "The mission clock ran out. Your robot may be stuck in a loop, moving very slowly, or waiting forever.",
  StepLimit: "Your program ran millions of lines without finishing — almost always a loop whose condition never becomes False (for example a while loop that never moves the robot).",
  AssertionError: "An assert statement in your program failed — the condition you expected to be True was False.",
};

export function explainError(type: string): string {
  return EXPLAIN[type] ?? "Something went wrong while running your program. Read the message and check the highlighted line.";
}

/** Static review of the program text — quick, explainable checks a mentor would make. */
export function reviewCode(code: string, mission: MissionDef): NovaNote[] {
  const src = stripComments(code);
  const notes: NovaNote[] = [];
  if (!/robot\.\w+\(/.test(src)) {
    notes.push({ tone: "warn", text: "Your program never gives the robot a command, so it will just sit there." });
  }
  if (/while\s+True\s*:/.test(src) && !/\bbreak\b|return\b/.test(src)) {
    notes.push({ tone: "warn", text: "`while True:` with no `break` never ends on its own. The mission clock will stop it — add a condition or a break." });
  }
  const sensorMission = mission.requires?.sensors?.some((s) => s.kind === "distance");
  if (sensorMission && !/robot\.distance\(/.test(src)) {
    notes.push({ tone: "tip", text: "This mission changes between tests. Reading robot.distance() lets your robot react instead of relying on fixed numbers." });
  }
  const bigMoves = [...src.matchAll(/robot\.forward\(\s*([0-9.]+)/g)].map((m) => parseFloat(m[1])).filter((v) => v >= 1.5);
  if (sensorMission && bigMoves.length) {
    notes.push({ tone: "tip", text: `A long single move (${bigMoves[0]} m) can't react to obstacles. Try small steps inside a loop and check the sensor each time.` });
  }
  if (/while\s+robot\.distance\([^)]*\)\s*<\s*/.test(src)) {
    notes.push({ tone: "info", text: "Read your while condition aloud: 'keep going while the distance is LESS than…'. Is that when you want the robot to drive?" });
  }
  if (mission.kind === "capstone") {
    if (!/pick_up\(/.test(src)) notes.push({ tone: "warn", text: "The program never calls robot.pick_up()." });
    if (!/drop\(/.test(src)) notes.push({ tone: "warn", text: "The program never calls robot.drop() to deliver the package." });
    if (!/def\s+\w+\(/.test(src)) notes.push({ tone: "tip", text: "Big programs are easier to debug as small functions (face, drive_to, go). Test each one separately." });
  }
  if ((mission.codeChecks ?? []).some((c) => c.id === "loop") && !/^\s*(for|while)\b/m.test(src)) {
    notes.push({ tone: "warn", text: "This mission requires a loop." });
  }
  if (!notes.length) notes.push({ tone: "info", text: "No obvious problems spotted. Run it, watch closely, and compare what happens with what you expected." });
  return notes;
}

/** Turn a failed report into a short engineering-style diagnosis. */
export function interpretReport(r: MissionReport): NovaNote[] {
  const notes: NovaNote[] = [];
  const collisions = r.scenarios.reduce((n, s) => n + s.metrics.collisions, 0);
  if (r.safetyGateFailed) notes.push({ tone: "warn", text: "A safety violation always fails the mission. Find which turn or move took the robot into the restricted area." });
  if (collisions) notes.push({ tone: "warn", text: `${collisions} collision(s). Slow down near obstacles, move in smaller steps, and check sensors before each step.` });
  if (r.hiddenTotal && r.scenarios[0]?.passed && r.hiddenPassed < r.hiddenRequired) {
    notes.push({ tone: "tip", text: "Practice passes but hidden tests fail — the classic sign of hard-coded numbers. Use sensor readings and world data so the program adapts." });
  }
  if (r.passed) notes.push({ tone: "info", text: "Great work. Record what you learned in your notebook while it's fresh." });
  return notes;
}

/** Skills a learner seems to be struggling with, based on repeated failed attempts. */
export function struggles(attempts: Attempt[]): { skillId: string; name: string; fails: number; suggestion?: string }[] {
  const fails = new Map<string, number>();
  for (const a of attempts.slice(-60)) {
    if (a.passed) continue;
    const m = MISSIONS.find((x) => x.id === a.missionId);
    for (const s of m?.skills ?? []) fails.set(s, (fails.get(s) ?? 0) + 1);
  }
  return [...fails.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skillId, n]) => {
      const c = COMPETENCIES.find((x) => x.id === skillId);
      const practice = c?.practice[0] ? MISSIONS.find((m) => m.id === c.practice[0]) : undefined;
      return { skillId, name: c?.name ?? skillId, fails: n, suggestion: practice ? `Revisit "${practice.title}" and its lesson cards.` : undefined };
    });
}

export const CAREER_LINKS: Record<string, string> = {
  "robot-beginnings": "Robotics technicians assemble, inspect and calibrate robots every day — knowing what each component does is step one.",
  "code-city": "Robotics software developers write the programs that turn goals into precise motion.",
  "sensor-jungle": "Sensor and test engineers make sure robots perceive the world accurately — and fix them when they don't.",
  "autonomous-arena": "Autonomy engineers combine planning, sensing and control so robots can work without a human driver.",
};
