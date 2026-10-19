import { beforeAll, describe, expect, it } from "vitest";
import { getMission } from "@/missions/missions";
import { runProgram, type PyodideLike } from "@/runtime/runner";
import { runScenario } from "@/runtime/missionRunner";
import { getPy } from "./support/py";
import { starterSpec } from "./support/robots";

let py: PyodideLike;
beforeAll(async () => {
  py = await getPy();
});

const m1 = () => getMission("m1-wake-up")!;
const run = (code: string, opts: { stepLimit?: number; timeLimit?: number } = {}) =>
  runProgram(py, {
    code,
    scenario: m1().buildScenario(0, starterSpec()),
    spec: starterSpec(),
    timeLimit: opts.timeLimit ?? 60,
    stepLimit: opts.stepLimit,
  });

describe("secure Python execution", () => {
  it("player code really controls the robot", () => {
    const a = run("robot.forward(1)");
    const b = run("robot.forward(0.5)\nrobot.turn_left(90)");
    expect(a.final.x).toBeCloseTo(1.5, 3);
    expect(b.final.x).toBeCloseTo(1.0, 3);
    expect(b.final.theta).toBeCloseTo(Math.PI / 2, 3);
  });

  it("is deterministic: same program, same frames", () => {
    const code = "for i in range(3):\n    robot.forward(0.3)\n    robot.turn(37)\n";
    expect(run(code).frames).toEqual(run(code).frames);
  });

  it("reports syntax errors with a line number", () => {
    const r = run("robot.forward(1)\nif True\n    robot.forward(1)");
    expect(r.error?.type).toBe("SyntaxError");
    expect(r.error?.line).toBe(2);
    expect(r.frames.length).toBe(1);
  });

  it("reports runtime errors with the failing line", () => {
    const r = run("x = 1\nrobot.forward(1)\ny = x / 0\n");
    expect(r.error?.type).toBe("ZeroDivisionError");
    expect(r.error?.line).toBe(3);
    expect(r.final.x).toBeCloseTo(1.5, 3);
  });

  it("stops infinite loops with the line budget", () => {
    const r = run("while True:\n    pass\n", { stepLimit: 20000 });
    expect(r.error?.type).toBe("StepLimit");
  });

  it("stops programs that exceed the simulated time limit, even with a bare except", () => {
    const r = run("while True:\n    try:\n        robot.wait(1)\n    except Exception:\n        pass\n", { timeLimit: 5 });
    expect(r.error?.type).toBe("MissionTimeLimit");
  });

  it("blocks imports outside the allow-list", () => {
    for (const mod of ["js", "pyodide", "os", "sys", "subprocess", "micropip"]) {
      const r = run(`import ${mod}`);
      expect(r.error?.type, mod).toBe("ImportError");
    }
    expect(run("import math, random\nprint(math.pi)").error).toBeNull();
  });

  it("removes dangerous builtins", () => {
    expect(run("open('x')").error?.type).toBe("NameError");
    expect(run("eval('1+1')").error?.type).toBe("NameError");
  });

  it("type-checks robot arguments with friendly errors", () => {
    const r = run('robot.forward("far")');
    expect(r.error?.type).toBe("TypeError");
    expect(r.error?.message).toMatch(/must be a number/);
  });

  it("missing hardware raises RobotError", () => {
    const r = run("robot.distance('left')");
    expect(r.error?.type).toBe("RobotError");
  });

  it("captures print output with line numbers", () => {
    const r = run('x = 3\nprint("hello", x)\nrobot.forward(0.1)\nprint("done")');
    expect(r.output.map((o) => [o.line, o.text])).toEqual([
      [2, "hello 3"],
      [4, "done"],
    ]);
  });

  it("records a step-through trace with lines, variables and frame ranges", () => {
    const r = run("speed = 0.5\nfor i in range(2):\n    d = 0.25 * (i + 1)\n    robot.forward(d, speed)\n");
    expect(r.trace).toHaveLength(2);
    expect(r.trace[0].line).toBe(4);
    expect(r.trace[0].vars).toMatchObject({ speed: "0.5", i: "0", d: "0.25" });
    expect(r.trace[1].vars.i).toBe("1");
    expect(r.trace[1].frame1).toBeGreaterThan(r.trace[1].frame0);
  });

  it("each run gets a fresh namespace", () => {
    run("secret = 42");
    expect(run("print(secret)").error?.type).toBe("NameError");
  });

  it("random is seeded per run for repeatable tests", () => {
    const a = run("import random\nprint(random.random())").output[0].text;
    const b = run("import random\nprint(random.random())").output[0].text;
    expect(a).toBe(b);
  });

  it("evaluation uses engine outcomes, not UI state", () => {
    const r = runScenario(py, m1(), starterSpec(), "robot.forward(2)", 0);
    expect(r.criteria.every((c) => c.passed)).toBe(true);
  });
});
