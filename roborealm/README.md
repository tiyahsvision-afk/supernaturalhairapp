# ROBOREALM

A robotics & AI career-training simulator disguised as an adventure game, for ages 13–24.
Students build virtual robots, program them with blocks and real Python, read simulated
sensors, debug faulty hardware and software, and prove their skills on scenarios they have
never seen. No physical equipment needed.

> **Status: initial learning pathway (Phase 1).** Five worlds' worth of content is planned.
> This release ships one complete, working journey:
> **Beginner robotics → Programming → Sensor navigation → Troubleshooting → Autonomous capstone.**

## Quick start

```bash
cd roborealm
npm install        # also copies the Pyodide + Monaco runtimes into public/
npm run dev        # http://localhost:3000
npm test           # 79 tests: engine, Python sandbox, missions, grading, progression
npm run build      # production build
```

Node 20+ recommended. Everything runs in the browser; no database or API key is required.
The optional NOVA chat tutor uses the Claude API when `ANTHROPIC_API_KEY` is set on the server.

## What's playable

| # | World | Mission | Type | Teaches |
|---|---|---|---|---|
| 1 | Robot Beginnings | Wake Up, Bolt! | Guided (blocks/Python) | Robot anatomy, sequencing |
| 2 | Code City | Plaza Patrol | Guided — loop required | Loops, angles |
| 3 | Code City | Coordinate Courier | Guided Python, 3 hidden tests | Python, coordinates, atan2/hypot |
| 4 | Sensor Jungle | Through the Fog | Guided, 3 hidden walls | Distance sensors, while-loops |
| 5 | Sensor Jungle | Work Order #007 | Troubleshooting, 3 hidden bays | Debugging, sensor calibration, safety zones |
| A1 | Code City | Precision Movement | **Independent assessment** (no hints) | Movement, loops, maths |
| A2 | Sensor Jungle | Junction Explorer | **Independent assessment** | Sensor-driven decisions |
| C | Autonomous Arena | Autonomous Delivery | **Capstone**: 5 unseen warehouses, realistic physics, unmapped obstacles, required documentation | Planning + sensing + manipulation |

Every mission has an objective, interactive lesson cards, a working simulation, three
progressive hints, deterministic success criteria, failure feedback, skill mapping and rewards.
Each one is proven solvable by a reference solution in the test suite, and the tests also show
that starter code, empty programs and hard-coded solutions fail.

Also included: onboarding (age band, call sign, avatar, robot assembly, placement), a world map,
a Robot Workshop (garage, parts that change physics, sensor mounts, comparison, cosmetics shop),
a skill tree with evidence, an auto-generated engineering notebook, an exportable portfolio
(print-to-PDF, `.py`, robot configs, results JSON), settings (reduced motion, high contrast, sound)
and privacy controls (export, import, delete all data).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design, the phased plan and the extension points.

## Honesty notes

- Physics is a **simplified teaching model** (labelled in the UI). It isn't industrial-grade.
- Titles like "Junior Technician" are **in-game ranks**, not credentials. ROBOREALM does not
  claim accreditation. Simulated work orders and clients are fictional and are not internships.
- Virtual practice does not replace supervised training on physical robots.
