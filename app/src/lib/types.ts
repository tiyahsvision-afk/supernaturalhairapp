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

export interface ChatMessage {
  id: string
  name: string
  email: string
  body: string
  createdAt: string
  deliveryMethod: 'email' | 'mail-app'
}

// Live, two-way chat (backed by Firestore when configured).
export interface LiveChatMessage {
  id: string
  from: 'customer' | 'owner'
  body: string
  createdAt: number
}

export interface ConversationSummary {
  conversationId: string
  name: string
  email: string
  lastMessage: string
  updatedAt: number
  unreadForOwner: boolean
}

// A synced snapshot of one customer's profile + activity, for the owner's
// admin dashboard. Kept intentionally lean: counts and a summary, not every
// raw local record (schedule items, photo files stay on the customer's device).
export interface AdminUserRecord {
  uid: string
  name: string
  email: string
  hairGoal: string
  memberSince: string
  pointsBalance: number
  consultationCount: number
  scheduleItemCount: number
  photoCount: number
  latestConsultationSummary: string
  updatedAt: number
}
