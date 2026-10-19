import { describe, expect, it } from "vitest";
import { Simulation, SimError, isPathClear } from "@/engine/sim";
import { planPath } from "@/engine/planner";
import { rad } from "@/engine/geometry";
import type { WorldDef } from "@/engine/types";
import { starterSpec } from "./support/robots";

const open = (w = 4, h = 3, extra: Partial<WorldDef> = {}): WorldDef => ({
  width: w,
  height: h,
  obstacles: [],
  zones: [],
  items: [],
  physics: "simplified",
  ...extra,
});

describe("robot movement", () => {
  it("drives an exact distance in simplified physics", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    const r = sim.driveDistance(1.5);
    expect(r.blocked).toBe(false);
    expect(sim.state.x).toBeCloseTo(2.0, 3);
    expect(sim.state.y).toBeCloseTo(1, 6);
  });

  it("time advances by the fixed timestep and matches distance / speed", () => {
    const spec = starterSpec();
    const sim = new Simulation(open(), spec, { x: 0.5, y: 1, theta: 0 });
    sim.driveDistance(1, 1);
    expect(sim.t).toBeCloseTo(Math.ceil(1 / (spec.maxWheelSpeed * 0.02)) * 0.02, 6);
  });

  it("turns in place by the requested angle", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 1, y: 1, theta: 0 });
    sim.turnBy(rad(90));
    expect(sim.state.theta).toBeCloseTo(Math.PI / 2, 4);
    expect(sim.state.x).toBeCloseTo(1, 6);
    sim.turnBy(rad(-180));
    expect(sim.state.theta).toBeCloseTo(-Math.PI / 2, 4);
  });

  it("wheels rotate by distance / wheel radius", () => {
    const spec = starterSpec();
    const sim = new Simulation(open(), spec, { x: 0.5, y: 1, theta: 0 });
    sim.driveDistance(1);
    expect(sim.state.wheelAngleL).toBeCloseTo(1 / spec.wheelRadius, 2);
    expect(sim.state.wheelAngleR).toBeCloseTo(1 / spec.wheelRadius, 2);
  });

  it("realistic physics respects acceleration limits", () => {
    const spec = starterSpec();
    const sim = new Simulation(open(4, 3, { physics: "realistic" }), spec, { x: 0.5, y: 1, theta: 0 });
    sim.setMotors(1, 1);
    sim.step();
    expect(sim.state.vl).toBeLessThanOrEqual(spec.maxAccel * 0.02 + 1e-9);
    sim.driveDistance(1);
    // Within a few cm of the commanded 1 m despite acceleration limits and wheel mismatch.
    expect(sim.state.x).toBeGreaterThan(1.46);
    expect(sim.state.x).toBeLessThan(1.56);
  });

  it("reversed motor polarity (a wiring fault) makes forward go backward", () => {
    const spec = { ...starterSpec(), motorPolarity: { left: -1 as const, right: -1 as const } };
    const sim = new Simulation(open(), spec, { x: 2, y: 1, theta: 0 });
    sim.driveDistance(0.5);
    expect(sim.state.x).toBeLessThan(2);
  });
});

describe("collisions", () => {
  it("stops at an obstacle and counts one collision", () => {
    const w = open(4, 2, { obstacles: [{ id: "wall", x: 2, y: 0, w: 0.2, h: 2 }] });
    const spec = starterSpec();
    const sim = new Simulation(w, spec, { x: 0.5, y: 1, theta: 0 });
    const r = sim.driveDistance(3);
    expect(r.blocked).toBe(true);
    expect(sim.state.collisions).toBe(1);
    expect(sim.state.x + spec.radius).toBeLessThanOrEqual(2 + 1e-9);
    expect(sim.events.some((e) => e.type === "collision")).toBe(true);
  });

  it("arena boundaries are solid", () => {
    const sim = new Simulation(open(2, 2), starterSpec(), { x: 1, y: 1, theta: Math.PI });
    sim.driveDistance(5);
    expect(sim.state.x).toBeGreaterThanOrEqual(starterSpec().radius - 1e-9);
    expect(sim.state.collisions).toBe(1);
  });
});

describe("sensors", () => {
  it("distance sensor measures from the robot's edge", () => {
    const w = open(4, 2, { obstacles: [{ id: "wall", x: 2, y: 0, w: 0.2, h: 2 }] });
    const spec = starterSpec();
    const sim = new Simulation(w, spec, { x: 0.5, y: 1, theta: 0 });
    expect(sim.readDistance("front")).toBeCloseTo(2 - 0.5 - spec.radius, 3);
  });

  it("clamps to the sensor's maximum range", () => {
    const sim = new Simulation(open(10, 2), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    expect(sim.readDistance("front")).toBe(2);
  });

  it("applies bias faults and calibration corrections", () => {
    const base = starterSpec();
    const spec = { ...base, sensors: base.sensors.map((s) => ({ ...s, bias: 0.35 })) };
    const w = open(4, 2, { obstacles: [{ id: "wall", x: 2, y: 0, w: 0.2, h: 2 }] });
    const sim = new Simulation(w, spec, { x: 0.5, y: 1, theta: 0 });
    const truth = 2 - 0.5 - spec.radius;
    expect(sim.readDistance()).toBeCloseTo(truth + 0.35, 3);
    sim.calibrate("front", -0.35);
    expect(sim.readDistance()).toBeCloseTo(truth, 3);
  });

  it("each sensor read advances the clock by one tick", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    sim.readDistance();
    sim.readDistance();
    expect(sim.t).toBeCloseTo(0.04, 9);
  });

  it("missing sensors raise a helpful error", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    expect(() => sim.readDistance("left")).toThrow(SimError);
    expect(() => sim.readTouch()).toThrow(/no touch sensor/);
  });

  it("noise is seeded: identical seeds give identical readings", () => {
    const w = open(4, 2, { physics: "realistic", obstacles: [{ id: "wall", x: 2, y: 0, w: 0.2, h: 2 }] });
    const read = (seed: number) => {
      const sim = new Simulation(w, starterSpec(), { x: 0.5, y: 1, theta: 0 }, { seed });
      return [sim.readDistance(), sim.readDistance(), sim.readDistance()];
    };
    expect(read(7)).toEqual(read(7));
    expect(read(7)).not.toEqual(read(8));
  });
});

describe("battery, zones, gripper and safety", () => {
  it("battery drains with motor use", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    sim.wait(1);
    const idle = sim.state.batteryWh;
    sim.driveDistance(2, 1);
    expect(sim.state.batteryWh).toBeLessThan(idle);
    expect(sim.metrics().batteryUsedPct).toBeGreaterThan(0);
  });

  it("an empty battery stops the robot", () => {
    const spec = { ...starterSpec(), batteryWh: 0.0005 };
    const sim = new Simulation(open(10, 2), spec, { x: 0.5, y: 1, theta: 0 });
    sim.driveDistance(5);
    expect(sim.state.x).toBeLessThan(5);
    expect(sim.events.some((e) => e.type === "battery_depleted")).toBe(true);
  });

  it("records a safety violation when entering a hazard zone", () => {
    const w = open(4, 2, { zones: [{ id: "h", kind: "hazard", rect: { x: 2, y: 0, w: 1, h: 2 }, label: "Cell" }] });
    const sim = new Simulation(w, starterSpec(), { x: 0.5, y: 1, theta: 0 });
    sim.driveDistance(2);
    expect(sim.safetyViolations).toBe(1);
  });

  it("picks up, carries and delivers an item", () => {
    const spec = starterSpec();
    const w = open(4, 2, {
      items: [{ id: "pkg", kind: "package", x: 1.0, y: 1 }],
      zones: [{ id: "d", kind: "dropoff", rect: { x: 2.5, y: 0.7, w: 0.6, h: 0.6 } }],
    });
    const sim = new Simulation(w, spec, { x: 1 - spec.radius - 0.06, y: 1, theta: 0 });
    expect(sim.pickUp()).toBe(true);
    sim.driveDistance(1.8);
    expect(sim.items[0].x).toBeCloseTo(sim.gripperPoint().x, 6);
    expect(sim.drop()).toBe(true);
    expect(sim.events.some((e) => e.type === "delivered")).toBe(true);
  });

  it("emergency stop locks out motion", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 });
    sim.emergencyStop();
    expect(() => sim.driveDistance(1)).toThrow(/Emergency stop/);
  });

  it("enforces the simulated time limit", () => {
    const sim = new Simulation(open(), starterSpec(), { x: 0.5, y: 1, theta: 0 }, { timeLimit: 1 });
    expect(() => sim.wait(5)).toThrow(/time limit/);
  });
});

describe("planning", () => {
  const w = open(5, 4, {
    obstacles: [{ id: "s", x: 1.4, y: 0, w: 0.3, h: 2.6 }],
    zones: [{ id: "h", kind: "hazard", rect: { x: 3.5, y: 0, w: 1.5, h: 1.5 } }],
  });

  it("isPathClear rejects paths through shelves and restricted zones", () => {
    expect(isPathClear(w, { x: 0.5, y: 0.5 }, { x: 0.5, y: 3.5 }, 0.25)).toBe(true);
    expect(isPathClear(w, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }, 0.25)).toBe(false);
    expect(isPathClear(w, { x: 2.5, y: 2 }, { x: 4.5, y: 0.5 }, 0.25)).toBe(false);
  });

  it("plans a collision-free route around a shelf", () => {
    const path = planPath(w, { x: 0.5, y: 0.5 }, { x: 2.5, y: 0.5 }, 0.25);
    expect(path.length).toBeGreaterThan(1);
    let prev = { x: 0.5, y: 0.5 };
    for (const p of path) {
      expect(isPathClear(w, prev, p, 0.2)).toBe(true);
      prev = p;
    }
    expect(path[path.length - 1]).toEqual({ x: 2.5, y: 0.5 });
  });

  it("returns an empty path when the goal is unreachable", () => {
    const boxed = open(4, 4, { obstacles: [{ id: "wall", x: 2, y: 0, w: 0.2, h: 4 }] });
    expect(planPath(boxed, { x: 0.5, y: 0.5 }, { x: 3.5, y: 3.5 }, 0.25)).toEqual([]);
  });
});
