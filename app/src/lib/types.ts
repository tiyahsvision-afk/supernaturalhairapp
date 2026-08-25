export type HairType = 'straight' | 'wavy' | 'curly' | 'coily'
export type Porosity = 'low' | 'medium' | 'high' | 'not-sure'
export type ScalpCondition = 'balanced' | 'dry' | 'oily' | 'itchy-flaky'
export type MainGoal =
  | 'growth'
  | 'moisture'
  | 'scalp-health'
  | 'detox-buildup'
  | 'maintenance'
export type WashFrequency = 'weekly' | 'biweekly' | 'twice-weekly' | 'sparingly'

export interface Profile {
  name: string
  email: string
  hairGoal: string
  memberSince: string
  notificationsEnabled: boolean
  isClubMember: boolean
  referralCode: string
}

export interface ConsultationAnswers {
  hairType: HairType
  porosity: Porosity
  scalpCondition: ScalpCondition
  mainGoal: MainGoal
  washFrequency: WashFrequency
  usesHeatOrProtectiveStyles: boolean
  notes: string
}

export interface ProductPlanItem {
  productId: string
  frequency: string
  timesPerWeek: number
  guidance: string
}

export interface ConsultationResult {
  id: string
  createdAt: string
  answers: ConsultationAnswers
  plan: ProductPlanItem[]
  summary: string
}

export interface ScheduleItem {
  id: string
  date: string // YYYY-MM-DD
  productId: string
  timeOfDay: 'morning' | 'evening' | 'wash-day'
  done: boolean
}

export interface HairstyleEntry {
  id: string
  date: string // YYYY-MM-DD
  name: string
  notes: string
}

export interface ProgressPhoto {
  id: string
  date: string // YYYY-MM-DD
  note: string
  createdAt: string
}

export type RewardEventType =
  | 'share-photo'
  | 'referral'
  | 'consultation'
  | 'streak'
  | 'join-club'
  | 'redeem'
  | 'welcome'

export interface RewardEvent {
  id: string
  type: RewardEventType
  points: number
  note: string
  createdAt: string
}

export interface ForumReply {
  id: string
  author: string
  body: string
  createdAt: string
}

export type ForumCategory =
  | 'Hair Journey Wins'
  | 'Identity & Faith'
  | 'Style Swap'
  | 'Ask the Community'

export interface ForumThread {
  id: string
  category: ForumCategory
  title: string
  author: string
  body: string
  createdAt: string
  likes: number
  replies: ForumReply[]
}
