"use client";

import { Link, useRouter } from "@/components/nav";
import { useEffect } from "react";
import { motion } from "motion/react";
import { RobotPortrait } from "@/components/RobotArt";
import { starterDesign } from "@/robots/design";
import { useGame } from "@/progress/store";

const PILLARS = [
  { icon: "🔧", title: "Build", text: "Assemble robots from real component types. Every part changes how the robot behaves." },
  { icon: "🧩", title: "Program", text: "Start with blocks, graduate to real Python running in a secure sandbox." },
  { icon: "📡", title: "Sense", text: "Read simulated sensors, handle noise and calibrate faulty hardware." },
  { icon: "🐞", title: "Debug", text: "Work orders with real faults. Find them, fix them, verify the repair." },
  { icon: "🏁", title: "Prove", text: "Independent assessments on scenarios you've never seen — no hints." },
  { icon: "📓", title: "Document", text: "An engineering notebook and an exportable portfolio of your work." },
];

export function Landing() {
  const profile = useGame((s) => s.profile);
  const router = useRouter();
  useEffect(() => {
    if (profile) router.replace("/hub");
  }, [profile, router]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="chip bg-mint/20 text-mint">Ages 13–24 · no hardware needed</span>
          <h1 className="mt-4 font-display text-5xl font-bold leading-tight sm:text-6xl">
            <span className="bg-gradient-to-r from-lavender via-sky to-mint bg-clip-text text-transparent">ROBOREALM</span>
            <br />
            Build the future. Literally.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/75">
            A robotics and AI career-training simulator disguised as an adventure game. Build robots, write real code, debug
            real faults, and prove your skills on challenges you&apos;ve never seen.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboarding" className="btn btn-primary text-lg">
              Start your adventure →
            </Link>
            <Link href="/educators" className="btn btn-ghost">
              For educators
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/55">
            Your progress is saved only in this browser. No email, no real name, no tracking.
          </p>
        </motion.div>
        <div className="relative grid place-items-center">
          <div className="absolute h-72 w-72 rounded-full bg-lavender/30 blur-3xl" aria-hidden />
          <div className="float relative">
            <RobotPortrait d={starterDesign()} size={280} title="Bolt, a friendly purple robot" />
          </div>
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            className="panel p-5"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="text-3xl" aria-hidden>
              {p.icon}
            </div>
            <h2 className="mt-2 font-display text-xl font-semibold">{p.title}</h2>
            <p className="mt-1 text-white/70">{p.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
