import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import PhotoUploadForm from '@/components/progress/PhotoUploadForm'
import ProgressTimeline from '@/components/progress/ProgressTimeline'

export default function ProgressPage() {
  return (
    <PageShell>
      <SectionHeading
        eyebrow="Progress"
        title="Watch your journey unfold"
        description="Snap a photo daily or weekly to build a private timeline of your progress — and earn rewards points every time you share one."
      />
      <div className="mt-10 space-y-8">
        <PhotoUploadForm />
        <ProgressTimeline />
      </div>
    </PageShell>
  )
}
