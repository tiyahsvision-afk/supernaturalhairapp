import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useReminderEngine } from '@/hooks/useReminderEngine'
import BackgroundGlow from '@/components/layout/BackgroundGlow'
import NavBar from '@/components/layout/NavBar'
import Footer from '@/components/layout/Footer'
import RequireOnboarding from '@/components/layout/RequireOnboarding'
import ChatBubble from '@/components/chat/ChatBubble'

import HomePage from '@/pages/HomePage'
import OnboardingPage from '@/pages/OnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import ConsultationPage from '@/pages/ConsultationPage'
import SchedulerPage from '@/pages/SchedulerPage'
import ProgressPage from '@/pages/ProgressPage'
import ReorderPage from '@/pages/ReorderPage'
import RewardsPage from '@/pages/RewardsPage'
import ForumPage from '@/pages/ForumPage'
import ForumThreadPage from '@/pages/ForumThreadPage'
import ProfilePage from '@/pages/ProfilePage'
import PrivacyPage from '@/pages/PrivacyPage'
import TermsPage from '@/pages/TermsPage'

// Owner-only page — lazy-loaded so its Firebase dependency never ships to regular visitors.
const InboxPage = lazy(() => import('@/pages/InboxPage'))

export default function App() {
  useReminderEngine()

  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundGlow />
      <NavBar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/app"
            element={
              <RequireOnboarding>
                <DashboardPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/consultation"
            element={
              <RequireOnboarding>
                <ConsultationPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/scheduler"
            element={
              <RequireOnboarding>
                <SchedulerPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/progress"
            element={
              <RequireOnboarding>
                <ProgressPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/reorder"
            element={
              <RequireOnboarding>
                <ReorderPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/rewards"
            element={
              <RequireOnboarding>
                <RewardsPage />
              </RequireOnboarding>
            }
          />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/:threadId" element={<ForumThreadPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route
            path="/inbox"
            element={
              <Suspense fallback={<div className="p-10 text-center text-ink-900/50">Loading…</div>}>
                <InboxPage />
              </Suspense>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireOnboarding>
                <ProfilePage />
              </RequireOnboarding>
            }
          />
        </Routes>
      </div>
      <Footer />
      <ChatBubble />
    </div>
  )
}
