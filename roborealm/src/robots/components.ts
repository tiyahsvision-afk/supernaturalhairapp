/**
 * Component catalog for the Robot Workshop. Every functional field here
 * feeds into deriveSpec() and changes how the simulated robot behaves.
 * Numbers are simplified teaching values, not manufacturer datasheets.
 */

export type ComponentCategory =
  | "chassis"
  | "drive"
  | "motor"
  | "battery"
  | "controller"
  | "sensor"
  | "gripper"
  | "paint"
  | "accessory";

interface Base {
  id: string;
  name: string;
  category: ComponentCategory;
  blurb: string;
  massKg: number;
  /** Robo Coin price for cosmetics; functional parts are always free (no pay-to-win). */
  price?: number;
}

export interface ChassisPart extends Base {
  category: "chassis";
  radius: number;
  wheelBase: number;
  sensorSlots: number;
  gripperMount: boolean;
  maxPayloadKg: number;
}

export interface DrivePart extends Base {
  category: "drive";
  wheelRadius: number;
  /** Multiplier on achievable speed (tracks lose some to friction). */
  efficiency: number;
  /** Multiplier on acceleration (grip). */
  grip: number;
}

export interface MotorPart extends Base {
  category: "motor";
  rpm: number;
  /** Electrical power of the pair at full command, W. */
  powerW: number;
  /** Torque rating used for load-carrying capacity, N·m (pair). */
  torqueNm: number;
}

export interface BatteryPart extends Base {
  category: "battery";
  capacityWh: number;
}

export interface ControllerPart extends Base {
  category: "controller";
  sensorPorts: number;
  idleW: number;
}

export interface SensorPart extends Base {
  category: "sensor";
  kind: "distance" | "touch" | "floor";
  range: number;
  noise: number;
  powerW: number;
}

export interface GripperPart extends Base {
  category: "gripper";
  reach: number;
}

export interface CosmeticPart extends Base {
  category: "paint" | "accessory";
  color?: string;
}

export type Part =
  | ChassisPart
  | DrivePart
  | MotorPart
  | BatteryPart
  | ControllerPart
  | SensorPart
  | GripperPart
  | CosmeticPart;

export const CHASSIS: ChassisPart[] = [
  {
    id: "scout",
    name: "Scout Frame",
    category: "chassis",
    blurb: "Small round frame. Turns in tight spaces. No gripper mount.",
    massKg: 0.6,
    radius: 0.12,
    wheelBase: 0.18,
    sensorSlots: 3,
    gripperMount: false,
    maxPayloadKg: 0.5,
  },
  {
    id: "rover",
    name: "Rover Frame",
    category: "chassis",
    blurb: "All-rounder with a front gripper mount and five sensor slots.",
    massKg: 0.9,
    radius: 0.15,
    wheelBase: 0.24,
    sensorSlots: 5,
    gripperMount: true,
    maxPayloadKg: 1.5,
  },
  {
    id: "hauler",
    name: "Hauler Frame",
    category: "chassis",
    blurb: "Big and sturdy. Carries heavy loads but needs wide aisles.",
    massKg: 1.6,
    radius: 0.2,
    wheelBase: 0.32,
    sensorSlots: 6,
    gripperMount: true,
    maxPayloadKg: 3,
  },
];

export const DRIVES: DrivePart[] = [
  {
    id: "wheels-std",
    name: "Standard Wheels",
    category: "drive",
    blurb: "70 mm wheels. Balanced speed and precision.",
    massKg: 0.1,
    wheelRadius: 0.035,
    efficiency: 1,
    grip: 1,
  },
  {
    id: "wheels-large",
    name: "Large Wheels",
    category: "drive",
    blurb: "100 mm wheels. Each rotation covers more ground: faster, but harder to stop quickly.",
    massKg: 0.16,
    wheelRadius: 0.05,
    efficiency: 1,
    grip: 0.8,
  },
  {
    id: "tracks",
    name: "Tank Tracks",
    category: "drive",
    blurb: "Excellent grip and acceleration, but friction lowers top speed.",
    massKg: 0.3,
    wheelRadius: 0.035,
    efficiency: 0.8,
    grip: 1.5,
  },
];

export const MOTORS: MotorPart[] = [
  {
    id: "dc-basic",
    name: "Basic DC Motors",
    category: "motor",
    blurb: "120 RPM. Efficient and dependable.",
    massKg: 0.12,
    rpm: 120,
    powerW: 2.5,
    torqueNm: 0.4,
  },
  {
    id: "dc-turbo",
    name: "Turbo DC Motors",
    category: "motor",
    blurb: "200 RPM. Fast, but hungry for battery and weak under load.",
    massKg: 0.14,
    rpm: 200,
    powerW: 5,
    torqueNm: 0.25,
  },
  {
    id: "gearmotor",
    name: "Geared Motors",
    category: "motor",
    blurb: "80 RPM with a gearbox. Slow, strong, great for heavy robots.",
    massKg: 0.2,
    rpm: 80,
    powerW: 3,
    torqueNm: 1.0,
  },
];

export const BATTERIES: BatteryPart[] = [
  { id: "aa-pack", name: "AA Battery Pack", category: "battery", blurb: "4 Wh. Light but short-lived.", massKg: 0.12, capacityWh: 4 },
  { id: "lipo-s", name: "Small LiPo", category: "battery", blurb: "10 Wh rechargeable pack.", massKg: 0.2, capacityWh: 10 },
  { id: "lipo-l", name: "Large LiPo", category: "battery", blurb: "25 Wh. Long missions, but heavy.", massKg: 0.45, capacityWh: 25 },
];

export const CONTROLLERS: ControllerPart[] = [
  { id: "brain-1", name: "Brain Mk1", category: "controller", blurb: "Entry microcontroller with 2 sensor ports.", massKg: 0.05, sensorPorts: 2, idleW: 0.5 },
  { id: "brain-2", name: "Brain Mk2", category: "controller", blurb: "4 sensor ports and faster processing.", massKg: 0.06, sensorPorts: 4, idleW: 0.8 },
  { id: "brain-x", name: "Brain X", category: "controller", blurb: "6 sensor ports. Draws more power.", massKg: 0.08, sensorPorts: 6, idleW: 1.5 },
];

export const SENSORS: SensorPart[] = [
  {
    id: "ultrasonic",
    name: "Ultrasonic Distance Sensor",
    category: "sensor",
    blurb: "Measures distance with sound echoes. Range 2 m, ±1 cm noise.",
    massKg: 0.03,
    kind: "distance",
    range: 2,
    noise: 0.01,
    powerW: 0.1,
  },
  {
    id: "lidar-point",
    name: "Laser Rangefinder",
    category: "sensor",
    blurb: "Time-of-flight laser. Range 4 m, ±3 mm noise.",
    massKg: 0.04,
    kind: "distance",
    range: 4,
    noise: 0.003,
    powerW: 0.3,
  },
  {
    id: "bumper",
    name: "Bump Switch",
    category: "sensor",
    blurb: "A touch switch that reports when the robot presses against something.",
    massKg: 0.02,
    kind: "touch",
    range: 0,
    noise: 0,
    powerW: 0,
  },
  {
    id: "floor-color",
    name: "Floor Colour Sensor",
    category: "sensor",
    blurb: "Looks down and recognises coloured floor zones.",
    massKg: 0.02,
    kind: "floor",
    range: 0,
    noise: 0,
    powerW: 0.05,
  },
];

export const GRIPPERS: GripperPart[] = [
  { id: "claw", name: "Two-Finger Claw", category: "gripper", blurb: "Grabs packages up to 15 cm from the front bumper.", massKg: 0.15, reach: 0.15 },
];

export const PAINTS: CosmeticPart[] = [
  { id: "paint-lavender", name: "Lavender", category: "paint", blurb: "Classic ROBOREALM purple.", massKg: 0, color: "#A78BFA" },
  { id: "paint-sky", name: "Sky", category: "paint", blurb: "Bright sky blue.", massKg: 0, color: "#7DD3FC" },
  { id: "paint-mint", name: "Mint", category: "paint", blurb: "Fresh mint green.", massKg: 0, color: "#6EE7B7" },
  { id: "paint-peach", name: "Peach", category: "paint", blurb: "Warm peach.", massKg: 0, color: "#FDBA9A", price: 40 },
  { id: "paint-sun", name: "Sunbeam", category: "paint", blurb: "Soft yellow.", massKg: 0, color: "#FDE68A", price: 40 },
  { id: "paint-chrome", name: "Chrome", category: "paint", blurb: "Polished silver.", massKg: 0, color: "#CBD5E1", price: 120 },
];

export const ACCESSORIES: CosmeticPart[] = [
  { id: "acc-none", name: "None", category: "accessory", blurb: "Keep it clean.", massKg: 0 },
  { id: "acc-antenna", name: "Antenna", category: "accessory", blurb: "A bouncy antenna.", massKg: 0 },
  { id: "acc-visor", name: "Visor", category: "accessory", blurb: "Cool racing visor.", massKg: 0, price: 60 },
  { id: "acc-crown", name: "Circuit Crown", category: "accessory", blurb: "For capstone champions.", massKg: 0, price: 200 },
];

export const MOUNTS = {
  front: { label: "Front", angleDeg: 0 },
  "front-left": { label: "Front-left", angleDeg: 45 },
  "front-right": { label: "Front-right", angleDeg: -45 },
  left: { label: "Left", angleDeg: 90 },
  right: { label: "Right", angleDeg: -90 },
  back: { label: "Back", angleDeg: 180 },
} as const;

export type MountId = keyof typeof MOUNTS;

export const ALL_PARTS: Part[] = [
  ...CHASSIS,
  ...DRIVES,
  ...MOTORS,
  ...BATTERIES,
  ...CONTROLLERS,
  ...SENSORS,
  ...GRIPPERS,
  ...PAINTS,
  ...ACCESSORIES,
];

export function getPart<T extends Part = Part>(id: string): T | undefined {
  return ALL_PARTS.find((p) => p.id === id) as T | undefined;
}
