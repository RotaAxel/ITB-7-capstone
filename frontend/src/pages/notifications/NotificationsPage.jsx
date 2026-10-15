import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Bell, ClipboardList, CheckCircle, XCircle, CreditCard,
  AlertCircle, Clock, Wrench, DollarSign, Ban, ChevronRight, Check,
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const TYPE_META = {
  RESERVATION_SUBMITTED:  { icon: ClipboardList, color: 'text-[#B7950B] bg-[#FEF9E7]' },
  RESERVATION_APPROVED:   { icon: CheckCircle,   color: 'text-[#1E8449] bg-[#EAFAF1]' },
  RESERVATION_REJECTED:   { icon: XCircle,       color: 'text-[#C0392B] bg-[#FADBD8]' },
  PAYMENT_SUCCESS:        { icon: CreditCard,    color: 'text-[#1E8449] bg-[#EAFAF1]' },
  payment_success:        { icon: CreditCard,    color: 'text-[#1E8449] bg-[#EAFAF1]' },
  PAYMENT_FAILED:         { icon: AlertCircle,   color: 'text-[#C0392B] bg-[#FADBD8]' },
  RESERVATION_CANCELLED:  { icon: Ban,           color: 'text-[#1C2833] bg-[#F2F3F4]' },
  UPCOMING_REMINDER:      { icon: Clock,         color: 'text-[#2980B9] bg-[#D6EAF8]' },
  MAINTENANCE_ALERT:      { icon: Wrench,        color: 'text-[#B7950B] bg-[#FEF9E7]' },
  ADMIN_NEW_RESERVATION:  { icon: Bell,          color: 'text-[#C0392B] bg-[#FADBD8]' },
  new_reservation:        { icon: Bell,          color: 'text-[#C0392B] bg-[#FADBD8]' },
  ADMIN_PAYMENT_RECEIVED: { icon: DollarSign,    color: 'text-[#1E8449] bg-[#EAFAF1]' },
  payment_received:       { icon: DollarSign,    color: 'text-[#1E8449] bg-[#EAFAF1]' },
  residency_proof:        { icon: ClipboardList, color: 'text-[#B7950B] bg-[#FEF9E7]' },
}

function getRoute(n, role) {
  const t = n.type
  const rid = n.data?.reservation_id
  const fid = n.data?.facility_id
  const isAdmin = ['administrator', 'staff'].includes(role)
  switch (t) {
    case 'RESERVATION_SUBMITTED':
    case 'new_reservation':        return isAdmin ? '/admin/reservations' : (rid ? `/reservations/${rid}` : '/reservations')
    case 'RESERVATION_APPROVED':   return rid ? `/reservations/${rid}/terms` : '/reservations'
    case 'RESERVATION_REJECTED':
    case 'RESERVATION_CANCELLED':  return rid ? `/reservations/${rid}` : '/reservations'
    case 'PAYMENT_SUCCESS':
    case 'payment_success':        return rid ? `/reservations/${rid}/receipt` : '/reservations'
    case 'PAYMENT_FAILED':         return rid ? `/reservations/${rid}/payment` : '/reservations'
    case 'UPCOMING_REMINDER':      return rid ? `/reservations/${rid}` : '/reservations'
    case 'MAINTENANCE_ALERT':      return fid ? `/facilities/${fid}` : '/facilities'
    case 'ADMIN_PAYMENT_RECEIVED':
    case 'payment_received':       return '/admin/reservations'
    case 'residency_proof':        return isAdmin ? '/admin/users' : '/profile'
    default:                       return '/notifications'
  }
}

const FILTERS = ['all', 'unread', 'reservations', 'payments', 'system']

export default function NotificationsPage() {
  const { user } = useAuth()
  const { notifications, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PER = 10

  const unreadCount = notifications.filter(n => !n.read_at).length

  const filtered = notifications.filter(n => {
    if (filter === 'unread')       return !n.read_at
    if (filter === 'reservations') return n.type?.toLowerCase().includes('reservation')
    if (filter === 'payments')     return n.type?.toLowerCase().includes('payment')
    if (filter === 'system')       return ['SYSTEM_ANNOUNCEMENT','MAINTENANCE_ALERT'].includes(n.type)
    return true
  })

  const paginated   = filtered.slice((page - 1) * PER, page * PER)
  const totalPages  = Math.ceil(filtered.length / PER)

  const handleClick = (n) => {
    markRead(n.id)
    navigate(getRoute(n, user?.role))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="border-l-4 border-[#C0392B] pl-4">
          <h1 className="text-2xl font-bold text-[#1C2833]">Notifications</h1>
          <p className="text-[#1C2833] text-sm">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="h-3.5 w-3.5" /> Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1) }}
            className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize',
              filter === f
                ? 'bg-[#C0392B] text-white border-[#C0392B]'
                : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/30')}>
            {f}
          </button>
        ))}
      </div>

      {paginated.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Bell className="h-12 w-12 text-[#E5E7E9] mx-auto mb-3" />
            <p className="text-[#1C2833] font-medium">No notifications found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginated.map(n => {
            const meta = TYPE_META[n.type] ?? { icon: Bell, color: 'text-[#1C2833] bg-[#F2F3F4]' }
            const Icon = meta.icon
            return (
              <Card key={n.id} onClick={() => handleClick(n)}
                className={cn('cursor-pointer hover:shadow-md transition-all',
                  !n.read_at && 'border-l-4 border-l-[#C0392B] bg-[#FADBD8]/10')}>
                <CardContent className="py-3 flex items-start gap-4">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', meta.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm text-[#1C2833]', !n.read_at && 'font-semibold')}>{n.title}</p>
                    <p className="text-xs text-[#1C2833] mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-[#1C2833] mt-1">
                      {n.created_at ? format(parseISO(n.created_at), 'MMM d, yyyy · h:mm a') : '—'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#1C2833] flex-shrink-0 mt-1" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm text-[#1C2833]">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}
