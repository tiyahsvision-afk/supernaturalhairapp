import Hero from '@/components/home/Hero'
import WhyDifferent from '@/components/home/WhyDifferent'
import FounderStory from '@/components/home/FounderStory'
import FeatureGrid from '@/components/home/FeatureGrid'
import TestimonialStrip from '@/components/home/TestimonialStrip'
import ForumPreview from '@/components/home/ForumPreview'
import MembersTeaser from '@/components/home/MembersTeaser'
import StickyMobileCta from '@/components/home/StickyMobileCta'

export default function HomePage() {
  return (
    <div className="pb-20 sm:pb-0">
      <Hero />
      <WhyDifferent />
      <FounderStory />
      <FeatureGrid />
      <TestimonialStrip />
      <ForumPreview />
      <MembersTeaser />
      <StickyMobileCta />
    </div>
  )
}
