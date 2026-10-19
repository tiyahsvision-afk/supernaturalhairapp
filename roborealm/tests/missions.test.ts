import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { MISSIONS, getMission } from "@/missions/missions";
import { runScenario, submitMission } from "@/runtime/missionRunner";
import type { PyodideLike } from "@/runtime/runner";
import { deriveSpec, starterDesign } from "@/robots/design";
import { getPy } from "./support/py";
import { starterSpec } from "./support/robots";

let py: PyodideLike;
beforeAll(async () => {
  py = await getPy();
});

const submit = (id: string, code: string, spec = starterSpec(), hints = 0) =>
  submitMission(py, getMission(id)!, spec, code, hints).report;

const GO_TO = `
import math
def go_to(tx, ty):
    x, y = robot.position()
    dx, dy = tx - x, ty - y
    angle = math.degrees(math.atan2(dy, dx))
    robot.turn((angle - robot.heading() + 180) % 360 - 180)
    robot.forward(math.hypot(dx, dy))
`;

describe("mission catalogue", () => {
  it("every mission builds every scenario and has 3 hints and skills", () => {
    for (const m of MISSIONS) {
      expect(m.hints).toHaveLength(3);
      expect(m.skills.length).toBeGreaterThan(0);
      for (let i = 0; i < m.scenarioCount; i++) {
        const s = m.buildScenario(i, starterSpec());
        expect(s.world.width).toBeGreaterThan(0);
      }
    }
  });

  it("starter code never passes a mission (no free success)", () => {
    for (const m of MISSIONS) {
      const r = submitMission(py, m, starterSpec(), m.starterPython, 0).report;
      expect(r.passed, m.id).toBe(false);
    }
  });

  it("an empty program never passes", () => {
    for (const m of MISSIONS) {
      expect(submitMission(py, m, starterSpec(), "", 0).report.passed, m.id).toBe(false);
    }
  });
});

describe("guided missions accept correct solutions", () => {
  it("M1: drive 2 m onto the pad", () => {
    expect(submit("m1-wake-up", "robot.forward(2)").passed).toBe(true);
    expect(submit("m1-wake-up", "robot.forward(1)").passed).toBe(false);
  });

  it("M2: requires the loop, not just the path", () => {
    const loop = "for i in range(4):\n    robot.forward(1)\n    robot.turn_left(90)\n";
    const unrolled = "robot.forward(1)\nrobot.turn_left(90)\n".repeat(4);
    expect(submit("m2-plaza-patrol", loop).passed).toBe(true);
    const r = submit("m2-plaza-patrol", unrolled);
    expect(r.passed).toBe(false);
    expect(r.codeChecks.find((c) => c.id === "loop")?.passed).toBe(false);
  });

  it("M3: generic coordinate solution passes hidden beacons, hard-coded one fails", () => {
    const generic = GO_TO + "go_to(*world.target())\n";
    expect(submit("m3-coordinate-courier", generic).passed).toBe(true);
    const hard = "import math\nrobot.turn(math.degrees(math.atan2(1.5, 2.5)))\nrobot.forward(math.hypot(2.5, 1.5))\n";
    const r = submit("m3-coordinate-courier", hard);
    expect(r.scenarios[0].passed).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("M4: sensor loop works for every wall; fixed distance does not", () => {
    expect(submit("m4-fog-wall", "while robot.distance() > 0.2:\n    robot.forward(0.05)\n").passed).toBe(true);
    expect(submit("m4-fog-wall", "robot.forward(1.4)").passed).toBe(false);
  });

  it("M4: needs a front distance sensor on the robot", () => {
    const d = { ...starterDesign(), sensors: [] };
    expect(() => submitMission(py, getMission("m4-fog-wall")!, deriveSpec(d), "pass", 0)).toThrow(/distance sensor/);
  });

  it("M5: only the fully repaired program passes", () => {
    const fixed = `SAFE_GAP = 0.2
robot.calibrate("front", -0.35)
while robot.distance() > SAFE_GAP:
    robot.forward(0.05)
robot.turn_left(90)
robot.forward(1.0)
`;
    expect(submit("m5-work-order-007", fixed).passed).toBe(true);
    const noCalibration = fixed.replace('robot.calibrate("front", -0.35)\n', "");
    const r = submit("m5-work-order-007", noCalibration);
    expect(r.passed).toBe(false);
    const wrongTurn = fixed.replace("turn_left", "turn_right");
    const r2 = submit("m5-work-order-007", wrongTurn);
    expect(r2.passed).toBe(false);
    expect(r2.safetyGateFailed).toBe(true);
  });
});

describe("independent assessments", () => {
  it("A1: generic waypoint follower passes, hints do not lower assessment independence", () => {
    const code = GO_TO + "for p in world.waypoints():\n    go_to(*p)\n";
    const r = submit("a1-precision-movement", code);
    expect(r.passed).toBe(true);
    expect(r.hiddenPassed).toBe(4);
  });

  it("A1: hidden layouts are not revealed in the returned runs", () => {
    const { runs } = submitMission(py, getMission("a1-precision-movement")!, starterSpec(), "pass", 0);
    expect(runs[0].frames.length).toBeGreaterThan(0);
    for (const r of runs.slice(1)) {
      expect(r.frames).toHaveLength(0);
      expect(r.trace).toHaveLength(0);
    }
  });

  it("A2: sensor-driven junction solver passes; always-left fails", () => {
    const solver = `
while robot.distance() > 0.2:
    robot.forward(0.05)
robot.turn_left(90)
if robot.distance() < 0.6:
    robot.turn(180)
while robot.distance() > 0.2:
    robot.forward(0.05)
`;
    expect(submit("a2-sensor-navigation", solver).passed).toBe(true);
    const alwaysLeft = "while robot.distance() > 0.2:\n    robot.forward(0.05)\nrobot.turn_left(90)\nwhile robot.distance() > 0.2:\n    robot.forward(0.05)\n";
    expect(submit("a2-sensor-navigation", alwaysLeft).passed).toBe(false);
  });
});

describe("capstone", () => {
  const solution = readFileSync(new URL("./solutions/capstone.py", import.meta.url), "utf8");

  it("reference autonomous solution delivers in every layout, including unmapped obstacles", () => {
    const m = getMission("cap-autonomous-delivery")!;
    for (let i = 0; i < m.scenarioCount; i++) {
      const run = runScenario(py, m, starterSpec(), solution, i, false);
      const failed = run.criteria.filter((c) => !c.passed);
      expect(failed, `scenario ${i}: ${JSON.stringify(failed)} ${JSON.stringify(run.error)}`).toEqual([]);
    }
  });

  it("passes the capstone grading", () => {
    const r = submit("cap-autonomous-delivery", solution);
    expect(r.passed).toBe(true);
    expect(r.hiddenPassed).toBeGreaterThanOrEqual(4);
  });

  it("a planner-only solution without sensing collides with unmapped boxes", () => {
    const blind = solution.replace("if ahead < min(0.25, remaining):", "if False:");
    const r = submit("cap-autonomous-delivery", blind);
    expect(r.passed).toBe(false);
  });
});
