import Hero from '@/components/home/Hero'
import FeatureGrid from '@/components/home/FeatureGrid'
import TestimonialStrip from '@/components/home/TestimonialStrip'
import ForumPreview from '@/components/home/ForumPreview'
import MembersTeaser from '@/components/home/MembersTeaser'

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeatureGrid />
      <TestimonialStrip />
      <ForumPreview />
      <MembersTeaser />
    </>
  )
}
