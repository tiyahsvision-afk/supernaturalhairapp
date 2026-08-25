import PageShell from '@/components/layout/PageShell'
import SectionHeading from '@/components/layout/SectionHeading'
import PointsHero from '@/components/rewards/PointsHero'
import ReferralBox from '@/components/rewards/ReferralBox'
import RedeemTiers from '@/components/rewards/RedeemTiers'
import RewardLedger from '@/components/rewards/RewardLedger'

export default function RewardsPage() {
  return (
    <PageShell>
      <SectionHeading
        eyebrow="Rewards"
        title="Earn points, every step of the journey"
        description="Share photos, refer friends, stay consistent — every action earns you points toward your next order."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PointsHero />
          <RewardLedger />
        </div>
        <div className="space-y-6">
          <ReferralBox />
          <RedeemTiers />
        </div>
      </div>
    </PageShell>
  )
}
