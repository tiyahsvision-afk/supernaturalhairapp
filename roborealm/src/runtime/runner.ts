import { deg, normalizeAngle, rad } from "@/engine/geometry";
import { buildGrid, planPath } from "@/engine/planner";
import { SimError, Simulation, isPathClear, round } from "@/engine/sim";
import type { Frame, Rect, RobotSpec, RobotState, SimEvent, SimMetrics } from "@/engine/types";
import type { BuiltScenario, ScenarioOutcome } from "@/missions/types";
import { ROBOT_API_PY } from "./robotApiPy";

/** Minimal slice of the Pyodide interface we rely on (works with the npm package in Node and in a worker). */
export interface PyodideLike {
  runPython(code: string): unknown;
  registerJsModule(name: string, module: object): void;
  globals: { get(name: string): unknown };
}

export interface RunRequest {
  code: string;
  scenario: BuiltScenario;
  spec: RobotSpec;
  seed?: number;
  timeLimit: number;
  recordFrames?: boolean;
  stepLimit?: number;
  maxApiCalls?: number;
}

/** One robot API call, recorded for step-through debugging. */
export interface TraceStep {
  index: number;
  line: number;
  call: string;
  vars: Record<string, string>;
  result?: unknown;
  t0: number;
  t1: number;
  frame0: number;
  frame1: number;
}

export interface ProgramError {
  type: string;
  message: string;
  line: number | null;
}

export interface RunResult {
  scenarioName: string;
  error: ProgramError | null;
  frames: Frame[];
  events: SimEvent[];
  trace: TraceStep[];
  output: { line: number; text: string; t: number }[];
  metrics: SimMetrics;
  final: RobotState;
  items: { id: string; x: number; y: number }[];
  linesExecuted: number;
  outcome: ScenarioOutcome;
}

/** Apply scenario hardware faults to a copy of the robot spec. */
export function applyFaults(spec: RobotSpec, scenario: BuiltScenario): RobotSpec {
  const f = scenario.faults;
  if (!f) return spec;
  return {
    ...spec,
    sensors: spec.sensors.map((s) => ({ ...s, bias: s.bias + (f.sensorBias?.[s.id] ?? 0) })),
    motorPolarity: f.motorPolarity ?? spec.motorPolarity,
  };
}

const r3 = (v: number) => round(v, 3);

let bridgeHandler: { call: (n: string, a: string, l: number, v: string) => string; output: (s: string, l: number) => void } = {
  call: () => JSON.stringify({ ok: false, code: "INTERNAL", message: "No active run." }),
  output: () => {},
};

const prepared = new WeakSet<object>();

/** Load the robot API into a Pyodide instance (idempotent). */
export function prepare(py: PyodideLike) {
  if (prepared.has(py)) return;
  py.registerJsModule("_rr_bridge", {
    call: (n: string, a: string, l: number, v: string) => bridgeHandler.call(n, a, l, v),
    output: (s: string, l: number) => bridgeHandler.output(s, l),
  });
  py.runPython(ROBOT_API_PY);
  prepared.add(py);
}

export function runProgram(py: PyodideLike, req: RunRequest): RunResult {
  prepare(py);
  const spec = applyFaults(req.spec, req.scenario);
  const sim = new Simulation(req.scenario.world, spec, req.scenario.start, {
    seed: req.seed ?? 1,
    timeLimit: req.timeLimit,
    recordFrames: req.recordFrames ?? true,
  });
  const maxCalls = req.maxApiCalls ?? 20000;
  const trace: TraceStep[] = [];
  const output: RunResult["output"] = [];
  const reported: Rect[] = [];
  const clearance = spec.radius + 0.1;
  const info = req.scenario.info;
  let calls = 0;

  const handlers: Record<string, (...a: never[]) => unknown> = {
    forward: (m: number, speed: number) => {
      sim.commandCount++;
      return r3(sim.driveDistance(m, speed).travelled);
    },
    turn: (d: number, speed: number) => {
      sim.commandCount++;
      return r3(deg(sim.turnBy(rad(d), speed)));
    },
    set_motors: (l: number, r: number) => {
      sim.commandCount++;
      sim.setMotors(l / 100, r / 100);
      sim.step();
      return null;
    },
    wait: (s: number) => {
      sim.wait(s);
      return null;
    },
    stop: () => {
      sim.commandCount++;
      sim.stop();
      return null;
    },
    distance: (id: string) => sim.readDistance(id),
    touch: (id: string) => sim.readTouch(id),
    floor: (id: string) => sim.readFloor(id),
    position: () => {
      sim.step();
      return [r3(sim.state.x), r3(sim.state.y)];
    },
    heading: () => {
      sim.step();
      return round(deg(normalizeAngle(sim.state.theta)), 2);
    },
    battery: () => round((sim.state.batteryWh / spec.batteryWh) * 100, 1),
    radius: () => spec.radius,
    pick_up: () => {
      sim.commandCount++;
      return sim.pickUp();
    },
    drop: () => {
      sim.commandCount++;
      return sim.drop();
    },
    is_carrying: () => sim.state.carrying !== null,
    calibrate: (id: string, off: number) => {
      sim.calibrate(id, off);
      return null;
    },
    estop: () => {
      sim.emergencyStop();
      return null;
    },
    world_target: () => {
      if (!info.target) throw new SimError("INVALID_ARG", "This mission has no target. Try world.waypoints() or world.package().");
      return [info.target.x, info.target.y];
    },
    world_waypoints: () => (info.waypoints ?? []).map((p) => [p.x, p.y]),
    world_package: () => {
      const id = info.package;
      if (!id) throw new SimError("INVALID_ARG", "This mission has no package.");
      if (sim.state.carrying === id) return null;
      const it = sim.items.find((i) => i.id === id)!;
      return [r3(it.x), r3(it.y)];
    },
    world_dropoff: () => {
      const z = req.scenario.world.zones.find((z) => z.id === info.dropoff);
      if (!z) throw new SimError("INVALID_ARG", "This mission has no drop-off zone.");
      return [r3(z.rect.x + z.rect.w / 2), r3(z.rect.y + z.rect.h / 2)];
    },
    world_hazards: () =>
      req.scenario.world.zones.filter((z) => z.kind === "hazard").map((z) => [z.rect.x, z.rect.y, z.rect.w, z.rect.h]),
    world_size: () => [req.scenario.world.width, req.scenario.world.height],
    world_is_clear: (x1: number, y1: number, x2: number, y2: number) => {
      const w = { ...req.scenario.world, obstacles: [...req.scenario.world.obstacles, ...reported.map((r, i) => ({ ...r, id: `rep${i}` }))] };
      return isPathClear(w, { x: x1, y: y1 }, { x: x2, y: y2 }, clearance);
    },
    world_plan_path: (x1: number, y1: number, x2: number, y2: number) =>
      planPath(req.scenario.world, { x: x1, y: y1 }, { x: x2, y: y2 }, clearance, reported).map((p) => [p.x, p.y]),
    world_report_obstacle: (x: number, y: number, size: number) => {
      const s = Math.min(Math.max(size, 0.05), 1);
      reported.push({ x: x - s / 2, y: y - s / 2, w: s, h: s });
      sim.emit("command", `Reported obstacle at (${r3(x)}, ${r3(y)}) to the planner`);
      return null;
    },
    world_grid: () => buildGrid(req.scenario.world, clearance, reported).blocked.map((row) => row.map((b) => (b ? 1 : 0))),
  };

  bridgeHandler = {
    call: (name, argsJson, line, varsJson) => {
      calls++;
      if (calls > maxCalls) {
        return JSON.stringify({ ok: false, code: "CALL_LIMIT", message: `Command budget of ${maxCalls} robot calls used up.` });
      }
      const fn = handlers[name];
      if (!fn) return JSON.stringify({ ok: false, code: "INVALID_ARG", message: `Unknown robot command ${name}` });
      sim.currentLine = line || undefined;
      const args = JSON.parse(argsJson) as never[];
      const step: TraceStep = {
        index: trace.length,
        line,
        call: `${name.replace(/^world_/, "world.")}(${args.map((a) => JSON.stringify(a)).join(", ")})`,
        vars: JSON.parse(varsJson),
        t0: r3(sim.t),
        t1: r3(sim.t),
        frame0: Math.max(0, sim.frames.length - 1),
        frame1: Math.max(0, sim.frames.length - 1),
      };
      trace.push(step);
      try {
        const value = fn(...args);
        step.result = value;
        step.t1 = r3(sim.t);
        step.frame1 = Math.max(0, sim.frames.length - 1);
        return JSON.stringify({ ok: true, value });
      } catch (e) {
        step.t1 = r3(sim.t);
        step.frame1 = Math.max(0, sim.frames.length - 1);
        if (e instanceof SimError) {
          return JSON.stringify({ ok: false, code: e.code, message: e.message });
        }
        return JSON.stringify({ ok: false, code: "INTERNAL", message: String((e as Error)?.message ?? e) });
      } finally {
        sim.currentLine = undefined;
      }
    },
    output: (text, line) => {
      const last = output[output.length - 1];
      if (last && last.line === line && !last.text.endsWith("\n")) last.text += text;
      else output.push({ line, text, t: r3(sim.t) });
    },
  };

  const runFn = py.globals.get("_rr_run") as (src: string, limit: number, seed: number) => string;
  let raw: string;
  try {
    raw = runFn(req.code, req.stepLimit ?? 3_000_000, req.seed ?? 1);
  } finally {
    bridgeHandler = { call: () => JSON.stringify({ ok: false, code: "INTERNAL", message: "No active run." }), output: () => {} };
  }
  const res = JSON.parse(raw) as { type?: string; message?: string; line?: number | null; steps: number };
  const error: ProgramError | null = res.type ? { type: res.type, message: res.message ?? "", line: res.line ?? null } : null;
  if (error) sim.emit("error", `${error.type}: ${error.message}`, { line: error.line });
  for (const o of output) {
    for (const textLine of o.text.split("\n").filter(Boolean)) {
      sim.events.push({ t: o.t, type: "print", line: o.line, message: textLine });
    }
  }
  sim.events.sort((a, b) => a.t - b.t);

  const items = sim.items.map((i) => ({ id: i.id, x: r3(i.x), y: r3(i.y) }));
  const metrics = sim.metrics();
  return {
    scenarioName: req.scenario.name,
    error,
    frames: sim.frames,
    events: sim.events,
    trace,
    output: output.map((o) => ({ ...o, text: o.text.replace(/\n$/, "") })),
    metrics,
    final: { ...sim.state },
    items,
    linesExecuted: res.steps,
    outcome: {
      finalPose: { x: sim.state.x, y: sim.state.y, theta: sim.state.theta },
      items,
      carrying: sim.state.carrying,
      events: sim.events,
      metrics,
      error: error ?? undefined,
    },
  };
}
