import { useState } from 'react'
import GlowCard from '@/components/layout/GlowCard'
import OptionGrid from './OptionGrid'
import {
  DEFAULT_ANSWERS,
  GOAL_OPTIONS,
  HAIR_TYPE_OPTIONS,
  POROSITY_OPTIONS,
  SCALP_OPTIONS,
  WASH_OPTIONS,
} from '@/lib/consultation'
import type { ConsultationAnswers } from '@/lib/types'

interface ConsultationWizardProps {
  initialAnswers?: ConsultationAnswers
  onComplete: (answers: ConsultationAnswers) => void
  onCancel?: () => void
}

const STEP_TITLES = [
  'What is your hair type?',
  'How would you describe your porosity?',
  "How's your scalp lately?",
  "What's your main goal right now?",
  'How often do you wash?',
  'A couple more details',
]

export default function ConsultationWizard({
  initialAnswers,
  onComplete,
  onCancel,
}: ConsultationWizardProps) {
  const [answers, setAnswers] = useState<ConsultationAnswers>(initialAnswers ?? DEFAULT_ANSWERS)
  const [step, setStep] = useState(0)
  const lastStep = STEP_TITLES.length - 1

  function patch<K extends keyof ConsultationAnswers>(key: K, value: ConsultationAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }))
  }

  function next() {
    if (step === lastStep) {
      onComplete(answers)
      return
    }
    setStep((s) => Math.min(s + 1, lastStep))
  }

  function back() {
    if (step === 0) {
      onCancel?.()
      return
    }
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <GlowCard className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-1.5">
        {STEP_TITLES.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-gradient-to-r from-sky-400 to-fuchsia-400' : 'bg-ink-900/10'
            }`}
          />
        ))}
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-600">
        Step {step + 1} of {STEP_TITLES.length}
      </p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink-900 sm:text-2xl">
        {STEP_TITLES[step]}
      </h2>

      <div className="mt-6">
        {step === 0 && (
          <OptionGrid options={HAIR_TYPE_OPTIONS} value={answers.hairType} onChange={(v) => patch('hairType', v)} />
        )}
        {step === 1 && (
          <OptionGrid options={POROSITY_OPTIONS} value={answers.porosity} onChange={(v) => patch('porosity', v)} />
        )}
        {step === 2 && (
          <OptionGrid options={SCALP_OPTIONS} value={answers.scalpCondition} onChange={(v) => patch('scalpCondition', v)} />
        )}
        {step === 3 && (
          <OptionGrid options={GOAL_OPTIONS} value={answers.mainGoal} onChange={(v) => patch('mainGoal', v)} />
        )}
        {step === 4 && (
          <OptionGrid options={WASH_OPTIONS} value={answers.washFrequency} onChange={(v) => patch('washFrequency', v)} />
        )}
        {step === 5 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => patch('usesHeatOrProtectiveStyles', !answers.usesHeatOrProtectiveStyles)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                answers.usesHeatOrProtectiveStyles
                  ? 'border-fuchsia-300 bg-fuchsia-400/15 text-ink-900'
                  : 'border-ink-900/15 bg-ink-900/5 text-ink-900/70'
              }`}
            >
              {answers.usesHeatOrProtectiveStyles ? '✓ ' : ''}I regularly use heat styling or protective styles
            </button>
            <div>
              <label htmlFor="notes" className="mb-1 block text-sm font-medium text-ink-900/80">
                Anything else we should know? (optional)
              </label>
              <textarea
                id="notes"
                value={answers.notes}
                onChange={(e) => patch('notes', e.target.value)}
                rows={3}
                placeholder="e.g. sensitive scalp, postpartum shedding, trying to transition..."
                className="w-full rounded-xl border border-ink-900/15 bg-ink-900/5 px-4 py-2.5 text-ink-900 placeholder:text-ink-900/30 outline-none focus:border-fuchsia-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          className="rounded-full border border-ink-900/15 px-5 py-2.5 text-sm font-medium text-ink-900/70 hover:text-ink-900"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          type="button"
          onClick={next}
          className="rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-lavender-400 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:scale-105 transition-transform"
        >
          {step === lastStep ? 'See my plan' : 'Next'}
        </button>
      </div>
    </GlowCard>
  )
}
