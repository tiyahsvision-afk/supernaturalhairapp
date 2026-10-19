import type { Obstacle, Vec2, Zone } from "@/engine/types";
import {
  endedInZone,
  itemDelivered,
  noCollisions,
  noSafetyViolations,
  obstacle,
  programFinished,
  rect,
  usesLoop,
  visitedInOrder,
  world,
  zoneAround,
  zoneById,
} from "./helpers";
import type { BuiltScenario, CriterionResult, MissionDef } from "./types";

const blocks = (...stack: object[]) => {
  // Build a Blockly JSON serialization: a start hat followed by a chain of blocks.
  const chain = (list: object[]): object | undefined => {
    if (!list.length) return undefined;
    const [first, ...rest] = list;
    const next = chain(rest);
    return next ? { ...first, next: { block: next } } : first;
  };
  const start: Record<string, unknown> = { type: "rr_start", x: 30, y: 30, deletable: false };
  const body = chain(stack);
  if (body) start.next = { block: body };
  return { blocks: { languageVersion: 0, blocks: [start] } };
};
const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });

// ============================================================ M1 — Robot Beginnings

const m1: MissionDef = {
  id: "m1-wake-up",
  worldId: "robot-beginnings",
  order: 1,
  title: "Wake Up, Bolt!",
  kind: "guided",
  editors: ["blocks", "python"],
  story:
    "Your robot companion has just been assembled in the workshop, but its battery is nearly empty. Drive it onto the glowing charging pad so it can power up for the adventures ahead.",
  objective: "Program the robot to drive forward and stop on the charging pad.",
  successCriteria: [
    "Robot ends with its centre on the charging pad",
    "No collisions",
    "Program runs to completion",
  ],
  lesson: [
    {
      title: "What is a robot?",
      body: "A robot is a machine that can SENSE the world, THINK about what to do (a program running on its controller) and ACT (motors that move it). Every mission in ROBOREALM uses this sense → think → act loop.",
    },
    {
      title: "Motors and wheels",
      body: "Motors spin the wheels. One full rotation of a wheel moves the robot one wheel circumference: 2 × π × radius. Bolt's standard wheels have a 3.5 cm radius, so one rotation ≈ 22 cm.",
      code: "distance = rotations × 2 × π × wheel_radius",
    },
    {
      title: "Commands run in order",
      body: "A program is a list of commands that run from top to bottom. 'move forward 1 m' tells the controller to spin both wheels until the robot has travelled exactly 1 metre.",
    },
    {
      title: "Measure first",
      body: "Engineers measure before they act. The floor grid has a line every 0.5 m — use it to measure how far the pad is from the robot's centre.",
    },
  ],
  skills: ["ROB-101", "PRG-101"],
  rewards: { xp: 100, coins: 20 },
  unlockAfter: [],
  starterPython: "# Drive onto the charging pad\nrobot.forward(1)\n",
  starterBlocks: blocks({ type: "rr_forward", inputs: { DIST: num(1) } }),
  hints: [
    "Run the program and watch where the robot stops. Count the grid squares — each one is 0.5 m.",
    "The centre of the charging pad is 2 m in front of the robot's centre. How far does your program move?",
    "Change the move block to 2 metres (in Python: robot.forward(2)), then press Run.",
  ],
  timeLimit: 60,
  scenarioCount: 1,
  parTime: 10,
  buildScenario: () => ({
    name: "Workshop floor",
    world: world(4, 2, {
      zones: [zoneAround("pad", "target", { x: 2.5, y: 1 }, 0.4, "Charging Pad")],
    }),
    start: { x: 0.5, y: 1, theta: 0 },
    info: {},
  }),
  evaluate: (o, s) => [
    endedInZone(o, zoneById(s.world, "pad"), "Stopped on the charging pad"),
    noCollisions(o),
    programFinished(o),
  ],
};

// ============================================================ M2 — Code City

const m2: MissionDef = {
  id: "m2-plaza-patrol",
  worldId: "code-city",
  order: 2,
  title: "Plaza Patrol",
  kind: "guided",
  editors: ["blocks", "python"],
  story:
    "Code City's plaza needs a security patrol. Visit the three checkpoints around the fountain in order — A, B, then C — and return home. The city engineers are short on memory, so your program must use a loop.",
  objective: "Drive a 1 m square around the fountain, visiting checkpoints A → B → C and returning home, using a loop.",
  successCriteria: [
    "Visit checkpoints A, B and C in order",
    "Finish back on the home pad",
    "Program uses a loop",
    "No collisions with the fountain",
  ],
  lesson: [
    {
      title: "Turning on the spot",
      body: "A differential-drive robot turns by spinning its wheels in opposite directions. Turning left 90° points the robot a quarter-turn anticlockwise.",
    },
    {
      title: "Angles of a square",
      body: "A square has four equal sides and four 90° corners. Four 90° turns add up to 360° — a full rotation, so the robot ends up facing the way it started.",
      code: "4 × 90° = 360°",
    },
    {
      title: "Loops",
      body: "When you repeat the same commands, use a loop instead of copying them. Loops make programs shorter, easier to change and less error-prone.",
      code: "for i in range(4):\n    robot.forward(1)\n    robot.turn_left(90)",
    },
  ],
  skills: ["PRG-102", "MTH-101"],
  rewards: { xp: 120, coins: 25 },
  unlockAfter: ["m1-wake-up"],
  starterPython: "# Patrol the plaza: A -> B -> C -> home\nrobot.forward(1)\nrobot.turn_left(90)\n",
  starterBlocks: blocks(
    { type: "rr_forward", inputs: { DIST: num(1) } },
    { type: "rr_turn_left", inputs: { DEG: num(90) } },
  ),
  hints: [
    "Notice that you need the same two moves over and over: drive one side, then turn.",
    "A square has 4 sides and 4 corners of 90°. How many times should the two moves repeat?",
    "Put 'move forward 1 m' and 'turn left 90°' inside a 'repeat 4 times' block (Python: for i in range(4):).",
  ],
  timeLimit: 60,
  scenarioCount: 1,
  parTime: 25,
  codeChecks: [{ id: "loop", label: "Program uses a loop", test: usesLoop }],
  buildScenario: () => ({
    name: "Code City plaza",
    world: world(3, 3, {
      obstacles: [obstacle("fountain", 0.8, 0.8, 0.4, 0.4, { label: "Fountain" })],
      zones: [
        zoneAround("home", "target", { x: 0.5, y: 0.5 }, 0.4, "Home"),
        zoneAround("A", "checkpoint", { x: 1.5, y: 0.5 }, 0.3, "Checkpoint A"),
        zoneAround("B", "checkpoint", { x: 1.5, y: 1.5 }, 0.3, "Checkpoint B"),
        zoneAround("C", "checkpoint", { x: 0.5, y: 1.5 }, 0.3, "Checkpoint C"),
      ],
    }),
    start: { x: 0.5, y: 0.5, theta: 0 },
    info: {},
  }),
  evaluate: (o, s) => [
    visitedInOrder(o, ["A", "B", "C"].map((id) => zoneById(s.world, id))),
    endedInZone(o, zoneById(s.world, "home"), "Returned home"),
    noCollisions(o),
    programFinished(o),
  ],
};

// ============================================================ M3 — Code City (Python)

const M3_TARGETS: Vec2[] = [
  { x: 3.0, y: 2.0 },
  { x: 2.5, y: 0.8 },
  { x: 1.0, y: 2.5 },
  { x: 3.4, y: 2.6 },
];

const m3: MissionDef = {
  id: "m3-coordinate-courier",
  worldId: "code-city",
  order: 3,
  title: "Coordinate Courier",
  kind: "guided",
  editors: ["python"],
  story:
    "A courier drone dropped a delivery beacon somewhere in the depot. The depot computer can tell you the beacon's coordinates, but nobody can tell you the route. Time to write real Python and use some geometry.",
  objective: "Use world.target() and robot.position() to calculate a heading and a distance, then drive to the beacon.",
  successCriteria: [
    "Robot ends within 15 cm of the beacon",
    "Works for beacon positions you have not seen (3 hidden tests)",
    "No collisions",
  ],
  lesson: [
    {
      title: "Coordinates",
      body: "Every point in the depot has an (x, y) coordinate in metres. x grows to the east (right), y grows to the north (up). The robot's heading is measured in degrees: 0° = east, 90° = north.",
    },
    {
      title: "Distance with Pythagoras",
      body: "If the target is dx metres east and dy metres north of you, the straight-line distance is the hypotenuse of a right triangle.",
      code: "distance = math.hypot(dx, dy)   # same as sqrt(dx**2 + dy**2)",
    },
    {
      title: "Direction with atan2",
      body: "math.atan2(dy, dx) gives the angle of the line from you to the target, in radians, measured from east. Convert it to degrees with math.degrees().",
      code: "angle = math.degrees(math.atan2(dy, dx))",
    },
    {
      title: "Python variables",
      body: "Variables store values so you can reuse them: tx, ty = world.target() unpacks the two numbers the function returns into two variables.",
    },
  ],
  skills: ["PRG-201", "MTH-102", "MTH-101"],
  rewards: { xp: 150, coins: 30 },
  unlockAfter: ["m2-plaza-patrol"],
  starterPython: `# Coordinate Courier — drive to the beacon
import math

tx, ty = world.target()      # where the beacon is
x, y = robot.position()      # where the robot is now
print("Beacon:", tx, ty, " Robot:", x, y)

# TODO 1: work out dx and dy (how far east and north the beacon is)
# TODO 2: turn to face the beacon (hint: math.atan2, robot.heading(), robot.turn())
# TODO 3: drive the straight-line distance (hint: math.hypot)
`,
  hints: [
    "Start by printing dx = tx - x and dy = ty - y. Positive dx means the beacon is east of the robot.",
    "The angle to face is math.degrees(math.atan2(dy, dx)). The robot starts facing 0°, so turning by (angle - robot.heading()) points it at the beacon.",
    "Demonstration:\n  dx, dy = tx - x, ty - y\n  angle = math.degrees(math.atan2(dy, dx))\n  robot.turn(angle - robot.heading())\n  robot.forward(math.hypot(dx, dy))",
  ],
  timeLimit: 60,
  scenarioCount: 4,
  parTime: 20,
  buildScenario: (i) => {
    const t = M3_TARGETS[i];
    return {
      name: i === 0 ? "Practice beacon" : `Hidden beacon ${i}`,
      world: world(4, 3, { zones: [zoneAround("beacon", "target", t, 0.3, "Beacon")] }),
      start: { x: 0.5, y: 0.5, theta: 0 },
      info: { target: t },
    };
  },
  evaluate: (o, s) => [
    endedInZone(o, zoneById(s.world, "beacon"), "Reached the beacon (±15 cm)"),
    noCollisions(o),
    programFinished(o),
  ],
};

// ============================================================ M4 — Sensor Jungle

const M4_WALLS = [2.0, 1.3, 2.7, 3.4];

const m4: MissionDef = {
  id: "m4-fog-wall",
  worldId: "sensor-jungle",
  order: 4,
  title: "Through the Fog",
  kind: "guided",
  editors: ["blocks", "python"],
  story:
    "Thick fog rolls through the Sensor Jungle. Somewhere ahead is a stone wall, but its distance changes every time the fog lifts. You can't hard-code the distance — your robot must use its ultrasonic sensor to stop safely 10–30 cm before the wall.",
  objective: "Use the front distance sensor in a loop so the robot stops 10–30 cm from the wall, wherever the wall is.",
  successCriteria: [
    "Stop with a gap of 10–30 cm to the wall",
    "Works for 3 hidden wall positions",
    "No collisions",
  ],
  lesson: [
    {
      title: "How an ultrasonic sensor works",
      body: "It sends a short 'ping' of sound and times the echo. Sound travels ~343 m/s, so distance = speed × time ÷ 2 (the sound goes there and back). Readings are measured from the front of the robot.",
      code: "distance = 343 × echo_time / 2",
    },
    {
      title: "Sensor range",
      body: "Every sensor has limits. This ultrasonic sensor reads up to 2 m; anything further just reports 2.0. A laser rangefinder reaches 4 m.",
    },
    {
      title: "While loops + conditions",
      body: "A while loop repeats AS LONG AS its condition is true. Check the sensor every time around the loop and move in small steps, so the robot can react before it is too late.",
      code: "while robot.distance() > 0.2:\n    robot.forward(0.05)",
    },
  ],
  skills: ["SEN-101", "PRG-103"],
  rewards: { xp: 150, coins: 30 },
  requires: { sensors: [{ name: "front", kind: "distance" }] },
  unlockAfter: ["m3-coordinate-courier"],
  starterPython: `# The fog hides the wall. Use the distance sensor!
d = robot.distance()
print("Distance to wall:", d)
robot.forward(1)
`,
  starterBlocks: blocks({ type: "rr_say", inputs: { TEXT: { block: { type: "rr_distance" } } } }, { type: "rr_forward", inputs: { DIST: num(1) } }),
  hints: [
    "Run the program several times while reading the console: the sensor tells you how far the wall is from the front of the robot.",
    "Use a loop that keeps going while the distance is greater than about 0.2 m, and move a small step (like 5 cm) each time.",
    "Demonstration:\n  while robot.distance() > 0.2:\n      robot.forward(0.05)\n(Blocks: 'repeat while distance > 0.2' containing 'move forward 0.05 m'.)",
  ],
  timeLimit: 60,
  scenarioCount: 4,
  parTime: 20,
  buildScenario: (i) => {
    const D = M4_WALLS[i];
    return {
      name: i === 0 ? "Practice fog" : `Hidden fog ${i}`,
      world: world(4, 1.2, {
        obstacles: [obstacle("wall", D, 0, 0.15, 1.2, { label: "Stone wall" })],
      }),
      start: { x: 0.4, y: 0.6, theta: 0 },
      info: { hidden: { wallX: D } },
    };
  },
  evaluate: (o, s, spec) => {
    const gap = (s.info.hidden!.wallX as number) - (o.finalPose.x + spec.radius);
    return [
      {
        id: "gap",
        label: "Stopped 10–30 cm from the wall",
        passed: gap >= 0.1 && gap <= 0.3,
        detail: `Final gap: ${(gap * 100).toFixed(1)} cm.`,
      },
      noCollisions(o),
      programFinished(o),
    ];
  },
};

// ============================================================ M5 — Troubleshooting work order

const M5_SHELVES = [2.2, 1.6, 2.8, 3.3];
const M5_BIAS = 0.35;

const m5: MissionDef = {
  id: "m5-work-order-007",
  worldId: "sensor-jungle",
  order: 5,
  title: "Work Order #007: The Wandering Bot",
  kind: "debug",
  editors: ["python"],
  story: `WORK ORDER #007 — Jungle Logistics Co. (fictional)
Unit: delivery bot DB-7.
Expected behaviour: drive up to the shelf, stop 10–30 cm away, turn LEFT and drive 1 m into the loading bay.
Reported fault: "DB-7 sometimes doesn't move at all, sometimes crashes into the shelf, and once drove into the restricted robot cell."

Bench test (reference laser vs DB-7 sensor):
  target at 0.50 m → DB-7 reported 0.85 m
  target at 1.00 m → DB-7 reported 1.35 m

Inspect the program and the diagnostics, find every fault, repair it, and verify the repair.`,
  objective: "Find and fix the faults (software AND hardware calibration) so DB-7 parks in the loading bay without collisions or safety violations.",
  successCriteria: [
    "Robot parks in the loading bay (stopped 10–30 cm from the shelf)",
    "Never enters the restricted robot cell",
    "No collisions",
    "Works for 3 hidden shelf positions",
  ],
  lesson: [
    {
      title: "Debug like an engineer",
      body: "1) Reproduce the fault. 2) Observe: read the console, the event log and the diagnostics. 3) Form ONE hypothesis. 4) Change ONE thing. 5) Test again. 6) Record what you learned in your notebook.",
    },
    {
      title: "Systematic sensor error (bias)",
      body: "If a sensor is always wrong by the same amount, it has a bias (an offset). Compare it with a trusted reference measurement to find the offset, then correct for it.",
      code: "true = reported + offset\n# robot.calibrate(\"front\", offset)",
    },
    {
      title: "Restricted areas",
      body: "Industrial robots share space with people and other machines. Restricted cells are marked with hazard stripes; entering one is a safety violation, even if the task is completed.",
    },
  ],
  skills: ["DBG-101", "SEN-102", "SAF-101"],
  rewards: { xp: 200, coins: 40 },
  requires: { sensors: [{ name: "front", kind: "distance" }] },
  unlockAfter: ["m4-fog-wall"],
  diagnostics: true,
  starterPython: `# WORK ORDER #007 — DB-7 control program
# Expected: drive to the shelf, stop 10-30 cm away,
# turn LEFT and drive 1 m into the loading bay.

SAFE_GAP = 0.2

while robot.distance() < SAFE_GAP:     # keep driving until close to the shelf
    robot.forward(0.05)

robot.turn_right(90)                    # face the loading bay
robot.forward(1.0)
`,
  hints: [
    "Fix one fault at a time. Run the program first: does the robot even drive towards the shelf? Read the while-loop condition out loud.",
    "Open the Diagnostics tab: compare 'sensor reported' with 'reference'. The difference is the same every time — that is a calibration bias. Also check which way the loading bay is.",
    "Three faults: (1) the loop should run while distance > SAFE_GAP; (2) the sensor reads 0.35 m too far — call robot.calibrate(\"front\", -0.35) before the loop; (3) the bay is to the LEFT — use robot.turn_left(90).",
  ],
  timeLimit: 60,
  scenarioCount: 4,
  parTime: 20,
  buildScenario: (i, spec) => {
    const D = M5_SHELVES[i];
    const r = spec.radius;
    return {
      name: i === 0 ? "Bay 3 (practice)" : `Hidden bay ${i}`,
      world: world(4, 3, {
        obstacles: [obstacle("shelf", D, 0, 0.3, 1.2, { label: "Shelf" })],
        zones: [
          { id: "cell", kind: "hazard", rect: rect(0, 0, 4, 0.3), label: "Robot Cell (restricted)" },
          { id: "bay", kind: "target", rect: rect(D - 0.3 - r, 1.35, 0.2, 0.6), label: "Loading Bay" },
        ],
      }),
      start: { x: 0.5, y: 0.6, theta: 0 },
      info: { hidden: { shelfX: D } },
      faults: { sensorBias: { front: M5_BIAS } },
    };
  },
  evaluate: (o, s) => [
    endedInZone(o, zoneById(s.world, "bay"), "Parked in the loading bay"),
    noSafetyViolations(o),
    noCollisions(o),
    programFinished(o),
  ],
};

// ============================================================ A1 — Movement assessment

const A1_ROUTES: Vec2[][] = [
  [{ x: 1.5, y: 0.5 }, { x: 1.5, y: 2.0 }, { x: 3.0, y: 2.0 }],
  [{ x: 2.0, y: 1.0 }, { x: 1.0, y: 2.4 }, { x: 3.3, y: 2.5 }],
  [{ x: 3.2, y: 0.6 }, { x: 3.2, y: 2.3 }, { x: 0.8, y: 2.3 }],
  [{ x: 1.0, y: 1.5 }, { x: 2.5, y: 0.7 }, { x: 3.4, y: 1.8 }],
  [{ x: 2.2, y: 2.5 }, { x: 0.9, y: 1.2 }, { x: 2.8, y: 1.0 }],
];

const a1: MissionDef = {
  id: "a1-precision-movement",
  worldId: "code-city",
  order: 6,
  title: "Assessment: Precision Movement",
  kind: "assessment",
  editors: ["python", "blocks"],
  story:
    "INDEPENDENT ASSESSMENT. No hints, no NOVA. The city survey team needs a robot that can visit any list of survey points in order. Your program will be tested on four survey routes you have never seen.",
  objective: "Visit every waypoint from world.waypoints() in order and finish on the last one.",
  successCriteria: [
    "Waypoints reached in order (each within 15 cm)",
    "Finish on the final waypoint",
    "No collisions",
    "Pass at least 3 of 4 hidden routes",
  ],
  lesson: [
    {
      title: "Assessment rules",
      body: "This is an independent assessment: hints are disabled. You may re-read earlier lessons and your notebook. You can test on the practice route as often as you like; submitting runs the hidden routes.",
    },
    {
      title: "Available tools",
      body: "world.waypoints() → list of (x, y). robot.position() → (x, y). robot.heading() → degrees. robot.turn(deg), robot.forward(m).",
    },
  ],
  skills: ["PRG-101", "PRG-102", "PRG-201", "MTH-101", "MTH-102"],
  rewards: { xp: 300, coins: 60 },
  unlockAfter: ["m3-coordinate-courier"],
  starterPython: "# Precision Movement assessment\nimport math\n\npoints = world.waypoints()\nprint(points)\n",
  starterBlocks: blocks(),
  hints: ["Hints are disabled during assessments.", "", ""],
  timeLimit: 120,
  scenarioCount: 5,
  minHiddenPasses: 3,
  parTime: 45,
  buildScenario: (i) => {
    const pts = A1_ROUTES[i];
    return {
      name: i === 0 ? "Practice route" : `Hidden route ${i}`,
      world: world(4, 3, {
        zones: pts.map((p, k) => zoneAround(`wp${k + 1}`, k === pts.length - 1 ? "target" : "checkpoint", p, 0.3, `WP${k + 1}`)),
      }),
      start: { x: 0.5, y: 0.5, theta: 0 },
      info: { waypoints: pts },
    };
  },
  evaluate: (o, s) => {
    const zones = s.world.zones;
    return [visitedInOrder(o, zones), endedInZone(o, zones[zones.length - 1], "Finished on the last waypoint"), noCollisions(o), programFinished(o)];
  },
};

// ============================================================ A2 — Sensor navigation assessment

const A2_LAYOUTS: { D: number; north: boolean }[] = [
  { D: 3.0, north: true },
  { D: 2.4, north: false },
  { D: 3.6, north: true },
  { D: 2.8, north: false },
  { D: 3.3, north: true },
];

const a2: MissionDef = {
  id: "a2-sensor-navigation",
  worldId: "sensor-jungle",
  order: 7,
  title: "Assessment: Junction Explorer",
  kind: "assessment",
  editors: ["python", "blocks"],
  story:
    "INDEPENDENT ASSESSMENT. A jungle tunnel ends at a T-junction. One branch is blocked, the other leads to the exit — and nobody knows which, or how long the tunnel is. Your robot must find out using only its distance sensor.",
  objective: "Drive to the end of the tunnel without touching the wall, find the open branch with the sensor, and park in the exit zone.",
  successCriteria: [
    "Park inside the exit zone",
    "No collisions",
    "Pass at least 3 of 4 hidden tunnels",
  ],
  lesson: [
    {
      title: "Assessment rules",
      body: "Hints are disabled. The tunnel length and the open side change in every hidden test. Only the front sensor is guaranteed — turning the robot lets that sensor look in a new direction.",
    },
  ],
  skills: ["SEN-101", "PRG-103", "AUT-101"],
  rewards: { xp: 300, coins: 60 },
  requires: { sensors: [{ name: "front", kind: "distance" }] },
  unlockAfter: ["m4-fog-wall"],
  starterPython: "# Junction Explorer assessment\n",
  starterBlocks: blocks(),
  hints: ["Hints are disabled during assessments.", "", ""],
  timeLimit: 120,
  scenarioCount: 5,
  minHiddenPasses: 3,
  parTime: 40,
  buildScenario: (i) => {
    const { D, north } = A2_LAYOUTS[i];
    const B = D - 0.7; // where the tunnel walls end and the junction begins
    const obstacles: Obstacle[] = [
      obstacle("end", D, 0, 0.2, 3, { label: "Tunnel end" }),
      obstacle("top", 0, 1.95, B, 1.05, { label: "Rock" }),
      obstacle("bottom", 0, 0, B, 1.05, { label: "Rock" }),
      north ? obstacle("block", B, 0, 0.7, 1.05, { label: "Rockfall" }) : obstacle("block", B, 1.95, 0.7, 1.05, { label: "Rockfall" }),
    ];
    const exit: Zone = {
      id: "exit",
      kind: "target",
      rect: north ? rect(B, 2.4, 0.7, 0.6) : rect(B, 0, 0.7, 0.6),
      label: "Exit",
    };
    return {
      name: i === 0 ? "Practice tunnel" : `Hidden tunnel ${i}`,
      world: world(4, 3, { obstacles, zones: [exit] }),
      start: { x: 0.4, y: 1.5, theta: 0 },
      info: { hidden: { D, open: north ? "north" : "south" } },
    };
  },
  evaluate: (o, s) => [endedInZone(o, zoneById(s.world, "exit"), "Parked in the exit zone"), noCollisions(o), programFinished(o)],
};

// ============================================================ CAPSTONE — Autonomous delivery

interface CapLayout {
  shelves: [number, number, number, number][];
  hazards: [number, number, number, number][];
  unmapped?: [number, number, number, number][];
  pkg: Vec2;
  drop: Vec2;
}

const CAP_LAYOUTS: CapLayout[] = [
  {
    shelves: [[1.4, 0, 0.3, 2.6], [3.0, 1.4, 0.3, 2.6]],
    hazards: [[3.9, 0, 1.1, 1.3]],
    pkg: { x: 2.3, y: 0.7 },
    drop: { x: 4.3, y: 3.3 },
  },
  {
    shelves: [[1.2, 1.2, 0.3, 2.8], [2.8, 0, 0.3, 2.6]],
    hazards: [[0, 3.1, 1.0, 0.9]],
    unmapped: [[1.95, 1.6, 0.3, 0.3]],
    pkg: { x: 2.2, y: 3.3 },
    drop: { x: 4.3, y: 0.7 },
  },
  {
    shelves: [[1.0, 2.8, 0.3, 1.2], [3.6, 0, 0.3, 1.2]],
    hazards: [[2.0, 1.5, 1.0, 1.0]],
    pkg: { x: 4.4, y: 0.6 },
    drop: { x: 0.6, y: 3.4 },
  },
  {
    shelves: [[0.8, 1.3, 3.4, 0.3], [0.8, 2.6, 3.4, 0.3]],
    hazards: [],
    unmapped: [[1.3, 1.95, 0.3, 0.3]],
    pkg: { x: 2.5, y: 2.1 },
    drop: { x: 2.5, y: 3.45 },
  },
  {
    shelves: [[1.8, 0.9, 0.3, 3.1]],
    hazards: [[3.9, 2.6, 1.1, 1.4], [3.9, 0, 1.1, 1.4]],
    pkg: { x: 1.0, y: 3.4 },
    drop: { x: 4.4, y: 2.0 },
  },
  {
    shelves: [[2.2, 0, 0.3, 2.8]],
    hazards: [[0, 1.6, 0.9, 0.8]],
    unmapped: [[3.0, 2.4, 0.3, 0.3]],
    pkg: { x: 3.6, y: 2.0 },
    drop: { x: 0.7, y: 3.3 },
  },
];

const capstone: MissionDef = {
  id: "cap-autonomous-delivery",
  worldId: "autonomous-arena",
  order: 8,
  title: "Capstone: Autonomous Delivery",
  kind: "capstone",
  editors: ["python"],
  story: `CAPSTONE PROJECT — Arena Logistics (fictional client)
The warehouse wants a fully autonomous delivery robot. On every shift the package, drop-off point, shelves and restricted robot cells move around. The warehouse map is usually right, but sometimes a box falls into an aisle and is NOT on the map.

Your robot must, with no human help: navigate to the package, pick it up, carry it to the drop-off zone and release it — without collisions and without ever entering a restricted cell. Your program will be tested on 5 warehouse layouts you have never seen, and you must document your solution in your engineering notebook.`,
  objective: "Program a fully autonomous pick-and-deliver robot that works in unseen warehouse layouts, then document it.",
  successCriteria: [
    "Package delivered in at least 4 of 5 hidden layouts",
    "Zero safety violations in every layout",
    "No collisions in passing layouts",
    "Engineering documentation completed",
  ],
  lesson: [
    {
      title: "Global planning + local sensing",
      body: "Real warehouse robots combine a global planner (a route on the map) with local sensing (what the sensors see right now). The map can be out of date, so sensors are the final word on what is in front of the robot.",
    },
    {
      title: "The warehouse planner",
      body: "world.plan_path(x1, y1, x2, y2) runs an A* search over the warehouse map and returns a list of (x, y) waypoints that keep clear of mapped shelves and restricted cells. It does NOT know about unmapped obstacles.",
      code: "path = world.plan_path(x, y, px, py)\nfor wx, wy in path:\n    ...",
    },
    {
      title: "Reporting obstacles",
      body: "If the sensor finds something the map doesn't know about, report it with world.report_obstacle(x, y) and plan again. The planner will route around it next time.",
    },
    {
      title: "Gripper reach",
      body: "The claw grabs items within 15 cm of the point just in front of the robot. Stop about (robot radius + 6 cm) before the package's centre, facing it, then call robot.pick_up(). robot.radius() tells you the radius.",
    },
    {
      title: "Realistic physics",
      body: "The arena uses realistic physics: the robot accelerates gradually and its wheels are not perfectly matched, so it drifts slightly. Re-check your position and heading as you go instead of assuming every move is perfect.",
    },
  ],
  skills: ["AUT-101", "MAN-101", "SAF-101", "MTH-102", "PRG-201", "DBG-101", "COM-101"],
  rewards: { xp: 600, coins: 150 },
  requires: { sensors: [{ name: "front", kind: "distance" }], gripper: true },
  unlockAfter: ["a1-precision-movement", "a2-sensor-navigation", "m5-work-order-007"],
  starterPython: `# CAPSTONE — Autonomous Delivery
import math

px, py = world.package()
dx_, dy_ = world.dropoff()
print("Package at", px, py, "-> drop-off at", dx_, dy_)
print("Hazards:", world.hazards())

x, y = robot.position()
path = world.plan_path(x, y, px, py)
print("Planned path to package:", path)

# Your autonomous controller goes here.
# Suggested structure:
#   def face(tx, ty): ...
#   def drive_to(tx, ty, stop_short=0): ...   # move in small steps, check robot.distance()
#   def go(tx, ty, stop_short=0): ...         # plan, follow, re-plan if blocked
`,
  hints: [
    "Break the job into small functions: face a point, drive to a point safely, follow a planned path. Test each one on the practice layout.",
    "Drive in short steps (10 cm) and check robot.distance() before each step. If something is closer than your remaining distance and under ~25 cm, stop, report it with world.report_obstacle(...), back up a little and plan again.",
    "Outline: go(px, py, stop_short=robot.radius()+0.06) → robot.pick_up() → go(dropoff, stop_short=robot.radius()+0.06) → robot.drop(). Inside go(): plan_path, then for each waypoint face() and drive_to(); re-aim every step to correct drift.",
  ],
  timeLimit: 240,
  scenarioCount: 6,
  minHiddenPasses: 4,
  parTime: 120,
  requiresDocumentation: true,
  buildScenario: (i) => {
    const L = CAP_LAYOUTS[i];
    const obstacles: Obstacle[] = [
      ...L.shelves.map(([x, y, w, h], k) => obstacle(`shelf${k}`, x, y, w, h, { label: "Shelf" })),
      ...(L.unmapped ?? []).map(([x, y, w, h], k) =>
        obstacle(`box${k}`, x, y, w, h, { label: "Fallen box (not on map)", unmapped: true }),
      ),
    ];
    const zones: Zone[] = [
      ...L.hazards.map(([x, y, w, h], k): Zone => ({ id: `cell${k}`, kind: "hazard", rect: rect(x, y, w, h), label: "Robot Cell" })),
      zoneAround("pickup", "pickup", L.pkg, 0.4, "Pickup"),
      zoneAround("drop", "dropoff", L.drop, 0.6, "Drop-off"),
    ];
    const scenario: BuiltScenario = {
      name: i === 0 ? "Practice warehouse" : `Hidden warehouse ${i}`,
      world: world(5, 4, {
        obstacles,
        zones,
        items: [{ id: "package", kind: "package", x: L.pkg.x, y: L.pkg.y }],
        physics: "realistic",
      }),
      start: { x: 0.5, y: 0.5, theta: 0 },
      info: { package: "package", dropoff: "drop" },
    };
    return scenario;
  },
  evaluate: (o, s): CriterionResult[] => [
    itemDelivered(o, "package", zoneById(s.world, "drop")),
    noSafetyViolations(o),
    noCollisions(o),
    programFinished(o),
  ],
};

export const MISSIONS: MissionDef[] = [m1, m2, m3, m4, m5, a1, a2, capstone];

export function getMission(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}
