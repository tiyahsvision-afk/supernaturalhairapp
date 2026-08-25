import type { ForumThread } from './types'

export const SEED_FORUM_THREADS: ForumThread[] = [
  {
    id: 'seed-1',
    category: 'Hair Journey Wins',
    title: '6 months on the Journey Kit and my edges are BACK 🕊️',
    author: 'Amara J.',
    body: "Started with GROW oil every other night and REST massage on rest days. My edges filled back in around month 4. Consistency really is the whole secret — the scheduler in this app is the only reason I stayed on track.",
    createdAt: daysAgo(6),
    likes: 41,
    replies: [
      {
        id: 'seed-1-r1',
        author: 'Coach Tia',
        body: "This is exactly it, Amara. Protective styling + consistent scalp care wins every time. So proud of you 💗",
        createdAt: daysAgo(5),
      },
      {
        id: 'seed-1-r2',
        author: 'Deja W.',
        body: 'Needed to hear this today. Adding GROW to my evening routine tonight!',
        createdAt: daysAgo(4),
      },
    ],
  },
  {
    id: 'seed-2',
    category: 'Identity & Faith',
    title: "This month's Bible study theme — 'renewed like the eagle'",
    author: 'Coach Tia',
    body: "Our Members' Bible study this month sits in Isaiah 40:31 — those who wait on the Lord renew their strength. Felt right for anyone in a hair or identity journey that feels slow right now. Your growth isn't wasted, even the season where nothing seems to be happening.",
    createdAt: daysAgo(10),
    likes: 78,
    replies: [
      {
        id: 'seed-2-r1',
        author: 'Marielle K.',
        body: 'Cried reading this on my lunch break. Thank you for holding space for this alongside the hair care 🙏',
        createdAt: daysAgo(9),
      },
    ],
  },
  {
    id: 'seed-3',
    category: 'Style Swap',
    title: 'Low-manipulation styles that actually survive scalp oil nights',
    author: 'Zavia M.',
    body: "Been rotating: pineapple bun (Sun/Tue/Thu) + silk press twice a month + loose twist-out for church. Keeps my GROW + REST schedule totally uninterrupted. Dropping the calendar preset I use if anyone wants it!",
    createdAt: daysAgo(3),
    likes: 29,
    replies: [],
  },
  {
    id: 'seed-4',
    category: 'Ask the Community',
    title: 'How often are y’all actually using DETOX shampoo?',
    author: 'Christine S.',
    body: 'My consultation says weekly but I sweat a lot at the gym — anyone bump theirs up without over-drying?',
    createdAt: daysAgo(1),
    likes: 12,
    replies: [
      {
        id: 'seed-4-r1',
        author: 'Sarai B.',
        body: 'I retook my consultation and marked "clarify buildup" as my goal for a few weeks — bumped mine to 2x/week and my scalp thanked me.',
        createdAt: daysAgo(1),
      },
    ],
  },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function generateReferralCode(name: string): string {
  const base = name.trim().split(' ')[0]?.toUpperCase().slice(0, 6) || 'JOURNEY'
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base}-${suffix}`
}
