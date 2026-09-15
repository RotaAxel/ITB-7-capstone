import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import GuestPage from '@/pages/guest/GuestPage'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast, Toaster } from 'sonner'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import Spinner from '@/components/ui/Spinner'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import NotFound from '@/pages/NotFound'

// Lazy pages (auth extras)
const VerifyEmail    = lazy(() => import('@/pages/auth/VerifyEmail'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword  = lazy(() => import('@/pages/auth/ResetPassword'))

// Lazy pages
const Dashboard         = lazy(() => import('@/pages/dashboard/Dashboard'))
const StaffDashboard    = lazy(() => import('@/pages/staff/StaffDashboard'))
const FacilityList      = lazy(() => import('@/pages/facilities/FacilityList'))
const FacilityDetail    = lazy(() => import('@/pages/facilities/FacilityDetail'))
const MyReservations    = lazy(() => import('@/pages/reservations/MyReservations'))
const NewReservation    = lazy(() => import('@/pages/reservations/NewReservation'))
const ReservationDetail = lazy(() => import('@/pages/reservations/ReservationDetail'))
const TermsPage         = lazy(() => import('@/pages/reservations/TermsPage'))
const PaymentPage       = lazy(() => import('@/pages/payment/PaymentPage'))
const PaymentCallback   = lazy(() => import('@/pages/payment/PaymentCallback'))
const ReceiptPage       = lazy(() => import('@/pages/payment/ReceiptPage'))
const AdminDashboard    = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminReservations = lazy(() => import('@/pages/admin/AdminReservations'))
const AdminFacilities   = lazy(() => import('@/pages/admin/AdminFacilities'))
const AdminUsers        = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminAnalytics    = lazy(() => import('@/pages/admin/AdminAnalytics'))
const AdminCalendar     = lazy(() => import('@/pages/admin/AdminCalendar'))
const AdminPayments     = lazy(() => import('@/pages/admin/AdminPayments'))
const ProfilePage       = lazy(() => import('@/pages/profile/ProfilePage'))
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage'))
const CalendarPage      = lazy(() => import('@/pages/calendar/CalendarPage'))
const StaffCalendar     = lazy(() => import('@/pages/staff/StaffCalendar'))
const StaffFacilities   = lazy(() => import('@/pages/staff/StaffFacilities'))

function globalErrorHandler(error) {
  // Skip if already toasted by the axios interceptor
  if (error?._toasted) return
  // Skip 401 (handled by redirect) and 422 (handled by forms)
  const status = error?.response?.status
  if (status === 401 || status === 422) return
  const message = error?.response?.data?.message
  toast.error(message || 'Something went wrong. Please try again.')
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: globalErrorHandler }),
  mutationCache: new MutationCache({ onError: globalErrorHandler }),
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <GuestPage />
  if (user.role === 'administrator') return <Navigate to="/admin/dashboard" replace />
  if (user.role === 'staff') return <Navigate to="/staff/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"           element={<Login />} />
              <Route path="/register"        element={<Register />} />
              <Route path="/verify-email"    element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />

              {/* Public root — guest page for visitors, dashboard redirect for logged-in */}
              <Route index element={<RoleRedirect />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>

                  {/* Client */}
                  <Route path="dashboard"                element={<Dashboard />} />
                  <Route path="facilities"               element={<FacilityList />} />
                  <Route path="facilities/:id"           element={<FacilityDetail />} />
                  <Route path="reservations"             element={<MyReservations />} />
                  <Route path="reservations/new"         element={<NewReservation />} />
                  <Route path="reservations/:id"         element={<ReservationDetail />} />
                  <Route path="reservations/:id/terms"   element={<TermsPage />} />
                  <Route path="reservations/:id/payment" element={<PaymentPage />} />
                  <Route path="reservations/:id/receipt" element={<ReceiptPage />} />
                  <Route path="payment/callback"         element={<PaymentCallback />} />
                  <Route path="calendar"                 element={<CalendarPage />} />
                  <Route path="profile"                  element={<ProfilePage />} />
                  <Route path="notifications"            element={<NotificationsPage />} />

                  {/* Staff + Admin */}
                  <Route element={<ProtectedRoute roles={['staff', 'administrator']} />}>
                    <Route path="staff/dashboard"    element={<StaffDashboard />} />
                    <Route path="staff/reservations" element={<AdminReservations />} />
                    <Route path="staff/calendar"     element={<StaffCalendar />} />
                    <Route path="staff/facilities"   element={<StaffFacilities />} />
                    <Route path="admin/dashboard"    element={<AdminDashboard />} />
                    <Route path="admin/reservations" element={<AdminReservations />} />
                    <Route path="admin/facilities"   element={<AdminFacilities />} />
                    <Route path="admin/calendar"     element={<AdminCalendar />} />
                  </Route>

                  {/* Admin only */}
                  <Route element={<ProtectedRoute roles={['administrator']} />}>
                    <Route path="admin/users"     element={<AdminUsers />} />
                    <Route path="admin/analytics" element={<AdminAnalytics />} />
                    <Route path="admin/payments"  element={<AdminPayments />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
