/**
 * Competency catalog. IDs are stable so they can later be mapped (after
 * appropriate review) to external education / workforce frameworks.
 * Nothing here is an accredited credential.
 */

export type SkillCategory =
  | "Programming"
  | "Robotics fundamentals"
  | "Electronics"
  | "Mechanical systems"
  | "Sensors"
  | "AI"
  | "Machine learning"
  | "Autonomous systems"
  | "Industrial automation"
  | "Engineering mathematics"
  | "Safety"
  | "Troubleshooting"
  | "Technical communication";

export interface Competency {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  prerequisites: string[];
  /** Guided missions where the skill is taught and practised. */
  practice: string[];
  /** Independent demonstrations (assessments, capstone, or hint-free debug missions with hidden tests). */
  assessments: string[];
  passingCriteria: string;
  /** Planned competencies are shown in the tree but have no activities yet. */
  planned?: boolean;
}

export const COMPETENCIES: Competency[] = [
  {
    id: "ROB-101",
    name: "Robot anatomy",
    category: "Robotics fundamentals",
    description: "Identify a robot's chassis, drive, motors, power, controller, sensors and actuators and explain what each does.",
    prerequisites: [],
    practice: ["m1-wake-up"],
    assessments: ["cap-autonomous-delivery"],
    passingCriteria: "Configure a robot whose components meet a mission's capability requirements and complete that mission independently.",
  },
  {
    id: "PRG-101",
    name: "Sequencing commands",
    category: "Programming",
    description: "Write a program as an ordered sequence of commands and predict its effect.",
    prerequisites: [],
    practice: ["m1-wake-up"],
    assessments: ["a1-precision-movement"],
    passingCriteria: "Pass at least 3 of 4 hidden routes in the Precision Movement assessment.",
  },
  {
    id: "PRG-102",
    name: "Loops",
    category: "Programming",
    description: "Use counted and conditional loops to repeat behaviour instead of copying code.",
    prerequisites: ["PRG-101"],
    practice: ["m2-plaza-patrol"],
    assessments: ["a1-precision-movement"],
    passingCriteria: "Use a loop to process every waypoint in the Precision Movement assessment.",
  },
  {
    id: "PRG-103",
    name: "Conditions & sensor-driven loops",
    category: "Programming",
    description: "Use if-statements and while-loops that react to sensor values.",
    prerequisites: ["PRG-102", "SEN-101"],
    practice: ["m4-fog-wall"],
    assessments: ["a2-sensor-navigation"],
    passingCriteria: "Choose the open branch using sensor data in at least 3 of 4 hidden tunnels.",
  },
  {
    id: "PRG-201",
    name: "Python fundamentals",
    category: "Programming",
    description: "Write Python with variables, functions, tuples, lists and the math module.",
    prerequisites: ["PRG-102"],
    practice: ["m3-coordinate-courier"],
    assessments: ["a1-precision-movement", "cap-autonomous-delivery"],
    passingCriteria: "Write a reusable Python function that drives to arbitrary coordinates.",
  },
  {
    id: "MTH-101",
    name: "Angles & turning",
    category: "Engineering mathematics",
    description: "Use degrees, headings and turn angles; normalise angles to the shortest turn.",
    prerequisites: [],
    practice: ["m2-plaza-patrol", "m3-coordinate-courier"],
    assessments: ["a1-precision-movement"],
    passingCriteria: "Turn to face arbitrary waypoints accurately in hidden routes.",
  },
  {
    id: "MTH-102",
    name: "Coordinates & distance",
    category: "Engineering mathematics",
    description: "Use (x, y) coordinates, Pythagoras (hypot) and atan2 to compute distance and direction.",
    prerequisites: ["MTH-101"],
    practice: ["m3-coordinate-courier"],
    assessments: ["a1-precision-movement", "cap-autonomous-delivery"],
    passingCriteria: "Reach waypoints within 15 cm in unseen routes.",
  },
  {
    id: "SEN-101",
    name: "Distance sensing",
    category: "Sensors",
    description: "Explain how ultrasonic / laser rangefinders work, their range limits, and use readings to control motion.",
    prerequisites: ["PRG-101"],
    practice: ["m4-fog-wall"],
    assessments: ["a2-sensor-navigation"],
    passingCriteria: "Stop 10–30 cm from walls at unknown distances without collisions.",
  },
  {
    id: "SEN-102",
    name: "Sensor calibration",
    category: "Sensors",
    description: "Detect a systematic sensor bias by comparing with a reference, and correct it.",
    prerequisites: ["SEN-101"],
    practice: ["m5-work-order-007"],
    assessments: ["m5-work-order-007"],
    passingCriteria: "Repair Work Order #007 without hints so it passes all hidden bays.",
  },
  {
    id: "DBG-101",
    name: "Systematic debugging",
    category: "Troubleshooting",
    description: "Reproduce, observe, hypothesise, change one thing, and re-test until the fault is fixed.",
    prerequisites: ["PRG-103"],
    practice: ["m5-work-order-007"],
    assessments: ["m5-work-order-007", "cap-autonomous-delivery"],
    passingCriteria: "Find and fix all faults in a work order without hints, verified by hidden tests.",
  },
  {
    id: "SAF-101",
    name: "Restricted zones & safe operation",
    category: "Safety",
    description: "Respect restricted robot cells, use emergency stop, and treat safety violations as failures.",
    prerequisites: [],
    practice: ["m5-work-order-007"],
    assessments: ["m5-work-order-007", "cap-autonomous-delivery"],
    passingCriteria: "Complete independent tasks with zero safety violations.",
  },
  {
    id: "AUT-101",
    name: "Autonomous navigation",
    category: "Autonomous systems",
    description: "Combine a global plan with local sensing to reach goals in unseen environments.",
    prerequisites: ["PRG-103", "MTH-102"],
    practice: ["a2-sensor-navigation"],
    assessments: ["a2-sensor-navigation", "cap-autonomous-delivery"],
    passingCriteria: "Navigate unseen layouts, including unmapped obstacles, without collisions.",
  },
  {
    id: "MAN-101",
    name: "Pick and place",
    category: "Mechanical systems",
    description: "Position a robot accurately to grip, carry and release objects.",
    prerequisites: ["MTH-102"],
    practice: [],
    assessments: ["cap-autonomous-delivery"],
    passingCriteria: "Deliver the package in at least 4 of 5 unseen warehouse layouts.",
  },
  {
    id: "COM-101",
    name: "Technical documentation",
    category: "Technical communication",
    description: "Document an engineering project: objective, approach, testing, problems, results and improvements.",
    prerequisites: [],
    practice: [],
    assessments: ["cap-autonomous-delivery"],
    passingCriteria: "Complete every section of the capstone engineering documentation.",
  },
  // ------------------------------------------------------------ planned (future worlds)
  {
    id: "ELE-101",
    name: "Voltage, current & resistance",
    category: "Electronics",
    description: "Apply Ohm's law and power calculations to robot circuits.",
    prerequisites: [],
    practice: [],
    assessments: [],
    passingCriteria: "Planned: Circuit Island missions.",
    planned: true,
  },
  {
    id: "AI-101",
    name: "What is AI?",
    category: "AI",
    description: "Distinguish rule-based programs from learned models and explain human oversight.",
    prerequisites: [],
    practice: [],
    assessments: [],
    passingCriteria: "Planned: AI Academy missions.",
    planned: true,
  },
  {
    id: "ML-101",
    name: "Training a classifier",
    category: "Machine learning",
    description: "Collect and label data, train, test, and evaluate accuracy, precision and recall.",
    prerequisites: ["AI-101"],
    practice: [],
    assessments: [],
    passingCriteria: "Planned: AI Academy lab.",
    planned: true,
  },
  {
    id: "IND-101",
    name: "Conveyors & PLC logic",
    category: "Industrial automation",
    description: "Read and write simple ladder logic to control a conveyor cell.",
    prerequisites: [],
    practice: [],
    assessments: [],
    passingCriteria: "Planned: Factory Frontier work orders.",
    planned: true,
  },
];

export function getCompetency(id: string) {
  return COMPETENCIES.find((c) => c.id === id);
}
