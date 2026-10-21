import { useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Bell, ChevronRight, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

const NAV_ITEMS = {
  client: [
    { to: '/dashboard',    label: 'Dashboard'       },
    { to: '/facilities',   label: 'Facilities'      },
    { to: '/calendar',     label: 'Calendar'        },
    { to: '/reservations', label: 'My Reservations' },
  ],
  staff: [
    { to: '/staff/dashboard',    label: 'Dashboard'    },
    { to: '/staff/reservations', label: 'Reservations' },
    { to: '/staff/calendar',     label: 'Calendar'     },
    { to: '/staff/facilities',   label: 'Facilities'   },
    { to: '/staff/users',        label: 'Users'        },
    { to: '/staff/payments',     label: 'Payments'     },
  ],
  administrator: [
    { to: '/admin/dashboard',    label: 'Dashboard'    },
    { to: '/admin/reservations', label: 'Reservations' },
    { to: '/admin/facilities',   label: 'Facilities'   },
    { to: '/admin/calendar',     label: 'Calendar'     },
    { to: '/admin/residency',    label: 'Residency'    },
    { to: '/admin/analytics',    label: 'Analytics'    },
  ],
}

const PAGE_LABELS = [
  { pattern: /^\/(dashboard)$/,                     label: 'Dashboard' },
  { pattern: /^\/facilities\/\d+/,                  label: 'Facility Details' },
  { pattern: /^\/facilities/,                        label: 'Facilities' },
  { pattern: /^\/calendar/,                          label: 'Calendar' },
  { pattern: /^\/reservations\/new/,                 label: 'New Reservation' },
  { pattern: /^\/reservations\/\d+\/terms/,          label: 'Terms & Conditions' },
  { pattern: /^\/reservations\/\d+\/payment/,        label: 'Payment' },
  { pattern: /^\/reservations\/\d+\/receipt/,        label: 'Receipt' },
  { pattern: /^\/reservations\/\d+/,                 label: 'Reservation Details' },
  { pattern: /^\/reservations/,                      label: 'My Reservations' },
  { pattern: /^\/notifications/,                     label: 'Notifications' },
  { pattern: /^\/profile/,                           label: 'My Profile' },
  { pattern: /^\/admin\/dashboard/,                  label: 'Dashboard' },
  { pattern: /^\/admin\/reservations/,               label: 'Reservations' },
  { pattern: /^\/admin\/facilities/,                 label: 'Facilities' },
  { pattern: /^\/admin\/calendar/,                   label: 'Calendar' },
  { pattern: /^\/admin\/residency/,                  label: 'Residency Verification' },
  { pattern: /^\/admin\/analytics/,                  label: 'Analytics' },
  { pattern: /^\/staff\/dashboard/,                  label: 'Dashboard' },
  { pattern: /^\/staff\/reservations/,               label: 'Reservations' },
  { pattern: /^\/staff\/calendar/,                   label: 'Calendar' },
  { pattern: /^\/staff\/facilities/,                 label: 'Facilities' },
  { pattern: /^\/staff\/users/,                      label: 'User Management' },
  { pattern: /^\/staff\/payments/,                   label: 'Payments' },
]

function usePageLabel() {
  const { pathname } = useLocation()
  const match = PAGE_LABELS.find(({ pattern }) => pattern.test(pathname))
  return match?.label ?? 'CABS'
}

function getRoute(n, role) {
  const rid     = n.data?.reservation_id
  const fid     = n.data?.facility_id
  const isStaff = ['administrator', 'staff'].includes(role)
  switch (n.type) {
    case 'new_reservation':
    case 'RESERVATION_SUBMITTED':  return isStaff ? '/admin/reservations' : (rid ? `/reservations/${rid}` : '/reservations')
    case 'reservation_approved':
    case 'RESERVATION_APPROVED':   return rid ? `/reservations/${rid}` : '/reservations'
    case 'reservation_rejected':
    case 'RESERVATION_REJECTED':
    case 'reservation_cancelled':
    case 'RESERVATION_CANCELLED':  return rid ? `/reservations/${rid}` : '/reservations'
    case 'payment_success':
    case 'PAYMENT_SUCCESS':        return rid ? `/reservations/${rid}/receipt` : '/reservations'
    case 'payment_received':
    case 'ADMIN_PAYMENT_RECEIVED': return isStaff ? '/admin/payments' : '/reservations'
    case 'PAYMENT_FAILED':         return rid ? `/reservations/${rid}/payment` : '/reservations'
    case 'MAINTENANCE_ALERT':      return fid ? `/facilities/${fid}` : '/facilities'
    case 'residency_proof':        return isStaff ? '/admin/users' : '/profile'
    default:                       return '/notifications'
  }
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)

  const handleNotifClick = (n) => {
    markRead(n.id)
    setNotifOpen(false)
    navigate(getRoute(n, user?.role))
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials  = user?.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? '?'
  const pageLabel = usePageLabel()
  const role      = user?.role ?? 'client'
  const navItems  = NAV_ITEMS[role] ?? NAV_ITEMS.client
  const roleLabel = role === 'administrator' ? 'Administrator' : role.charAt(0).toUpperCase() + role.slice(1)

  return (
    <div>
      {/* ── Row 1: page title + right controls ── */}
      <div className="h-16 flex items-center gap-3 px-5">

        {/* Page title (desktop) */}
        <h2 className="hidden lg:block text-base font-bold text-[#1C2833]">{pageLabel}</h2>

        {/* Mobile breadcrumb */}
        <div className="lg:hidden flex items-center gap-1.5 text-sm min-w-0">
          <span className="font-medium text-[#1C2833]">CABS</span>
          <ChevronRight className="h-3 w-3 text-[#1C2833] flex-shrink-0" />
          <span className="text-[#C0392B] font-semibold truncate">{pageLabel}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* System Online badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D5F5E3] text-[#1E8449]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#27AE60] animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide">SYSTEM ONLINE</span>
        </div>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative p-2 rounded-lg text-[#1C2833] hover:text-[#C0392B] hover:bg-[#FADBD8] transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C0392B] text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#E5E7E9] z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7E9]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#1C2833]">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="bg-[#C0392B] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-[#2980B9] hover:underline">Mark all read</button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E7E9]">
                  {notifications.length === 0 ? (
                    <p className="text-center text-sm text-[#1C2833] py-8">No notifications yet</p>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn('px-4 py-3 cursor-pointer hover:bg-[#FADBD8]/40 transition-colors',
                          !n.read_at && 'bg-[#FADBD8]/20')}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5',
                            n.read_at ? 'bg-[#E5E7E9]' : 'bg-[#C0392B]')} />
                          <div className="min-w-0">
                            <p className={cn('text-sm text-[#1C2833] line-clamp-1', !n.read_at && 'font-semibold')}>{n.title}</p>
                            <p className="text-xs text-[#1C2833] mt-0.5 line-clamp-2">{n.message}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-[#E5E7E9]">
                  <Link to="/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-[#2980B9] hover:underline">
                    View all notifications →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <span className="hidden sm:block w-px h-6 bg-[#E5E7E9]" />

        {/* User: avatar + full name + role */}
        <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-[#C0392B] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-sm font-semibold text-[#1C2833]">{user?.full_name ?? '—'}</p>
            <p className="text-[10px] text-[#1C2833]">{roleLabel}</p>
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Log out"
          className="flex items-center gap-1.5 p-2 rounded-lg text-[#1C2833] hover:text-[#C0392B] hover:bg-[#FADBD8] transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden sm:inline text-sm font-medium">Log out</span>
        </button>
      </div>

      {/* ── Row 2: nav tabs (all screen sizes now that there's no sidebar) ── */}
      <nav
        className="flex border-t border-[#FADBD8] bg-[#FADBD8]/50 px-5 overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to.endsWith('dashboard') || to === '/dashboard'}
            className={({ isActive }) => cn(
              'h-11 flex items-center px-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
              isActive
                ? 'text-[#C0392B] border-[#C0392B]'
                : 'text-[#1C2833] border-transparent hover:text-[#1C2833]'
            )}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
