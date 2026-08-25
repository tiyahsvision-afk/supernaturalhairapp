export interface Testimonial {
  name: string
  handle: string
  quote: string
  highlight: string
}

// Placeholder UGC copy in the brand's voice — swap in real customer photos
// and quotes (e.g. pulled from Shopify product reviews or Instagram UGC)
// before shipping.
export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Amara J.',
    handle: '@amara.grows',
    quote:
      'The scheduler keeps my whole routine straight — GROW oil on Mon/Wed/Fri, REST on rest days. My edges have never been fuller.',
    highlight: '+2in retained length',
  },
  {
    name: 'Deja W.',
    handle: '@dejawrites',
    quote:
      'I finally understand WHEN to use what. The digital consultation felt like a real appointment, not a quiz.',
    highlight: 'Consultation-guided routine',
  },
  {
    name: 'Zavia M.',
    handle: '@zaviamonet',
    quote:
      "The reminders are the only reason I stopped forgetting REMEDY conditioner on wash day. Check it off and keep it moving.",
    highlight: '12-week streak',
  },
  {
    name: 'Christine S.',
    handle: '@christineshines',
    quote:
      'Joining the Members Club for the Bible study + coaching calls changed how I see this whole journey, not just my hair.',
    highlight: 'Members Club',
  },
  {
    name: 'Sarai B.',
    handle: '@saraiblissett',
    quote: 'Uploading my weekly progress photo takes ten seconds and I actually have a timeline now.',
    highlight: 'Weekly photo streak',
  },
]
