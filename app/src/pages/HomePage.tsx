import Hero from '@/components/home/Hero'
import KitShowcase from '@/components/home/KitShowcase'
import WhyDifferent from '@/components/home/WhyDifferent'
import FounderStory from '@/components/home/FounderStory'
import FeatureGrid from '@/components/home/FeatureGrid'
import TestimonialStrip from '@/components/home/TestimonialStrip'
import ForumPreview from '@/components/home/ForumPreview'
import StickyMobileCta from '@/components/home/StickyMobileCta'

export default function HomePage() {
  return (
    <div className="pb-20 sm:pb-0">
      <Hero />
      <KitShowcase />
      <WhyDifferent />
      <FounderStory />
      <FeatureGrid />
      <TestimonialStrip />
      <ForumPreview />
      <StickyMobileCta />
    </div>
  )
}
