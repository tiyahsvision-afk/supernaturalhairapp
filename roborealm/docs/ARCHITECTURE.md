# ROBOREALM architecture & phased plan

## 1. Principles

1. **The engine decides, the UI displays.** All success is computed by the deterministic
   simulation and graders (`src/engine`, `src/missions`). The UI has no way to mark something passed.
2. **Real code, really executed.** Student Python runs in Pyodide (CPython compiled to WebAssembly).
   Every `robot.*` call advances the simulation. Blocks compile to the same Python.
3. **Two separate progressions.** Game progression (XP, levels, coins, achievements, cosmetics)
   and technical mastery (evidence-based) never feed into each other. Coins buy cosmetics only.
4. **Local-first and private by default.** No account, no PII, no network calls for gameplay.
5. **Honest extension points.** Planned features are labelled as planned, not faked.

## 2. Module map

```
src/
  engine/        Pure TS, no DOM. Runs in browser, worker and Node identically.
    sim.ts         Fixed-timestep (20 ms) differential-drive simulation: kinematics, accel limits
                   (realistic mode), collisions, ray-cast distance/touch/floor sensors, seeded noise,
                   sensor bias faults + calibration, motor polarity faults, battery drain, gripper,
                   hazard-zone safety violations, e-stop, event log, frame recording, metrics.
    planner.ts     Occupancy grid + A* + line-of-sight smoothing (the "warehouse planner").
    geometry.ts    Ray/AABB, circle/AABB, segment tests.   rng.ts  Seeded PRNG (mulberry32).
  robots/        Component catalog + design validation + deriveSpec() (design → physical capabilities).
  missions/      Mission definitions, scenario builders (practice + hidden), per-scenario criteria,
                 gradeMission() rubric (correctness / safety / efficiency / independence, safety gate).
  runtime/
    robotApiPy.ts  Python robot/world API, import allow-list, builtin removal, sys.settrace line budget.
    runner.ts      Bridges Python ↔ engine; records step trace (line, variables, frame range) and output.
    missionRunner  Runs scenarios; hides hidden-layout replays for assessments.
    py.worker.ts   Web Worker hosting Pyodide + engine.   client.ts  Main-thread client with wall-clock kill switch.
  progress/      Save-state types, pure rules (rewards, levels, mastery, documentation, daily quest),
                 Zustand store persisted to localStorage.
  content/       Competency catalog, worlds, NOVA rules (error explanations, code review, struggle tracking).
  components/    SimCanvas (2.5D renderer), BlocklyEditor, CodeEditor (Monaco), avatar/robot art, UI kit.
  app/           Next.js App Router pages + /api/nova (optional LLM tutor).
```

### Execution model ("simulate, then replay")

Run → the worker executes the whole program against the engine (fast, headless) and returns
frames + events + a trace. The canvas replays the frames, and the step controls jump between
recorded robot commands, highlighting the Python line and showing variables at that moment.
Grading uses the same engine outcomes. Each robot API call (including sensor reads) costs at
least one simulation tick, so busy-wait loops still hit the simulated time limit.

### Execution limits (defence in depth)

| Layer | Limit |
|---|---|
| Python | Line budget via `sys.settrace` (3M lines) → `StepLimit`; limits are `BaseException`s, so `except Exception` can't swallow them |
| Engine | Simulated-time limit per mission; 20k robot-call budget |
| Worker | Wall-clock timeout (60 s test / 180 s submit) → worker terminated and respawned |
| Sandbox | Import allow-list (math, random, collections, …), `open/eval/exec/input/...` removed, fresh namespace per run, seeded `random` |

**Limitation:** an in-interpreter Python sandbox is not a security boundary. The real boundary is
that code runs only in the student's own browser, in a Web Worker with no DOM, no cookies of
value and no secrets. **Before running anyone else's shared code**, add an isolated runner
(sandboxed iframe with `connect-src 'none'` CSP, or a server-side microVM service). Arbitrary
Python must never run in a standard serverless function.

## 3. Mastery model

`Introduced → Practicing → Proficient → Advanced`, computed only from evidence records:

- Introduced: opened a mission teaching the skill
- Practicing: passed a guided mission
- Proficient: passed an independent demonstration listed for that competency: an assessment,
  the capstone, or a troubleshooting work order with hidden tests **and zero hints**
- Advanced: proficient plus the capstone, or an assessment score ≥ 90

Assessments disable hints and NOVA chat (also enforced server-side in `/api/nova`), and their
hidden layouts are never sent back to the UI.

## 4. Phased plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Engine, Python/Blocks runtime, 5 missions, 2 assessments, capstone, workshop, skill tree, notebook, portfolio, NOVA (deterministic + optional LLM) | **Done (this release)** |
| 2 | Cloud accounts (Supabase Auth + Postgres, RLS), guardian-consent flow for under-13/where required, cross-device sync | Schema in `supabase/schema.sql` |
| 3 | Circuit Island (electronics workbench, Ohm's law validation, Arduino-style programs) | Planned: competency `ELE-101` |
| 4 | AI Academy (TensorFlow.js training, labelling, precision/recall, bias) + Smart Recycling robot (perception → decision → action) | Planned: `AI-101`, `ML-101` |
| 5 | Factory Frontier (conveyors, ladder logic, HMI, work orders, LOTO) + Phaser/R3F 3D labs | Planned: `IND-101` |
| 6 | Career pathways & simulated career quests, Inventor's Universe sandbox, ROS 2 concepts | Planned |
| 7 | Educator & workforce portal (cohorts, assignments, evidence review, exports), moderated sharing | Planned: `/educators` page describes it |

## 5. Extension points

- **New mission:** add a `MissionDef` in `src/missions/missions.ts` (scenario builder + evaluator),
  map skills in `src/content/competencies.ts`, and add a reference-solution test in `tests/missions.test.ts`.
- **New component:** add it to `src/robots/components.ts` and use its fields in `deriveSpec()`.
- **New sensor kind:** add a `SensorKind`, implement the read in `Simulation`, expose it in `robotApiPy.ts` and `runner.ts`.
- **Cloud persistence:** implement a storage adapter for the Zustand `persist` middleware in
  `src/progress/store.ts` backed by `supabase/schema.sql`. Keep localStorage as the offline cache.
- **3D labs:** `SimCanvas` only consumes `Frame`s. A React Three Fiber renderer can consume the same frames.
- **Isolated execution service:** implement the same `PyodideLike` contract (`runner.ts`) server-side in a microVM.
- **NOVA LLM:** `/api/nova` (Claude API). It coaches only, gets no profile data, is rate-limited, and
  has no effect on grading.

## 6. Privacy & safety

- Collected: call sign, age band (no birthdate), stylised avatar, robots, code, progress. Stored
  only in localStorage. Under-13 users are stopped at onboarding.
- No messaging, no public profiles, no publishing. Export, import and delete-all are in Settings.
- Safety violations (restricted zones) fail any mission automatically. Students are never
  rewarded for bypassing safety.
- Accessibility: keyboard-operable controls, a skip link, ARIA roles for tabs, dialog, log and
  progress bars, pass/fail markers that use both icon and text, reduced-motion and high-contrast
  modes, and a text Python editor as an alternative to drag-and-drop blocks.
