import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isToday, isFuture } from 'date-fns'
import { toast } from 'sonner'
import { Calendar, Plus, Download, Eye, X, Clock, MapPin, ClipboardList, CheckCircle2, AlertCircle } from 'lucide-react'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import TypeBadge from '@/components/ui/TypeBadge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import NewReservationModal from '@/components/NewReservationModal'
import PaymentModal from '@/components/PaymentModal'
import ReceiptModal from '@/components/ReceiptModal'
import ReservationDetailModal from '@/components/ReservationDetailModal'

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All'       },
  { value: 'pending',   label: 'Pending'   },
  { value: 'approved',  label: 'Approved'  },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected',  label: 'Rejected'  },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BORDER = {
  pending:   'border-l-[#F39C12]',
  approved:  'border-l-[#2980B9]',
  confirmed: 'border-l-[#27AE60]',
  completed: 'border-l-[#8E44AD]',
  rejected:  'border-l-[#E74C3C]',
  cancelled: 'border-l-[#95A5A6]',
}

export default function MyReservations() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [viewingId, setViewingId] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [receiptId, setReceiptId] = useState(null)
  const queryClient = useQueryClient()

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get('/reservations').then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: id => api.post(`/reservations/${id}/cancel`),
    onSuccess: () => {
      toast.success('Reservation cancelled.')
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to cancel.'),
  })

  const searchSuggestions = useMemo(() => [
    ...reservations.map(r => r.facility?.name),
    ...reservations.map(r => r.facility?.location),
  ], [reservations])

  const filtered = reservations.filter(r => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q ||
      r.facility?.name?.toLowerCase().includes(q) ||
      r.facility?.location?.toLowerCase().includes(q) ||
      r.reservation_date?.includes(q)
    return matchStatus && matchSearch
  })

  const handleCancel = r => {
    if (!window.confirm(`Cancel reservation for ${r.facility?.name}?`)) return
    cancelMutation.mutate(r.id)
  }

  const downloadReceipt = id => {
    api.get(`/receipts/${id}`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const a   = document.createElement('a')
        a.href     = url
        a.download = `CABS-receipt-${id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download receipt.'))
  }

  const upcoming  = reservations.filter(r => (r.status === 'confirmed' || (r.status === 'pending' && r.payment?.status === 'paid')) && r.reservation_date && (isToday(parseISO(r.reservation_date)) || isFuture(parseISO(r.reservation_date)))).length
  const pending   = reservations.filter(r => r.status === 'pending').length
  const completed = reservations.filter(r => r.status === 'completed').length

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
      </div>
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[#C0392B] pl-4">
          <h1 className="text-2xl font-bold text-[#1C2833]">My Reservations</h1>
          <p className="text-[#1C2833] text-sm mt-0.5">Track and manage your facility bookings</p>
        </div>
        <Button className="flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" /> New Reservation
        </Button>
      </div>

      {/* Search bar */}
      <SearchAutocomplete
        value={search}
        onChange={setSearch}
        suggestions={searchSuggestions}
        placeholder="Search by facility name, location, or date…"
        inputClassName="w-full pl-11 pr-4 h-11 rounded-xl border-2 border-[#FADBD8] bg-white text-sm text-[#1C2833] placeholder-[#717D7E] shadow-sm focus:outline-none focus:border-[#C0392B] focus:ring-2 focus:ring-[#FADBD8] transition-colors"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === value
                ? 'bg-[#C0392B] text-white border-[#C0392B]'
                : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Calendar className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-[#1C2833] font-medium">No reservations found.</p>
            <Button className="mt-4" size="sm" onClick={() => setShowModal(true)}>Make a Reservation</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReservationRow
              key={r.id}
              reservation={r}
              onView={() => setViewingId(r.id)}
              onCancel={() => handleCancel(r)}
              onDownload={() => downloadReceipt(r.id)}
              onPay={() => setPayingId(r.id)}
              onViewReceipt={() => setReceiptId(r.id)}
            />
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: reservations.length, icon: ClipboardList, color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Upcoming',       value: upcoming,            icon: Calendar,      color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Pending',        value: pending,             icon: AlertCircle,   color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Completed',      value: completed,           icon: CheckCircle2,  color: 'text-[#8E44AD] bg-[#F5EEF8]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="hover:shadow-md transition-shadow">
            <CardContent className="py-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-[#1C2833]">{value}</p>
              <p className="text-xs text-[#1C2833] mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showModal  && <NewReservationModal onClose={() => setShowModal(false)} />}
      {viewingId  && <ReservationDetailModal reservationId={viewingId} onClose={() => setViewingId(null)} />}
      {payingId   && <PaymentModal reservationId={payingId} onClose={() => setPayingId(null)} onViewReceipt={() => { setPayingId(null); setReceiptId(payingId) }} />}
      {receiptId  && <ReceiptModal reservationId={receiptId} onClose={() => setReceiptId(null)} />}

    </div>
  )
}

function ReservationRow({ reservation: r, onView, onCancel, onDownload, onPay, onViewReceipt }) {
  // "Reserve" requests must be approved by an admin before payment unlocks;
  // "Book" reservations can pay immediately. See PaymentController on the backend.
  const awaitingAdminApproval = r.type === 'reserve' && r.status === 'pending'
  const readyForPayment       = r.type === 'reserve' ? r.status === 'approved' : r.status === 'pending'

  const canCancel = ['pending', 'approved'].includes(r.status) && r.payment?.status !== 'paid'
  const needTerms = readyForPayment && !r.terms_acknowledged && r.payment?.status !== 'paid'
  const canPay    = readyForPayment && r.terms_acknowledged && r.payment?.status !== 'paid'
  const hasPaid   = r.payment?.status === 'paid'
  const awaitingApproval = r.status === 'pending' && hasPaid
  const borderClass = STATUS_BORDER[r.status] ?? 'border-l-gray-300'

  return (
    <Card className={`border-l-4 ${borderClass} hover:shadow-md transition-shadow`}>
      <CardContent className="py-4 px-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-base">{r.facility?.name}</span>
              <TypeBadge type={r.type} />
              <Badge status={r.status} />
              {r.payment && !['pending', 'cancelled', 'rejected'].includes(r.payment.status) && (
                <Badge status={r.payment.status} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[#1C2833]">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#1C2833]" />
                {r.reservation_date ? format(parseISO(r.reservation_date), 'MMM d, yyyy') : '—'}
              </span>
              {r.start_time && r.end_time && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#1C2833]" />
                  {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                </span>
              )}
              {r.facility?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#1C2833]" />
                  {r.facility.location}
                </span>
              )}
            </div>

            {r.payment?.amount && (
              <p className="text-sm font-medium text-[#1C2833]">
                ₱{Number(r.payment.amount).toLocaleString()}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button variant="outline" size="sm" onClick={onView} className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> View
            </Button>

            {awaitingAdminApproval && (
              <span className="text-sm text-[#B7950B]">Awaiting admin approval</span>
            )}

            {needTerms && (
              <Link to={`/reservations/${r.id}/terms`}>
                <Button size="sm">Review Terms</Button>
              </Link>
            )}

            {canPay && (
              <Button size="sm" onClick={onPay}>Pay Now</Button>
            )}

            {awaitingApproval && (
              <span className="text-sm text-[#B7950B]">Awaiting approval</span>
            )}

            {hasPaid && (
              <Button variant="outline" size="sm" onClick={onViewReceipt} className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Receipt
              </Button>
            )}

            {canCancel && (
              <Button variant="danger" size="sm" onClick={onCancel} className="flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
