import { Link } from "@/components/nav";

const FEATURES = [
  ["Cohorts", "Create classes and groups; students join with a class code — no student email required."],
  ["Assign missions", "Assign missions, assessments and the capstone with due dates."],
  ["Competency tracking", "See each student's Introduced → Advanced mastery per competency, with the underlying evidence."],
  ["Project review", "Read code, replays, notebooks and capstone documentation; leave rubric-based feedback."],
  ["Reports", "Export progress and evidence as CSV/PDF for program reporting."],
  ["Challenges", "Organise engineering challenges and tournaments within a cohort, with moderated sharing."],
];

export default function Educators() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <span className="chip bg-sun/20 text-sun">Planned — not yet available</span>
      <h1 className="mt-3 font-display text-4xl font-bold">Educator & Workforce Portal</h1>
      <p className="mt-3 text-white/75">
        For schools, libraries, STEM programs, community colleges, workforce organisations and robotics clubs. The student experience works today
        without accounts; the portal below is the next phase and requires cloud accounts with role-based access and guardian consent workflows.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {FEATURES.map(([t, d]) => (
          <li key={t} className="panel p-4">
            <h2 className="font-display text-lg font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-white/70">{d}</p>
          </li>
        ))}
      </ul>
      <section className="panel mt-6 p-5 text-sm text-white/75">
        <h2 className="font-display text-lg font-semibold text-white">Frameworks & credentials</h2>
        <p className="mt-2">
          Every competency has a stable ID, description, passing criteria and evidence trail so it can be mapped to recognised education and
          workforce frameworks <em>after appropriate review</em>. ROBOREALM does not currently claim accreditation or certification, and in-game titles
          are game proficiency only.
        </p>
      </section>
      <Link href="/" className="btn btn-primary mt-6">
        Back to ROBOREALM
      </Link>
    </div>
  );
}
