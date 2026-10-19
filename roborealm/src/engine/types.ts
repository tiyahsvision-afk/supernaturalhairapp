/**
 * Core types for the ROBOREALM robotics simulation engine.
 *
 * Units: metres, seconds, radians (internally), watt-hours.
 * Coordinate frame: x to the right (east), y up (north), heading 0 = east,
 * positive rotation = counter-clockwise (a left turn). The renderer flips y.
 *
 * The engine has no DOM dependencies so it runs identically in the browser,
 * in a Web Worker and in Node test runs.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle; (x, y) is the minimum (south-west) corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneKind = "target" | "hazard" | "pickup" | "dropoff" | "checkpoint";

export interface Zone {
  id: string;
  kind: ZoneKind;
  rect: Rect;
  label?: string;
}

export interface Obstacle extends Rect {
  id: string;
  /** Unmapped obstacles exist in the world but are not reported by world.is_clear / world map queries. */
  unmapped?: boolean;
  label?: string;
}

export interface Item {
  id: string;
  kind: "package";
  x: number;
  y: number;
}

/**
 * "simplified" — instant acceleration, noise-free sensors (beginner levels).
 * "realistic" — acceleration limits and seeded sensor noise (advanced levels).
 * Neither mode is an industrial-grade physics model; both are teaching models.
 */
export type PhysicsMode = "simplified" | "realistic";

export interface WorldDef {
  width: number;
  height: number;
  obstacles: Obstacle[];
  zones: Zone[];
  items: Item[];
  physics: PhysicsMode;
}

export interface Pose {
  x: number;
  y: number;
  /** radians */
  theta: number;
}

export type SensorKind = "distance" | "touch" | "floor";

export interface SensorSpec {
  /** Logical name used from code, e.g. "front", "left". */
  id: string;
  kind: SensorKind;
  /** Mount angle relative to robot heading (radians, CCW positive). */
  angle: number;
  /** Maximum range in metres (distance sensors). */
  range: number;
  /** Std-dev of gaussian noise in metres, applied only in realistic physics. */
  noise: number;
  /** Systematic bias added to every reading — used to model miscalibrated hardware faults. */
  bias: number;
}

/** Physical capabilities derived from a robot design (see src/robots/design.ts). */
export interface RobotSpec {
  radius: number;
  wheelBase: number;
  wheelRadius: number;
  /** Maximum linear speed of each wheel, m/s. */
  maxWheelSpeed: number;
  /** Maximum wheel acceleration, m/s² (realistic mode only). */
  maxAccel: number;
  massKg: number;
  batteryWh: number;
  /** Electronics draw while powered, W. */
  idleW: number;
  /** Draw of both motors at 100% command, W. */
  motorW: number;
  sensors: SensorSpec[];
  hasGripper: boolean;
  /** Distance from the gripper point within which an item can be grabbed, m. */
  gripperReach: number;
  /** +1 normal wiring, -1 reversed polarity (a fault used in troubleshooting missions). */
  motorPolarity: { left: 1 | -1; right: 1 | -1 };
}

export interface RobotState extends Pose {
  /** Actual wheel surface speeds, m/s. */
  vl: number;
  vr: number;
  /** Commanded wheel speeds as a fraction of max, -1..1 (after polarity). */
  cmdL: number;
  cmdR: number;
  /** Accumulated wheel rotation in radians (for rendering and odometry lessons). */
  wheelAngleL: number;
  wheelAngleR: number;
  batteryWh: number;
  carrying: string | null;
  /** Total distance travelled by the robot centre, m. */
  odometer: number;
  collisions: number;
  inContact: boolean;
  emergencyStopped: boolean;
}

export type SimEventType =
  | "command"
  | "sensor"
  | "collision"
  | "zone_enter"
  | "zone_exit"
  | "safety_violation"
  | "pickup"
  | "drop"
  | "delivered"
  | "battery_depleted"
  | "estop"
  | "print"
  | "error";

export interface SimEvent {
  t: number;
  type: SimEventType;
  /** Line in the student program that triggered the event, when known. */
  line?: number;
  message: string;
  data?: Record<string, unknown>;
}

export interface Frame {
  t: number;
  x: number;
  y: number;
  theta: number;
  wl: number;
  wr: number;
  battery: number;
  carrying: string | null;
  /** Positions of free items (those not carried). */
  items: { id: string; x: number; y: number }[];
}

export interface SimMetrics {
  time: number;
  distance: number;
  collisions: number;
  safetyViolations: number;
  batteryUsedPct: number;
  commands: number;
  sensorReads: number;
}
