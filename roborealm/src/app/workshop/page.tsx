"use client";

import { useState } from "react";
import { RobotPortrait, RobotTopDown } from "@/components/RobotArt";
import { playSound } from "@/components/sound";
import { ConfirmButton, PageTitle } from "@/components/ui";
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
  type Part,
} from "@/robots/components";
import { designStats, validateDesign, type RobotDesign } from "@/robots/design";
import { newId, useGame } from "@/progress/store";

const SLOTS: { key: "chassis" | "drive" | "motor" | "battery" | "controller"; label: string; parts: Part[] }[] = [
  { key: "chassis", label: "Chassis", parts: CHASSIS },
  { key: "drive", label: "Drive", parts: DRIVES },
  { key: "motor", label: "Motors", parts: MOTORS },
  { key: "battery", label: "Battery", parts: BATTERIES },
  { key: "controller", label: "Controller", parts: CONTROLLERS },
];

function specLine(p: Part): string {
  switch (p.category) {
    case "chassis":
      return `r ${(p.radius * 100).toFixed(0)} cm · ${p.sensorSlots} sensor slots · ${p.gripperMount ? "gripper mount" : "no gripper"} · ${p.massKg} kg`;
    case "drive":
      return `wheel r ${(p.wheelRadius * 1000).toFixed(0)} mm · efficiency ${p.efficiency} · grip ${p.grip}`;
    case "motor":
      return `${p.rpm} RPM · ${p.torqueNm} N·m · ${p.powerW} W`;
    case "battery":
      return `${p.capacityWh} Wh · ${p.massKg} kg`;
    case "controller":
      return `${p.sensorPorts} ports · ${p.idleW} W idle`;
    case "sensor":
      return p.kind === "distance" ? `range ${p.range} m · noise ±${(p.noise * 1000).toFixed(0)} mm` : p.kind;
    default:
      return "";
  }
}

export default function Workshop() {
  const s = useGame();
  const [editing, setEditing] = useState<RobotDesign>(() => s.garage.find((g) => g.id === s.activeRobotId) ?? s.garage[0]);
  const [rotation, setRotation] = useState(0);
  const [compareId, setCompareId] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const check = validateDesign(editing);
  const stats = designStats(editing);
  const compare = s.garage.find((g) => g.id === compareId && g.id !== editing.id);
  const owned = (id: string) => s.game.ownedCosmetics.includes(id);

  const save = () => {
    try {
      s.saveDesign(editing);
      s.setActiveRobot(editing.id);
      setMsg(`${editing.name} saved and set as your active robot.`);
      playSound("success");
    } catch (e) {
      setMsg((e as Error).message);
      playSound("fail");
    }
  };

  const setSensorAt = (mount: MountId, part: string | null) => {
    const others = editing.sensors.filter((x) => x.mount !== mount);
    setEditing({ ...editing, sensors: part ? [...others, { part, mount }] : others });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <PageTitle title="Robot Workshop" sub="Every functional part changes how your robot performs in the simulator. Cosmetics are just for style.">
        <div className="flex gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => {
              const copy = { ...editing, id: newId("robot"), name: `${editing.name} II` };
              setEditing(copy);
              setMsg("Editing a copy — save to add it to your garage.");
            }}
          >
            Duplicate
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!check.ok}>
            Save robot
          </button>
        </div>
      </PageTitle>
      {msg && (
        <p className="mb-4 rounded-2xl bg-white/10 p-3 text-sm" role="status">
          {msg}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)_340px]">
        <aside className="panel h-fit p-4" aria-label="Garage">
          <h2 className="font-display text-lg font-bold">🏠 Garage</h2>
          <ul className="mt-3 grid gap-2">
            {s.garage.map((g) => (
              <li key={g.id}>
                <button
                  className={`flex w-full items-center gap-2 rounded-2xl p-2 text-left ${g.id === editing.id ? "bg-white/15" : "hover:bg-white/10"}`}
                  onClick={() => setEditing(g)}
                  aria-pressed={g.id === editing.id}
                >
                  <RobotPortrait d={g} size={44} />
                  <span>
                    <span className="block font-semibold">{g.name}</span>
                    {g.id === s.activeRobotId && <span className="text-xs text-mint">● Active</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {s.garage.length > 1 && (
            <ConfirmButton
              className="btn btn-ghost mt-3 w-full !py-1 text-sm"
              label="Delete selected"
              confirmLabel={`Click again to delete ${editing.name}`}
              onConfirm={() => {
                s.deleteDesign(editing.id);
                setEditing(s.garage.find((g) => g.id !== editing.id)!);
              }}
            />
          )}
        </aside>

        <section className="grid gap-4" aria-label="Builder">
          <label className="panel grid gap-1 p-4">
            <span className="text-sm font-semibold">Robot name</span>
            <input className="field" value={editing.name} maxLength={20} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          {SLOTS.map((slot) => (
            <fieldset key={slot.key} className="panel p-4">
              <legend className="sr-only">{slot.label}</legend>
              <h3 className="font-display text-lg font-semibold">{slot.label}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {slot.parts.map((p) => {
                  const on = editing[slot.key] === p.id;
                  return (
                    <button
                      key={p.id}
                      aria-pressed={on}
                      onClick={() => {
                        playSound("click");
                        setEditing({ ...editing, [slot.key]: p.id });
                      }}
                      className={`rounded-2xl border p-3 text-left text-sm transition ${on ? "border-lavender bg-lavender/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    >
                      <div className="font-semibold">
                        {on ? "✔ " : ""}
                        {p.name}
                      </div>
                      <div className="text-xs text-white/65">{p.blurb}</div>
                      <div className="mt-1 font-mono text-[11px] text-sky">{specLine(p)}</div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset className="panel p-4">
            <legend className="sr-only">Sensors</legend>
            <h3 className="font-display text-lg font-semibold">Sensors</h3>
            <p className="text-sm text-white/60">
              Sensors are named by where they are mounted: <code>robot.distance(&quot;left&quot;)</code> reads the left one. Ports used: {stats.sensorPortsUsed} /{" "}
              {stats.sensorPortsTotal}.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(Object.keys(MOUNTS) as MountId[]).map((mount) => {
                const cur = editing.sensors.find((x) => x.mount === mount);
                return (
                  <label key={mount} className="grid gap-1 text-sm">
                    <span className="font-semibold">{MOUNTS[mount].label} mount</span>
                    <select className="field" value={cur?.part ?? ""} onChange={(e) => setSensorAt(mount, e.target.value || null)}>
                      <option value="">— empty —</option>
                      {SENSORS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({specLine(p)})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!editing.gripper}
                onChange={(e) => setEditing({ ...editing, gripper: e.target.checked ? GRIPPERS[0].id : null })}
                className="h-4 w-4 accent-lavender"
              />
              {GRIPPERS[0].name} — {GRIPPERS[0].blurb}
            </label>
          </fieldset>

          <fieldset className="panel p-4">
            <legend className="sr-only">Style</legend>
            <h3 className="font-display text-lg font-semibold">Style (cosmetic only)</h3>
            <p className="text-sm text-white/60">Robo Coins buy looks, never performance or mastery. You have 🪙 {s.game.coins}.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[...PAINTS, ...ACCESSORIES].map((c) => {
                const have = owned(c.id);
                const on = editing.paint === c.id || editing.accessory === c.id;
                return (
                  <button
                    key={c.id}
                    className={`chip !py-1.5 ${on ? "ring-2 ring-white" : ""}`}
                    style={c.color ? { background: `${c.color}33` } : undefined}
                    aria-pressed={on}
                    onClick={() => {
                      if (!have) {
                        try {
                          s.buyCosmetic(c.id);
                          playSound("coin");
                        } catch (e) {
                          setMsg((e as Error).message);
                          return;
                        }
                      }
                      setEditing({ ...editing, [c.category === "paint" ? "paint" : "accessory"]: c.id });
                    }}
                  >
                    {c.color && <span className="h-3 w-3 rounded-full" style={{ background: c.color }} aria-hidden />}
                    {c.name} {!have && `· 🪙${c.price}`}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <aside className="grid h-fit gap-4" aria-label="Inspection">
          <div className="panel grid justify-items-center p-4">
            <RobotPortrait d={editing} size={190} />
            <RobotTopDown d={editing} rotation={rotation} size={230} />
            <label className="mt-2 w-full text-sm">
              Rotate view: {rotation}°
              <input type="range" min={-180} max={180} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-sky" />
            </label>
          </div>
          <div className="panel p-4">
            <h3 className="font-display text-lg font-semibold">Specifications</h3>
            {check.ok ? (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-white/55">
                    <th className="text-left font-normal">Stat</th>
                    <th className="text-right font-normal">{editing.name}</th>
                    {compare && <th className="text-right font-normal">{compare.name}</th>}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Top speed (m/s)", (d: RobotDesign) => designStats(d).topSpeed.toFixed(2)],
                      ["Turn rate (°/s)", (d: RobotDesign) => designStats(d).turnRateDegPerSec],
                      ["Run time (min)", (d: RobotDesign) => designStats(d).runtimeMin],
                      ["Mass (kg)", (d: RobotDesign) => designStats(d).massKg],
                      ["Payload (kg)", (d: RobotDesign) => designStats(d).payloadKg],
                      ["Sensors", (d: RobotDesign) => d.sensors.length],
                      ["Gripper", (d: RobotDesign) => (d.gripper ? "yes" : "no")],
                    ] as [string, (d: RobotDesign) => string | number][]
                  ).map(([label, f]) => (
                    <tr key={label} className="border-t border-white/5">
                      <th scope="row" className="py-1 text-left font-normal text-white/70">
                        {label}
                      </th>
                      <td className="text-right font-mono">{f(editing)}</td>
                      {compare && <td className="text-right font-mono text-white/70">{f(compare)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ul className="mt-2 list-disc pl-5 text-sm text-danger">
                {check.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {check.warnings.map((w) => (
              <p key={w} className="mt-2 text-sm text-sun">
                ⚠ {w}
              </p>
            ))}
            {s.garage.length > 1 && (
              <label className="mt-3 grid gap-1 text-sm">
                Compare with
                <select className="field" value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                  <option value="">—</option>
                  {s.garage
                    .filter((g) => g.id !== editing.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <p className="mt-3 text-xs text-white/45">Simplified teaching model — values are illustrative, not manufacturer data.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
