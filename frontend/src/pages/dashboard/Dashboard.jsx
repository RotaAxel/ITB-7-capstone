import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format, parseISO, isToday, isFuture } from 'date-fns'
import { CalendarCheck, Clock, ClipboardList, Bell, ArrowRight } from 'lucide-react'
import api from '@/api/axios'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import NewReservationModal from '@/components/NewReservationModal'
import ReservationDetailModal from '@/components/ReservationDetailModal'
import { cn } from '@/lib/utils'

function getSportTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('basketball'))                return { color: '#E97316', dark: '#C2410C' }
  if (n.includes('volleyball'))                return { color: '#3B82F6', dark: '#1D4ED8' }
  if (n.includes('swim') || n.includes('pool')) return { color: '#06B6D4', dark: '#0E7490' }
  if (n.includes('track') || n.includes('athlet') || n.includes('run')) return { color: '#22C55E', dark: '#15803D' }
  if (n.includes('football') || n.includes('soccer')) return { color: '#16A34A', dark: '#14532D' }
  if (n.includes('badminton'))                 return { color: '#9333EA', dark: '#7E22CE' }
  if (n.includes('tennis'))                    return { color: '#84CC16', dark: '#4D7C0F' }
  if (n.includes('baseball'))                  return { color: '#78350F', dark: '#451A03' }
  if (n.includes('gym') || n.includes('gymnasium') || n.includes('multi')) return { color: '#6366F1', dark: '#4338CA' }
  return { color: '#C0392B', dark: '#96281B' }
}

function FacilityThumb({ facility }) {
  const theme = getSportTheme(facility.name)
  if (facility.image_url) {
    return <img src={facility.image_url} alt={facility.name} className="w-full h-full object-cover" />
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <rect x="10%" y="10%" width="80%" height="80%" fill="none" stroke="white" strokeWidth="2" rx="4" />
        <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="white" strokeWidth="2" />
        <circle cx="50%" cy="50%" r="15%" fill="none" stroke="white" strokeWidth="2" />
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { notifications, unreadCount } = useNotifications()
  const firstName = user?.full_name?.split(' ')[0] ?? 'there'
  const [showModal, setShowModal] = useState(false)
  const [selectedFacility, setSelectedFacility] = useState(null)

  const [viewingId, setViewingId] = useState(null)
  const openModal = (facilityId = null) => { setSelectedFacility(facilityId); setShowModal(true) }
  const closeModal = () => { setShowModal(false); setSelectedFacility(null) }

  const { data: reservations = [], isLoading: loadingRes } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get('/reservations').then(r => r.data),
  })
  const { data: facilities = [], isLoading: loadingFac } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  })

  const upcoming  = reservations.filter(r => (r.status === 'confirmed' || (r.status === 'pending' && r.payment?.status === 'paid')) && r.reservation_date && (isToday(parseISO(r.reservation_date)) || isFuture(parseISO(r.reservation_date))))
  const pending   = reservations.filter(r => r.status === 'pending')
  const available = facilities.filter(f => f.status === 'available')

  const kpis = [
    { label: 'Upcoming Bookings',    value: upcoming.length,     icon: CalendarCheck, color: 'text-[#C0392B] bg-[#FADBD8]', to: '/reservations?filter=upcoming' },
    { label: 'Awaiting Approval',    value: pending.length,      icon: Clock,         color: 'text-[#B7950B] bg-[#FEF9E7]', to: '/reservations?filter=pending' },
    { label: 'Total Reservations',   value: reservations.length, icon: ClipboardList, color: 'text-[#2980B9] bg-[#D6EAF8]', to: '/reservations' },
    { label: 'Unread Notifications', value: unreadCount,         icon: Bell,          color: 'text-[#E74C3C] bg-[#FADBD8]', to: '/notifications' },
  ]

  if (loadingRes) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6"><Skeleton className="lg:col-span-3 h-64" /><Skeleton className="lg:col-span-2 h-64" /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Welcome back, {firstName}!</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Here's your activity overview</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Available Facilities</CardTitle>
          <Link to="/facilities">
            <Button size="sm" className="flex items-center gap-1.5 !py-1.5">
              Book Now <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {loadingFac ? (
            <div className="flex gap-5 overflow-x-auto pb-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56 w-64 flex-shrink-0" />)}</div>
          ) : available.length === 0 ? (
            <p className="text-center text-[#1C2833] text-sm py-6">No facilities available right now</p>
          ) : (
            <div className="flex gap-5 overflow-x-auto pb-2">
              {available.map(f => (
                <div key={f.id} className="flex-shrink-0 w-64 border border-[#E5E7E9] rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white">
                  <div className="h-36 overflow-hidden">
                    <FacilityThumb facility={f} />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-base text-[#1C2833] truncate">{f.name}</p>
                    <p className="text-sm text-[#1C2833] mt-1">₱{Number(f.price_per_hour).toLocaleString()}/hr</p>
                    <Button size="lg" className="w-full mt-3 !text-base !py-3 font-bold" onClick={() => openModal(f.id)}>Reserve</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Reservations</CardTitle>
            <Link to="/reservations" className="text-xs text-[#2980B9] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {upcoming.length === 0 ? (
              <div className="text-center py-10">
                <CalendarCheck className="h-10 w-10 text-[#FADBD8] mx-auto mb-2" />
                <p className="text-[#1C2833] text-sm">No upcoming reservations</p>
                <Button size="sm" className="mt-3" onClick={() => openModal()}>Book a Facility</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.slice(0, 5).map(r => (
                  <button key={r.id} onClick={() => setViewingId(r.id)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border border-[#E5E7E9] hover:bg-[#FADBD8]/20 transition-colors text-left">
                    <div>
                      <p className="font-medium text-sm text-[#1C2833]">{r.facility?.name}</p>
                      <p className="text-xs text-[#1C2833] mt-0.5">
                        {r.reservation_date ? format(parseISO(r.reservation_date), 'MMM d, yyyy') : '—'}
                        {r.start_time && <> · {r.start_time.slice(0,5)} – {r.end_time?.slice(0,5)}</>}
                      </p>
                    </div>
                    <Badge status={r.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Notifications</CardTitle>
            <Link to="/notifications" className="text-xs text-[#2980B9] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {notifications.length === 0 ? (
              <p className="text-center text-[#1C2833] text-sm py-8">No notifications</p>
            ) : (
              notifications.slice(0, 5).map(n => (
                <div key={n.id} className={cn('flex items-start gap-2 p-2 rounded-lg', !n.read_at && 'bg-[#FADBD8]/20')}>
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', n.read_at ? 'bg-[#E5E7E9]' : 'bg-[#C0392B]')} />
                  <div className="min-w-0">
                    <p className={cn('text-xs text-[#1C2833] line-clamp-1', !n.read_at && 'font-semibold')}>{n.title}</p>
                    <p className="text-[10px] text-[#1C2833] mt-0.5">{new Date(n.created_at).toLocaleString('en-PH')}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-4">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-[#1C2833]">{value}</p>
                <p className="text-xs text-[#1C2833] mt-0.5 leading-tight">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {showModal && (
        <NewReservationModal
          preselectedFacility={selectedFacility}
          onClose={closeModal}
        />
      )}
      {viewingId && (
        <ReservationDetailModal reservationId={viewingId} onClose={() => setViewingId(null)} />
      )}
    </div>
  )
}
