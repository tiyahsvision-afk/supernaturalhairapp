import { Route, Routes } from 'react-router-dom'
import { useReminderEngine } from '@/hooks/useReminderEngine'
import BackgroundGlow from '@/components/layout/BackgroundGlow'
import NavBar from '@/components/layout/NavBar'
import Footer from '@/components/layout/Footer'
import RequireOnboarding from '@/components/layout/RequireOnboarding'

import HomePage from '@/pages/HomePage'
import OnboardingPage from '@/pages/OnboardingPage'
import DashboardPage from '@/pages/DashboardPage'
import ConsultationPage from '@/pages/ConsultationPage'
import SchedulerPage from '@/pages/SchedulerPage'
import ProgressPage from '@/pages/ProgressPage'
import ReorderPage from '@/pages/ReorderPage'
import RewardsPage from '@/pages/RewardsPage'
import MembersPage from '@/pages/MembersPage'
import ForumPage from '@/pages/ForumPage'
import ForumThreadPage from '@/pages/ForumThreadPage'
import ProfilePage from '@/pages/ProfilePage'

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
          <Route path="/members" element={<MembersPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/:threadId" element={<ForumThreadPage />} />
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
    </div>
  )
}
