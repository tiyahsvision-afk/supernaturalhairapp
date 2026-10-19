"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "@/components/nav";
import { useState } from "react";
import { Avatar, AVATAR_ACCESSORIES, defaultAvatar, HAIR_COLORS, HAIRS, OUTFITS, SKINS } from "@/components/Avatar";
import { RobotPortrait } from "@/components/RobotArt";
import { playSound } from "@/components/sound";
import { BATTERIES, CHASSIS, CONTROLLERS, DRIVES, MOTORS } from "@/robots/components";
import { designStats, starterDesign, validateDesign, type RobotDesign } from "@/robots/design";
import { useGame } from "@/progress/store";
import type { AgeBand, AvatarConfig, Profile } from "@/progress/types";

const STEPS = ["Welcome", "Call sign", "Avatar", "Build your robot", "Experience"];

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useGame((s) => s.setProfile);
  const saveDesign = useGame((s) => s.saveDesign);
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<AgeBand | "under13" | null>(null);
  const [nickname, setNickname] = useState("");
  const [companion, setCompanion] = useState("Bolt");
  const [avatar, setAvatar] = useState<AvatarConfig>(defaultAvatar());
  const [robot, setRobot] = useState<RobotDesign>({ ...starterDesign(), chassis: "", drive: "", motor: "", battery: "", controller: "" });
  const [exp, setExp] = useState<Profile["experience"]>("new");

  const nickOk = /^[\p{L}\p{N} _-]{2,20}$/u.test(nickname.trim());
  const robotCheck = validateDesign({ ...robot, name: companion });
  const canNext = [age !== null && age !== "under13", nickOk && companion.trim().length >= 2, true, robotCheck.ok, true][step];

  const finish = () => {
    const design = { ...robot, name: companion.trim() };
    saveDesign(design);
    setProfile({
      nickname: nickname.trim(),
      ageBand: age as AgeBand,
      avatar,
      companionName: companion.trim(),
      experience: exp,
      createdAt: new Date().toISOString(),
    });
    playSound("success");
    router.replace("/hub");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Onboarding progress">
        {STEPS.map((s, i) => (
          <li key={s} className={`chip ${i === step ? "bg-lavender text-ink" : i < step ? "bg-mint/25 text-mint" : ""}`} aria-current={i === step ? "step" : undefined}>
            {i < step ? "✔" : i + 1}. {s}
          </li>
        ))}
      </ol>
      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="panel p-6 sm:p-8">
          {step === 0 && (
            <div>
              <h1 className="font-display text-3xl font-bold">Welcome, engineer! 👋</h1>
              <p className="mt-2 text-white/75">
                ROBOREALM is built for ages 13–24. We keep things private: no email, no real name, no photos. Your progress stays in
                this browser.
              </p>
              <fieldset className="mt-6">
                <legend className="font-semibold">How old are you?</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["under13", "13-15", "16-17", "18-24"] as const).map((a) => (
                    <button key={a} className={`btn ${age === a ? "btn-primary" : "btn-ghost"}`} aria-pressed={age === a} onClick={() => setAge(a)}>
                      {a === "under13" ? "Under 13" : a}
                    </button>
                  ))}
                </div>
              </fieldset>
              {age === "under13" && (
                <p className="mt-4 rounded-2xl bg-peach/15 p-4 text-peach" role="alert">
                  ROBOREALM is designed for players 13 and older. Please ask a parent, guardian or teacher about a supervised
                  classroom account (coming with the educator portal).
                </p>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-5">
              <h1 className="font-display text-3xl font-bold">Pick a call sign</h1>
              <label className="grid gap-1">
                <span className="font-semibold">Your call sign</span>
                <input className="field" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="e.g. SparkNova" aria-describedby="nick-help" />
                <span id="nick-help" className="text-sm text-white/60">
                  2–20 letters or numbers. Don&apos;t use your real full name — this is a game name.
                </span>
              </label>
              <label className="grid gap-1">
                <span className="font-semibold">Name your robot companion</span>
                <input className="field" value={companion} onChange={(e) => setCompanion(e.target.value)} maxLength={20} />
              </label>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="grid place-items-center">
                <Avatar a={avatar} size={180} title="Your avatar preview" />
              </div>
              <div className="grid gap-4">
                <h1 className="font-display text-3xl font-bold">Create your avatar</h1>
                <Swatches label="Skin tone" values={SKINS} value={avatar.skin} onPick={(skin) => setAvatar({ ...avatar, skin })} />
                <Options label="Hair" values={HAIRS} value={avatar.hair} onPick={(hair) => setAvatar({ ...avatar, hair })} />
                <Swatches label="Hair colour" values={HAIR_COLORS} value={avatar.hairColor} onPick={(hairColor) => setAvatar({ ...avatar, hairColor })} />
                <Swatches label="Outfit" values={OUTFITS} value={avatar.outfit} onPick={(outfit) => setAvatar({ ...avatar, outfit })} />
                <Options label="Gear" values={AVATAR_ACCESSORIES} value={avatar.accessory} onPick={(accessory) => setAvatar({ ...avatar, accessory })} />
              </div>
            </div>
          )}
          {step === 3 && <AssembleRobot robot={robot} setRobot={setRobot} name={companion} />}
          {step === 4 && (
            <div>
              <h1 className="font-display text-3xl font-bold">How much robotics have you done?</h1>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["new", "Brand new", "Start from the very beginning with guided missions."],
                    ["some", "A little", "Some coding or robotics before. Same path, move fast."],
                    ["experienced", "Experienced", "Placement: independent assessments unlock now, so you can prove what you already know."],
                  ] as const
                ).map(([v, t, d]) => (
                  <button key={v} onClick={() => setExp(v)} aria-pressed={exp === v} className={`panel p-4 text-left transition ${exp === v ? "ring-2 ring-lavender" : "hover:bg-white/10"}`}>
                    <div className="font-display text-lg font-semibold">{t}</div>
                    <div className="mt-1 text-sm text-white/70">{d}</div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-white/60">Progress is based on what you demonstrate, not your age or this choice.</p>
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      <div className="mt-5 flex justify-between">
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Back
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" disabled={!canNext} onClick={() => (playSound("click"), setStep(step + 1))}>
            Next →
          </button>
        ) : (
          <button className="btn btn-go" onClick={finish}>
            Launch ROBOREALM 🚀
          </button>
        )}
      </div>
    </div>
  );
}

function Swatches({ label, values, value, onPick }: { label: string; values: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((c, i) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            aria-pressed={value === c}
            aria-label={`${label} option ${i + 1}`}
            className={`h-9 w-9 rounded-full border-2 ${value === c ? "border-white" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Options<T extends string>({ label, values, value, onPick }: { label: string; values: T[]; value: T; onPick: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button key={v} onClick={() => onPick(v)} aria-pressed={value === v} className={`btn !py-1 text-sm capitalize ${value === v ? "btn-primary" : "btn-ghost"}`}>
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const SLOTS = [
  { key: "chassis", title: "1. Chassis — the frame", why: "Holds every other part. Bigger frames carry more sensors and a gripper.", parts: CHASSIS },
  { key: "drive", title: "2. Drive — wheels or tracks", why: "Turns motor rotation into movement across the floor.", parts: DRIVES },
  { key: "motor", title: "3. Motors — the muscles", why: "Spin the wheels. RPM sets speed, torque sets pulling power.", parts: MOTORS },
  { key: "battery", title: "4. Battery — the power", why: "Stores energy. More watt-hours = longer missions, but more weight.", parts: BATTERIES },
  { key: "controller", title: "5. Controller — the brain", why: "Runs your program and reads the sensors plugged into its ports.", parts: CONTROLLERS },
] as const;

function AssembleRobot({ robot, setRobot, name }: { robot: RobotDesign; setRobot: (r: RobotDesign) => void; name: string }) {
  const complete = validateDesign(robot).ok;
  const stats = complete ? designStats(robot) : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="grid gap-4">
        <h1 className="font-display text-3xl font-bold">Assemble {name || "your robot"}</h1>
        <p className="text-white/70">Every robot needs these five systems. Pick one of each — you can swap parts later in the Workshop.</p>
        {SLOTS.map((slot) => (
          <fieldset key={slot.key}>
            <legend className="font-semibold">{slot.title}</legend>
            <p className="text-sm text-white/60">{slot.why}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {slot.parts.map((p) => {
                const on = robot[slot.key] === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      playSound("click");
                      setRobot({ ...robot, [slot.key]: p.id, ...(slot.key === "chassis" && p.id === "scout" ? { gripper: null } : slot.key === "chassis" ? { gripper: "claw" } : {}) });
                    }}
                    aria-pressed={on}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${on ? "border-lavender bg-lavender/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    title={p.blurb}
                  >
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-white/60">{p.blurb}</div>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p className="text-sm text-white/60">It also comes with a front ultrasonic distance sensor{robot.chassis !== "scout" ? " and a claw gripper" : ""}.</p>
      </div>
      <div className="panel grid content-start justify-items-center gap-3 p-4">
        <RobotPortrait d={complete ? robot : { ...robot, chassis: robot.chassis || "rover" }} size={200} />
        {stats ? (
          <dl className="grid w-full grid-cols-2 gap-1 text-sm">
            <dt className="text-white/60">Top speed</dt>
            <dd>{stats.topSpeed.toFixed(2)} m/s</dd>
            <dt className="text-white/60">Run time</dt>
            <dd>~{stats.runtimeMin} min</dd>
            <dt className="text-white/60">Mass</dt>
            <dd>{stats.massKg} kg</dd>
          </dl>
        ) : (
          <p className="text-center text-sm text-white/60">Choose all five systems to power up.</p>
        )}
      </div>
    </div>
  );
}
