import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ConsultationAnswers,
  ConsultationResult,
  ForumReply,
  ForumThread,
  HairstyleEntry,
  Profile,
  ProgressPhoto,
  RewardEvent,
  RewardEventType,
  ScheduleItem,
} from '@/lib/types'
import { buildConsultationPlan } from '@/lib/consultation'
import { newId } from '@/lib/id'
import { generateReferralCode, SEED_FORUM_THREADS } from '@/lib/seedData'

interface AppState {
  onboarded: boolean
  profile: Profile
  consultations: ConsultationResult[]
  scheduleItems: ScheduleItem[]
  hairstyles: HairstyleEntry[]
  photos: ProgressPhoto[]
  rewardEvents: RewardEvent[]
  forumThreads: ForumThread[]

  completeOnboarding: (input: { name: string; email: string; hairGoal: string }) => void
  updateProfile: (patch: Partial<Profile>) => void
  setNotificationsEnabled: (enabled: boolean) => void
  joinClub: () => void

  submitConsultation: (answers: ConsultationAnswers) => ConsultationResult
  latestConsultation: () => ConsultationResult | undefined

  addScheduleItems: (items: ScheduleItem[]) => void
  removeScheduleItem: (id: string) => void
  toggleScheduleItemDone: (id: string) => void
  addHairstyle: (entry: Omit<HairstyleEntry, 'id'>) => void
  removeHairstyle: (id: string) => void

  addPhoto: (photo: Omit<ProgressPhoto, 'id' | 'createdAt'>) => ProgressPhoto
  removePhoto: (id: string) => void

  addRewardEvent: (type: RewardEventType, points: number, note: string) => void
  redeemPoints: (points: number, note: string) => boolean
  pointsBalance: () => number

  addForumThread: (input: { category: ForumThread['category']; title: string; body: string }) => void
  addForumReply: (threadId: string, body: string) => void
  likeThread: (threadId: string) => void
}

const defaultProfile: Profile = {
  name: '',
  email: '',
  hairGoal: '',
  memberSince: new Date().toISOString(),
  notificationsEnabled: false,
  isClubMember: false,
  referralCode: '',
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: defaultProfile,
      consultations: [],
      scheduleItems: [],
      hairstyles: [],
      photos: [],
      rewardEvents: [],
      forumThreads: SEED_FORUM_THREADS,

      completeOnboarding: ({ name, email, hairGoal }) => {
        set({
          onboarded: true,
          profile: {
            ...defaultProfile,
            name,
            email,
            hairGoal,
            memberSince: new Date().toISOString(),
            referralCode: generateReferralCode(name),
          },
        })
        get().addRewardEvent('welcome', 50, 'Welcome to the Journey — profile created')
      },

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      setNotificationsEnabled: (enabled) =>
        set((s) => ({ profile: { ...s.profile, notificationsEnabled: enabled } })),

      joinClub: () => {
        if (get().profile.isClubMember) return
        set((s) => ({ profile: { ...s.profile, isClubMember: true } }))
        get().addRewardEvent('join-club', 100, 'Joined the Supernatural Members Club')
      },

      submitConsultation: (answers) => {
        const { plan, summary } = buildConsultationPlan(answers)
        const result: ConsultationResult = {
          id: newId(),
          createdAt: new Date().toISOString(),
          answers,
          plan,
          summary,
        }
        set((s) => ({ consultations: [result, ...s.consultations] }))
        get().addRewardEvent(
          'consultation',
          25,
          get().consultations.length === 1 ? 'Completed your digital consultation' : 'Updated your digital consultation',
        )
        return result
      },

      latestConsultation: () => get().consultations[0],

      addScheduleItems: (items) => set((s) => ({ scheduleItems: [...s.scheduleItems, ...items] })),

      removeScheduleItem: (id) =>
        set((s) => ({ scheduleItems: s.scheduleItems.filter((i) => i.id !== id) })),

      toggleScheduleItemDone: (id) =>
        set((s) => ({
          scheduleItems: s.scheduleItems.map((i) => (i.id === id ? { ...i, done: !i.done } : i)),
        })),

      addHairstyle: (entry) =>
        set((s) => ({ hairstyles: [...s.hairstyles, { ...entry, id: newId() }] })),

      removeHairstyle: (id) =>
        set((s) => ({ hairstyles: s.hairstyles.filter((h) => h.id !== id) })),

      addPhoto: (photo) => {
        const record: ProgressPhoto = { ...photo, id: newId(), createdAt: new Date().toISOString() }
        set((s) => ({ photos: [record, ...s.photos] }))
        get().addRewardEvent('share-photo', 50, 'Shared a progress photo')
        return record
      },

      removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),

      addRewardEvent: (type, points, note) =>
        set((s) => ({
          rewardEvents: [
            { id: newId(), type, points, note, createdAt: new Date().toISOString() },
            ...s.rewardEvents,
          ],
        })),

      redeemPoints: (points, note) => {
        if (get().pointsBalance() < points) return false
        get().addRewardEvent('redeem', -points, note)
        return true
      },

      pointsBalance: () => get().rewardEvents.reduce((sum, e) => sum + e.points, 0),

      addForumThread: ({ category, title, body }) =>
        set((s) => ({
          forumThreads: [
            {
              id: newId(),
              category,
              title,
              body,
              author: s.profile.name || 'You',
              createdAt: new Date().toISOString(),
              likes: 0,
              replies: [],
            },
            ...s.forumThreads,
          ],
        })),

      addForumReply: (threadId, body) =>
        set((s) => ({
          forumThreads: s.forumThreads.map((t) => {
            if (t.id !== threadId) return t
            const reply: ForumReply = {
              id: newId(),
              author: s.profile.name || 'You',
              body,
              createdAt: new Date().toISOString(),
            }
            return { ...t, replies: [...t.replies, reply] }
          }),
        })),

      likeThread: (threadId) =>
        set((s) => ({
          forumThreads: s.forumThreads.map((t) =>
            t.id === threadId ? { ...t, likes: t.likes + 1 } : t,
          ),
        })),
    }),
    {
      name: 'supernatural-journey-store',
      version: 1,
    },
  ),
)
