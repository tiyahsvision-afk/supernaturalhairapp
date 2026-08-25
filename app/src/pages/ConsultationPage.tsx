import { useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import GlowCard from '@/components/layout/GlowCard'
import ConsultationWizard from '@/components/consultation/ConsultationWizard'
import ConsultationResults from '@/components/consultation/ConsultationResults'
import { useAppStore } from '@/store/useAppStore'
import type { ConsultationAnswers } from '@/lib/types'

export default function ConsultationPage() {
  const consultations = useAppStore((s) => s.consultations)
  const submitConsultation = useAppStore((s) => s.submitConsultation)
  const latest = consultations[0]
  const [mode, setMode] = useState<'results' | 'wizard'>(latest ? 'results' : 'wizard')

  function handleComplete(answers: ConsultationAnswers) {
    submitConsultation(answers)
    setMode('results')
  }

  return (
    <PageShell>
      <SectionHeading
        eyebrow="Digital Consultation"
        title="Know exactly what to use, and when"
        description="A quick consultation tuned to your hair type, porosity, scalp, and goals — update it any time your routine or hair changes."
      />

      <div className="mt-10">
        {mode === 'wizard' ? (
          <ConsultationWizard
            initialAnswers={latest?.answers}
            onCancel={latest ? () => setMode('results') : undefined}
            onComplete={handleComplete}
          />
        ) : (
          latest && <ConsultationResults result={latest} onRetake={() => setMode('wizard')} />
        )}
      </div>

      {consultations.length > 1 && mode === 'results' && (
        <div className="mt-10">
          <h3 className="mb-3 text-sm font-semibold text-ink-900/70">Consultation history</h3>
          <div className="space-y-2">
            {consultations.slice(1).map((c) => (
              <GlowCard key={c.id} className="flex items-center justify-between !p-4">
                <span className="text-sm text-ink-900/60">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
                <span className="text-xs text-ink-900/40">{c.answers.mainGoal.replace('-', ' ')}</span>
              </GlowCard>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  )
}
