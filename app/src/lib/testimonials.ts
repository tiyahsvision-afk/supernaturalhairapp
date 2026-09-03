export interface Testimonial {
  name: string
  handle: string
  quote: string
  highlight: string
  /** Real customer photo URL. Leave unset to show the initials avatar. */
  photoUrl?: string
}

// Real customer reviews from the Supernatural Hair Care LLC Google Business
// listing.
export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Ashley N.',
    handle: 'Google review',
    quote:
      "Supernatural Hair Care is truly amazing! I started my natural hair journey two years ago and it has been a struggle finding good natural hair products. I wish I found this company sooner because my hair is loving it. The shampoo lathers so well and smells so good, and the hydrating conditioner really leaves my hair in its best condition. I highly recommend this brand if you're looking for healthy hair that looks and feels good.",
    highlight: '★★★★★ 5-star review',
  },
  {
    name: 'Shauna J.',
    handle: 'Google review',
    quote:
      "Supernatural Hair Care is exactly that! Supernatural. Since using the hair care line I've noticed an increase in my volume, shine, and moisture. I also use the hair oil on my son's hair and he hasn't experienced any of the normal breakage seen in most infants. If you're looking for a healthy way to restore your crown, this line is for you.",
    highlight: '★★★★★ 5-star review',
  },
  {
    name: 'Alyssa P.',
    handle: 'Google review',
    quote:
      'Supernatural has some of the best haircare products on the market. Between it being very natural and all handmade, it is amazing. Their shampoo is exceptional — it leaves my hair super clean and also very hydrated.',
    highlight: '★★★★★ 5-star review',
  },
  {
    name: 'Ali E.',
    handle: 'Google review',
    quote:
      'Love this product because it helped with my dry scalp. I tried a lot of things but this worked the best. I wash and condition together once a week, but use the conditioner every 3 days.',
    highlight: '★★★★★ 5-star review',
  },
]
