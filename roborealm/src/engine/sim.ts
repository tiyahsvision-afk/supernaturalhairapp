import {
  circleIntersectsRect,
  dist,
  inflate,
  normalizeAngle,
  pointInRect,
  rayRect,
  segmentIntersectsRect,
} from "./geometry";
import { createRng, type Rng } from "./rng";
import type {
  Frame,
  Item,
  Pose,
  Rect,
  RobotSpec,
  RobotState,
  SensorSpec,
  SimEvent,
  SimEventType,
  SimMetrics,
  Vec2,
  WorldDef,
  Zone,
} from "./types";

export type SimErrorCode =
  | "TIME_LIMIT"
  | "ESTOP"
  | "NO_SENSOR"
  | "NO_GRIPPER"
  | "INVALID_ARG";

/** Errors raised to the student program (converted to Python RobotError). */
export class SimError extends Error {
  constructor(
    public code: SimErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SimOptions {
  seed?: number;
  /** Fixed simulation timestep, s. The clock is deterministic: it never reads wall time. */
  dt?: number;
  /** Simulated-time budget, s. */
  timeLimit?: number;
  recordFrames?: boolean;
}

const WALL = 1; // thickness of the virtual walls surrounding the arena

export class Simulation {
  readonly world: WorldDef;
  readonly spec: RobotSpec;
  readonly dt: number;
  readonly timeLimit: number;
  readonly recordFrames: boolean;
  readonly state: RobotState;
  readonly items: Item[];
  readonly events: SimEvent[] = [];
  readonly frames: Frame[] = [];
  /** Line of student code currently executing; stamped onto events. */
  currentLine: number | undefined;
  t = 0;
  commandCount = 0;
  sensorReads = 0;
  safetyViolations = 0;

  private rng: Rng;
  private walls: Rect[];
  private zonesInside = new Set<string>();
  private calibration: Record<string, number> = {};
  private batteryEventSent = false;

  constructor(world: WorldDef, spec: RobotSpec, start: Pose, opts: SimOptions = {}) {
    this.world = world;
    this.spec = spec;
    this.dt = opts.dt ?? 0.02;
    this.timeLimit = opts.timeLimit ?? 120;
    this.recordFrames = opts.recordFrames ?? true;
    this.rng = createRng(opts.seed ?? 1);
    this.items = world.items.map((i) => ({ ...i }));
    this.state = {
      x: start.x,
      y: start.y,
      theta: normalizeAngle(start.theta),
      vl: 0,
      vr: 0,
      cmdL: 0,
      cmdR: 0,
      wheelAngleL: 0,
      wheelAngleR: 0,
      batteryWh: spec.batteryWh,
      carrying: null,
      odometer: 0,
      collisions: 0,
      inContact: false,
      emergencyStopped: false,
    };
    const { width: W, height: H } = world;
    this.walls = [
      { x: -WALL, y: -WALL, w: W + 2 * WALL, h: WALL },
      { x: -WALL, y: H, w: W + 2 * WALL, h: WALL },
      { x: -WALL, y: 0, w: WALL, h: H },
      { x: W, y: 0, w: WALL, h: H },
    ];
    for (const z of this.zonesAt(this.state)) this.zonesInside.add(z.id);
    this.recordFrame();
  }

  // ---------------------------------------------------------------- events

  emit(type: SimEventType, message: string, data?: Record<string, unknown>) {
    this.events.push({ t: round(this.t, 3), type, line: this.currentLine, message, data });
  }

  private recordFrame() {
    if (!this.recordFrames) return;
    const s = this.state;
    this.frames.push({
      t: round(this.t, 3),
      x: s.x,
      y: s.y,
      theta: s.theta,
      wl: s.wheelAngleL,
      wr: s.wheelAngleR,
      battery: s.batteryWh / this.spec.batteryWh,
      carrying: s.carrying,
      items: this.items.filter((i) => i.id !== s.carrying).map((i) => ({ id: i.id, x: i.x, y: i.y })),
    });
  }

  // ---------------------------------------------------------------- physics

  private collides(x: number, y: number): boolean {
    const c = { x, y };
    const r = this.spec.radius;
    for (const w of this.walls) if (circleIntersectsRect(c, r, w)) return true;
    for (const o of this.world.obstacles) if (circleIntersectsRect(c, r, o)) return true;
    return false;
  }

  private zonesAt(p: Vec2): Zone[] {
    return this.world.zones.filter((z) =>
      z.kind === "hazard"
        ? circleIntersectsRect(p, this.spec.radius, z.rect)
        : pointInRect(p, z.rect),
    );
  }

  /** Advance the simulation by exactly one fixed timestep. */
  step() {
    if (this.t >= this.timeLimit - 1e-9) {
      throw new SimError("TIME_LIMIT", `Mission time limit of ${this.timeLimit}s reached.`);
    }
    const s = this.state;
    const sp = this.spec;
    const dt = this.dt;
    const vmax = sp.maxWheelSpeed;
    const powered = s.batteryWh > 0 && !s.emergencyStopped;
    let targetL = powered ? s.cmdL * vmax : 0;
    let targetR = powered ? s.cmdR * vmax : 0;

    if (this.world.physics === "realistic") {
      const dv = sp.maxAccel * dt;
      s.vl += clamp(targetL - s.vl, -dv, dv);
      s.vr += clamp(targetR - s.vr, -dv, dv);
      // Small seeded wheel-speed variation: real wheels never match perfectly.
      targetL = s.vl * (1 + 0.005 * this.rng.gaussian());
      targetR = s.vr * (1 + 0.005 * this.rng.gaussian());
    } else {
      s.vl = targetL;
      s.vr = targetR;
    }
    const vl = this.world.physics === "realistic" ? targetL : s.vl;
    const vr = this.world.physics === "realistic" ? targetR : s.vr;

    const v = (vl + vr) / 2;
    const w = (vr - vl) / sp.wheelBase;
    const midTheta = s.theta + (w * dt) / 2;
    const nx = s.x + v * Math.cos(midTheta) * dt;
    const ny = s.y + v * Math.sin(midTheta) * dt;
    s.theta = normalizeAngle(s.theta + w * dt);

    if (Math.abs(v) > 1e-12 && this.collides(nx, ny)) {
      if (!s.inContact) {
        s.collisions++;
        this.emit("collision", "Collision! The robot hit something and stopped moving.", {
          x: round(s.x, 3),
          y: round(s.y, 3),
        });
      }
      s.inContact = true;
    } else {
      if (Math.abs(v) > 1e-12) s.inContact = false;
      s.odometer += Math.hypot(nx - s.x, ny - s.y);
      s.x = nx;
      s.y = ny;
    }

    s.wheelAngleL += (vl * dt) / sp.wheelRadius;
    s.wheelAngleR += (vr * dt) / sp.wheelRadius;

    if (s.batteryWh > 0) {
      const load = vmax > 0 ? (Math.abs(vl) + Math.abs(vr)) / (2 * vmax) : 0;
      s.batteryWh = Math.max(0, s.batteryWh - ((sp.idleW + sp.motorW * load) * dt) / 3600);
      if (s.batteryWh === 0 && !this.batteryEventSent) {
        this.batteryEventSent = true;
        this.emit("battery_depleted", "Battery depleted — the motors have no power.");
      }
    }

    if (s.carrying) {
      const item = this.items.find((i) => i.id === s.carrying);
      if (item) Object.assign(item, this.gripperPoint());
    }

    this.t += dt;
    this.updateZones();
    this.recordFrame();
  }

  private updateZones() {
    const now = new Set(this.zonesAt(this.state).map((z) => z.id));
    for (const z of this.world.zones) {
      const was = this.zonesInside.has(z.id);
      const is = now.has(z.id);
      if (is && !was) {
        this.emit("zone_enter", `Entered ${z.label ?? z.kind} zone`, { zone: z.id, kind: z.kind });
        if (z.kind === "hazard") {
          this.safetyViolations++;
          this.emit(
            "safety_violation",
            `SAFETY: robot entered restricted area "${z.label ?? z.id}".`,
            { zone: z.id },
          );
        }
      } else if (!is && was) {
        this.emit("zone_exit", `Left ${z.label ?? z.kind} zone`, { zone: z.id, kind: z.kind });
      }
    }
    this.zonesInside = now;
  }

  // ---------------------------------------------------------------- commands

  private ensureMovable() {
    if (this.state.emergencyStopped) {
      throw new SimError("ESTOP", "Emergency stop is active. Motion commands are locked out.");
    }
  }

  /** Set wheel commands as fractions of max speed (-1..1). Persists until changed. */
  setMotors(left: number, right: number) {
    this.ensureMovable();
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      throw new SimError("INVALID_ARG", "Motor powers must be numbers.");
    }
    this.state.cmdL = clamp(left, -1, 1) * this.spec.motorPolarity.left;
    this.state.cmdR = clamp(right, -1, 1) * this.spec.motorPolarity.right;
  }

  stop() {
    this.state.cmdL = 0;
    this.state.cmdR = 0;
    if (this.world.physics === "realistic") {
      // Let the robot brake to a halt within its acceleration limit.
      let guard = 0;
      while ((Math.abs(this.state.vl) > 1e-4 || Math.abs(this.state.vr) > 1e-4) && guard++ < 500) {
        this.step();
      }
    }
    this.step();
  }

  wait(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new SimError("INVALID_ARG", "wait() needs a positive number of seconds.");
    }
    const ticks = Math.max(1, Math.round(seconds / this.dt));
    for (let i = 0; i < ticks; i++) this.step();
  }

  /**
   * Drive straight by `distance` metres (negative = reverse) at `speed` (0..1 of max).
   * Uses a trapezoidal speed profile in realistic mode. Stops early if blocked.
   */
  driveDistance(distance: number, speed = 0.6): { travelled: number; blocked: boolean } {
    this.ensureMovable();
    if (!Number.isFinite(distance)) throw new SimError("INVALID_ARG", "Distance must be a number.");
    speed = clamp(Math.abs(speed), 0.05, 1);
    const sign = Math.sign(distance);
    const target = Math.abs(distance);
    const vmax = this.spec.maxWheelSpeed;
    const pol = this.spec.motorPolarity;
    let travelled = 0;
    let stalledTicks = 0;
    const start = { x: this.state.x, y: this.state.y };
    while (target - travelled > 1e-4) {
      if (this.state.batteryWh <= 0) break;
      const remaining = target - travelled;
      let v = Math.min(vmax * speed, remaining / this.dt);
      if (this.world.physics === "realistic") {
        v = Math.min(v, Math.sqrt(2 * this.spec.maxAccel * remaining));
        v = Math.max(v, Math.min(0.02, remaining / this.dt));
      }
      const f = (sign * v) / vmax;
      this.state.cmdL = f * pol.left;
      this.state.cmdR = f * pol.right;
      const before = { x: this.state.x, y: this.state.y };
      this.step();
      const moved = dist(before, this.state);
      travelled += moved;
      if (moved < 1e-6) {
        if (++stalledTicks > 10) break;
      } else stalledTicks = 0;
    }
    this.state.cmdL = 0;
    this.state.cmdR = 0;
    if (this.world.physics === "realistic") this.stop();
    const net = dist(start, this.state);
    return { travelled: net, blocked: target - travelled > 1e-3 };
  }

  /** Rotate in place by `angle` radians (positive = left / counter-clockwise). */
  turnBy(angle: number, speed = 0.5): number {
    this.ensureMovable();
    if (!Number.isFinite(angle)) throw new SimError("INVALID_ARG", "Angle must be a number.");
    speed = clamp(Math.abs(speed), 0.05, 1);
    const sign = Math.sign(angle);
    const target = Math.abs(angle);
    const wb = this.spec.wheelBase;
    const vmax = this.spec.maxWheelSpeed;
    const pol = this.spec.motorPolarity;
    const wmax = (2 * vmax) / wb;
    let turned = 0;
    let guard = 0;
    while (target - turned > 1e-5 && guard++ < 100000) {
      if (this.state.batteryWh <= 0) break;
      const remaining = target - turned;
      let w = Math.min(wmax * speed, remaining / this.dt);
      if (this.world.physics === "realistic") {
        const alpha = (2 * this.spec.maxAccel) / wb;
        w = Math.min(w, Math.sqrt(2 * alpha * remaining));
        w = Math.max(w, Math.min(0.1, remaining / this.dt));
      }
      const wheel = (w * wb) / 2 / vmax;
      this.state.cmdL = -sign * wheel * pol.left;
      this.state.cmdR = sign * wheel * pol.right;
      const before = this.state.theta;
      this.step();
      const d = Math.abs(normalizeAngle(this.state.theta - before));
      if (d < 1e-9 && this.state.batteryWh <= 0) break;
      turned += d;
    }
    this.state.cmdL = 0;
    this.state.cmdR = 0;
    if (this.world.physics === "realistic") this.stop();
    return turned * sign;
  }

  emergencyStop() {
    this.state.cmdL = 0;
    this.state.cmdR = 0;
    this.state.vl = 0;
    this.state.vr = 0;
    if (!this.state.emergencyStopped) {
      this.state.emergencyStopped = true;
      this.emit("estop", "EMERGENCY STOP activated. All motion halted.");
    }
    this.step();
  }

  // ---------------------------------------------------------------- sensors

  sensor(id: string, kind: SensorSpec["kind"]): SensorSpec {
    const s = this.spec.sensors.find((x) => x.id === id && x.kind === kind);
    if (!s) {
      const have = this.spec.sensors.filter((x) => x.kind === kind).map((x) => x.id);
      throw new SimError(
        "NO_SENSOR",
        have.length
          ? `No ${kind} sensor called "${id}". This robot has: ${have.join(", ")}.`
          : `This robot has no ${kind} sensor. Add one in the Workshop.`,
      );
    }
    return s;
  }

  /** Ground-truth distance from the robot's edge along a sensor's beam (no noise/bias). */
  trueDistance(angle: number, maxRange = 50): number {
    const s = this.state;
    const dir = { x: Math.cos(s.theta + angle), y: Math.sin(s.theta + angle) };
    const origin = { x: s.x, y: s.y };
    let best = Infinity;
    for (const r of [...this.walls, ...this.world.obstacles]) best = Math.min(best, rayRect(origin, dir, r));
    return Math.min(maxRange, Math.max(0, best - this.spec.radius));
  }

  /** A distance reading takes one sensor sample period (one tick). */
  readDistance(id = "front"): number {
    const spec = this.sensor(id, "distance");
    this.sensorReads++;
    const truth = this.trueDistance(spec.angle);
    let reading = truth + spec.bias + (this.calibration[id] ?? 0);
    if (this.world.physics === "realistic") reading += spec.noise * this.rng.gaussian();
    reading = round(clamp(reading, 0, spec.range), 3);
    this.emit("sensor", `${id} distance = ${reading.toFixed(3)} m`, {
      sensor: id,
      value: reading,
      truth: round(Math.min(truth, spec.range), 3),
    });
    this.step();
    return reading;
  }

  readTouch(id = "bumper"): boolean {
    const spec = this.sensor(id, "touch");
    this.sensorReads++;
    const pressed = this.state.inContact || this.trueDistance(spec.angle) < 0.005;
    this.emit("sensor", `${id} touch = ${pressed}`, { sensor: id, value: pressed });
    this.step();
    return pressed;
  }

  readFloor(id = "floor"): string {
    this.sensor(id, "floor");
    this.sensorReads++;
    const z = this.world.zones.find((z) => pointInRect(this.state, z.rect));
    const value = z ? z.kind : "floor";
    this.emit("sensor", `${id} sees ${value}`, { sensor: id, value });
    this.step();
    return value;
  }

  calibrate(id: string, offset: number) {
    this.sensor(id, "distance");
    if (!Number.isFinite(offset) || Math.abs(offset) > 1) {
      throw new SimError("INVALID_ARG", "Calibration offset must be a number between -1 and 1 metres.");
    }
    this.calibration[id] = offset;
    this.emit("command", `Calibrated ${id} sensor with offset ${offset} m`);
  }

  // ---------------------------------------------------------------- gripper

  gripperPoint(): Vec2 {
    const s = this.state;
    const r = this.spec.radius + 0.06;
    return { x: s.x + r * Math.cos(s.theta), y: s.y + r * Math.sin(s.theta) };
  }

  pickUp(): boolean {
    if (!this.spec.hasGripper) throw new SimError("NO_GRIPPER", "This robot has no gripper. Add one in the Workshop.");
    this.ensureMovable();
    const gp = this.gripperPoint();
    let ok = false;
    if (!this.state.carrying) {
      const candidates = this.items
        .map((i) => ({ i, d: dist(gp, i) }))
        .filter((c) => c.d <= this.spec.gripperReach)
        .sort((a, b) => a.d - b.d);
      if (candidates.length) {
        this.state.carrying = candidates[0].i.id;
        ok = true;
        this.emit("pickup", `Picked up ${candidates[0].i.id}`, { item: candidates[0].i.id });
      } else {
        this.emit("command", "Gripper closed on nothing — no item within reach.");
      }
    }
    this.wait(0.5);
    return ok;
  }

  drop(): boolean {
    if (!this.spec.hasGripper) throw new SimError("NO_GRIPPER", "This robot has no gripper. Add one in the Workshop.");
    const id = this.state.carrying;
    if (!id) {
      this.wait(0.5);
      return false;
    }
    const item = this.items.find((i) => i.id === id)!;
    Object.assign(item, this.gripperPoint());
    this.state.carrying = null;
    this.emit("drop", `Released ${id}`, { item: id, x: round(item.x, 3), y: round(item.y, 3) });
    const zone = this.world.zones.find((z) => z.kind === "dropoff" && pointInRect(item, z.rect));
    if (zone) this.emit("delivered", `${id} delivered to ${zone.label ?? "drop-off"}!`, { item: id, zone: zone.id });
    this.wait(0.5);
    return true;
  }

  // ---------------------------------------------------------------- results

  metrics(): SimMetrics {
    return {
      time: round(this.t, 2),
      distance: round(this.state.odometer, 3),
      collisions: this.state.collisions,
      safetyViolations: this.safetyViolations,
      batteryUsedPct: round((1 - this.state.batteryWh / this.spec.batteryWh) * 100, 2),
      commands: this.commandCount,
      sensorReads: this.sensorReads,
    };
  }
}

/** Is the straight path a→b clear of mapped obstacles and restricted zones (with a safety margin)? */
export function isPathClear(world: WorldDef, a: Vec2, b: Vec2, margin: number): boolean {
  if (
    [a, b].some((p) => p.x < margin || p.y < margin || p.x > world.width - margin || p.y > world.height - margin)
  ) {
    return false;
  }
  const blockers: Rect[] = [
    ...world.obstacles.filter((o) => !o.unmapped),
    ...world.zones.filter((z) => z.kind === "hazard").map((z) => z.rect),
  ];
  return !blockers.some((r) => segmentIntersectsRect(a, b, inflate(r, margin)));
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export function round(v: number, places: number) {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}
