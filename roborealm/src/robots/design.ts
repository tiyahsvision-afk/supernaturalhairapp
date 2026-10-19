import type { RobotSpec, SensorSpec } from "@/engine/types";
import { rad } from "@/engine/geometry";
import {
  ACCESSORIES,
  BATTERIES,
  CHASSIS,
  CONTROLLERS,
  DRIVES,
  GRIPPERS,
  MOTORS,
  MOUNTS,
  PAINTS,
  SENSORS,
  type MountId,
} from "./components";

export interface SensorMount {
  part: string;
  mount: MountId;
}

export interface RobotDesign {
  id: string;
  name: string;
  chassis: string;
  drive: string;
  motor: string;
  battery: string;
  controller: string;
  sensors: SensorMount[];
  gripper: string | null;
  paint: string;
  accessory: string;
}

export interface DesignCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DesignStats {
  massKg: number;
  topSpeed: number;
  turnRateDegPerSec: number;
  runtimeMin: number;
  payloadKg: number;
  sensorPortsUsed: number;
  sensorPortsTotal: number;
  sensorSlotsTotal: number;
}

export function starterDesign(id = "robot-1", name = "Bolt"): RobotDesign {
  return {
    id,
    name,
    chassis: "rover",
    drive: "wheels-std",
    motor: "dc-basic",
    battery: "lipo-s",
    controller: "brain-2",
    sensors: [{ part: "ultrasonic", mount: "front" }],
    gripper: "claw",
    paint: "paint-lavender",
    accessory: "acc-antenna",
  };
}

const find = <T extends { id: string }>(list: T[], id: string | null | undefined) =>
  id ? list.find((p) => p.id === id) : undefined;

/** Sensor names used from code: the mount position (front, left, ...), or "bumper"/"floor". */
export function sensorName(m: SensorMount): string {
  const part = find(SENSORS, m.part);
  if (part?.kind === "touch") return "bumper";
  if (part?.kind === "floor") return "floor";
  return m.mount;
}

export function validateDesign(d: RobotDesign): DesignCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chassis = find(CHASSIS, d.chassis);
  const controller = find(CONTROLLERS, d.controller);
  if (!chassis) errors.push("Pick a chassis — every robot needs a frame to hold its parts.");
  if (!find(DRIVES, d.drive)) errors.push("Pick wheels or tracks so the robot can move.");
  if (!find(MOTORS, d.motor)) errors.push("Add motors to turn the wheels.");
  if (!find(BATTERIES, d.battery)) errors.push("Add a battery — without power nothing works.");
  if (!controller) errors.push("Add a controller (the robot's brain) to run your program.");
  for (const s of d.sensors) if (!find(SENSORS, s.part)) errors.push(`Unknown sensor part "${s.part}".`);
  if (controller && d.sensors.length > controller.sensorPorts) {
    errors.push(
      `${controller.name} has only ${controller.sensorPorts} sensor ports but ${d.sensors.length} sensors are attached. Remove a sensor or upgrade the controller.`,
    );
  }
  if (chassis && d.sensors.length > chassis.sensorSlots) {
    errors.push(`${chassis.name} has room for ${chassis.sensorSlots} sensors.`);
  }
  const names = d.sensors.map(sensorName);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) errors.push(`Two sensors share the "${dup}" position. Move one to another mount.`);
  if (d.gripper) {
    if (!find(GRIPPERS, d.gripper)) errors.push(`Unknown gripper "${d.gripper}".`);
    if (chassis && !chassis.gripperMount) errors.push(`${chassis.name} has no gripper mount. Choose Rover or Hauler.`);
  }
  if (!errors.length) {
    const stats = designStats(d);
    if (stats.massKg > stats.payloadKg + (chassis?.massKg ?? 0) + 1.2) {
      warnings.push("This robot is heavy for its motors — it will accelerate slowly.");
    }
    if (stats.runtimeMin < 10) warnings.push("Short battery life: under 10 minutes of driving.");
    if (!d.sensors.length) warnings.push("No sensors: the robot cannot perceive its surroundings.");
  }
  return { ok: errors.length === 0, errors, warnings };
}

function totalMass(d: RobotDesign): number {
  const parts = [
    find(CHASSIS, d.chassis),
    find(DRIVES, d.drive),
    find(MOTORS, d.motor),
    find(BATTERIES, d.battery),
    find(CONTROLLERS, d.controller),
    find(GRIPPERS, d.gripper),
    ...d.sensors.map((s) => find(SENSORS, s.part)),
  ];
  return parts.reduce((m, p) => m + (p?.massKg ?? 0), 0);
}

/**
 * Convert a design into physical capabilities. Simplified model:
 *  - top speed = wheel surface speed at rated RPM × drive efficiency × load factor
 *  - load factor drops when mass exceeds what the motor torque comfortably moves
 *  - acceleration scales with torque / mass and drive grip
 */
export function deriveSpec(d: RobotDesign): RobotSpec {
  const check = validateDesign(d);
  if (!check.ok) throw new Error(`Invalid robot design: ${check.errors.join(" ")}`);
  const chassis = find(CHASSIS, d.chassis)!;
  const drive = find(DRIVES, d.drive)!;
  const motor = find(MOTORS, d.motor)!;
  const battery = find(BATTERIES, d.battery)!;
  const controller = find(CONTROLLERS, d.controller)!;
  const mass = totalMass(d);
  const comfortableMass = motor.torqueNm * 6; // kg the pair moves at full speed
  const loadFactor = Math.min(1, Math.sqrt(comfortableMass / mass));
  const wheelSpeed = (motor.rpm / 60) * 2 * Math.PI * drive.wheelRadius;
  const maxWheelSpeed = round3(wheelSpeed * drive.efficiency * loadFactor);
  const maxAccel = round3(Math.min(2.5, ((motor.torqueNm / drive.wheelRadius) / mass) * 0.15 * drive.grip));

  const sensors: SensorSpec[] = d.sensors.map((m) => {
    const part = find(SENSORS, m.part)!;
    return {
      id: sensorName(m),
      kind: part.kind,
      angle: rad(MOUNTS[m.mount].angleDeg),
      range: part.range,
      noise: part.noise,
      bias: 0,
    };
  });
  const sensorPower = d.sensors.reduce((w, m) => w + (find(SENSORS, m.part)?.powerW ?? 0), 0);
  const gripper = find(GRIPPERS, d.gripper);

  return {
    radius: chassis.radius,
    wheelBase: chassis.wheelBase,
    wheelRadius: drive.wheelRadius,
    maxWheelSpeed,
    maxAccel,
    massKg: round3(mass),
    batteryWh: battery.capacityWh,
    idleW: controller.idleW + sensorPower,
    motorW: motor.powerW,
    sensors,
    hasGripper: !!gripper,
    gripperReach: gripper?.reach ?? 0,
    motorPolarity: { left: 1, right: 1 },
  };
}

export function designStats(d: RobotDesign): DesignStats {
  const chassis = find(CHASSIS, d.chassis);
  const controller = find(CONTROLLERS, d.controller);
  const motor = find(MOTORS, d.motor);
  const battery = find(BATTERIES, d.battery);
  const drive = find(DRIVES, d.drive);
  const mass = totalMass(d);
  let topSpeed = 0;
  let turn = 0;
  if (motor && drive && chassis) {
    const loadFactor = Math.min(1, Math.sqrt((motor.torqueNm * 6) / mass));
    topSpeed = (motor.rpm / 60) * 2 * Math.PI * drive.wheelRadius * drive.efficiency * loadFactor;
    turn = ((2 * topSpeed) / chassis.wheelBase) * (180 / Math.PI);
  }
  const sensorPower = d.sensors.reduce((w, m) => w + (find(SENSORS, m.part)?.powerW ?? 0), 0);
  const drawW = (controller?.idleW ?? 0) + sensorPower + (motor?.powerW ?? 0) * 0.6;
  return {
    massKg: round3(mass),
    topSpeed: round3(topSpeed),
    turnRateDegPerSec: Math.round(turn),
    runtimeMin: battery && drawW > 0 ? Math.round((battery.capacityWh / drawW) * 60) : 0,
    payloadKg: chassis?.maxPayloadKg ?? 0,
    sensorPortsUsed: d.sensors.length,
    sensorPortsTotal: controller?.sensorPorts ?? 0,
    sensorSlotsTotal: chassis?.sensorSlots ?? 0,
  };
}

export function paintColor(d: RobotDesign): string {
  return find(PAINTS, d.paint)?.color ?? "#A78BFA";
}

export function accessoryOf(d: RobotDesign) {
  return find(ACCESSORIES, d.accessory);
}

/** Capability requirements a mission may impose on the robot. */
export interface RobotRequirements {
  sensors?: { name: string; kind: "distance" | "touch" | "floor" }[];
  gripper?: boolean;
}

export function meetsRequirements(spec: RobotSpec, req: RobotRequirements | undefined): string[] {
  const missing: string[] = [];
  if (!req) return missing;
  for (const s of req.sensors ?? []) {
    if (!spec.sensors.some((x) => x.id === s.name && x.kind === s.kind)) {
      missing.push(`a ${s.kind} sensor mounted at "${s.name}"`);
    }
  }
  if (req.gripper && !spec.hasGripper) missing.push("a gripper (needs a Rover or Hauler frame)");
  return missing;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
