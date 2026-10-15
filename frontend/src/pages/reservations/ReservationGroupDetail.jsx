import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft, Download, CalendarRange } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import TypeBadge from '@/components/ui/TypeBadge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import GroupPaymentModal from '@/components/GroupPaymentModal'
import ReceiptModal from '@/components/ReceiptModal'

// The client-facing view of a multi-date reservation bundle (see
// ReservationController::store()'s reservation_dates[] path) — every date was
// submitted with the same facility, purpose, amenities, letters, and terms, so
// those are shown once; each date keeps its own status/payment underneath, and
// one "Pay All" / "Cancel All" acts on the whole bundle at once.
export default function ReservationGroupDetail() {
  const { groupId }  = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [receiptId,   setReceiptId]   = useState(null)

  const { data: group, isLoading, error } = useQuery({
    queryKey: ['reservation-group', groupId],
    queryFn: () => api.get(`/reservations/groups/${groupId}`).then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/reservations/groups/${groupId}/cancel`),
    onSuccess: res => {
      toast.success(res.data.message)
      queryClient.invalidateQueries({ queryKey: ['reservation-group', groupId] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to cancel.'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  if (error || !group || group.reservations.length === 0) {
    return <div className="p-6 text-center text-red-500">Reservation group not found.</div>
  }

  const reservations = group.reservations
  const first = reservations[0]
  const type  = first.type

  // Shared details are identical across every member of the bundle — read them
  // off the first one. Per-date status/payment stay on each row below.
  const awaitingAdminApproval = type === 'reserve' && reservations.every(r => r.status === 'pending')
  const readyForPayment = type === 'reserve'
    ? reservations.every(r => r.status === 'approved')
    : reservations.every(r => r.status === 'pending')
  // A free facility (see Facility::rateFor()) marks every member's Payment
  // 'paid' the moment the bundle is created — amount ₱0, nothing real to
  // collect — while the reservations themselves can still be sitting at
  // 'pending'/'approved' waiting on terms (or, for "reserve", admin approval).
  // That's not the same as an actual completed payment, so it shouldn't block
  // cancelling or hide the terms step the way a real payment would.
  const isRealPayment = r => r.payment?.status === 'paid' && r.payment?.payment_method !== 'free'
  const canCancel = reservations.every(r => ['pending', 'approved'].includes(r.status) && !isRealPayment(r))
  const needTerms = readyForPayment && !first.terms_acknowledged
  const canPay    = readyForPayment && first.terms_acknowledged && reservations.some(r => !isRealPayment(r))
  const allPaid   = reservations.every(r => r.payment?.status === 'paid')
  const awaitingConfirmation = reservations.every(r => r.status === 'pending') && reservations.some(r => r.payment?.status === 'paid')

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[#1C2833] hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="border-l-4 border-[#C0392B] pl-4">
            <h1 className="text-2xl font-bold text-[#1C2833] flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-[#C0392B]" /> {reservations.length}-Date Reservation
            </h1>
            <p className="text-[#1C2833] text-sm mt-0.5">{first.facility?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <TypeBadge type={type} />
        </div>
      </div>

      <div className="space-y-5">
        {/* Shared details */}
        <Card>
          <CardHeader><CardTitle>Booking Details</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-gray-100 text-sm">
              {[
                ['Facility',     first.facility?.name],
                ['Purpose',      first.purpose],
                ...(first.event_package ? [['Event Package', first.event_package]] : []),
                ['Participants', first.number_of_participants],
                ...(first.waste_management_plan ? [['Waste Management', first.waste_management_plan]] : []),
                ...(first.crowd_management_plan ? [['Crowd Management', first.crowd_management_plan]] : []),
                ...(first.event_considerations  ? [['Event Considerations', first.event_considerations]] : []),
                ['Submitted',    first.created_at ? format(parseISO(first.created_at), 'MMM d, yyyy h:mm a') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 py-2.5">
                  <dt className="font-medium text-[#1C2833] w-40 shrink-0">{label}</dt>
                  <dd className="text-gray-900">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Selected Amenities */}
        {first.selected_amenities?.length > 0 && first.facility?.amenities && (
          <Card>
            <CardHeader><CardTitle>Selected Amenities (applied to every date)</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {first.facility.amenities
                  .filter(a => first.selected_amenities.includes(a.id))
                  .map(a => (
                    <span key={a.id} className="bg-[#FADBD8] text-[#96281B] text-xs px-2.5 py-1 rounded-full border border-[#F1948A]">
                      {a.name}
                    </span>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-date breakdown */}
        <Card>
          <CardHeader><CardTitle>Dates ({reservations.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-gray-100 text-sm">
              {reservations.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium text-gray-900">
                      {r.reservation_date ? format(parseISO(r.reservation_date), 'EEEE, MMM d, yyyy') : '—'}
                    </p>
                    <p className="text-xs text-[#1C2833]">
                      {r.start_time && r.end_time ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}` : '—'}
                      {' · '}₱{Number(r.payment?.amount ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={r.status} />
                    {r.payment && r.payment.status !== 'pending' && <Badge status={r.payment.status} />}
                    {r.payment?.status === 'paid' && (
                      <button
                        onClick={() => setReceiptId(r.id)}
                        className="text-xs text-[#2980B9] hover:underline font-medium"
                      >
                        Receipt
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </dl>
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-gray-900 text-sm">Total</span>
              <span className="text-xl font-bold text-[#C0392B]">₱{Number(group.total_amount).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {first.authorization_letter_path || first.request_letter_path ? (
          <Card>
            <CardHeader><CardTitle>Letters (cover every date)</CardTitle></CardHeader>
            <CardContent className="pt-0 flex flex-wrap gap-2">
              {first.authorization_letter_path && (
                <Button variant="outline" size="sm" onClick={() => {
                  api.get(`/reservations/${first.id}/authorization-letter`, { responseType: 'blob' })
                    .then(res => {
                      const url = URL.createObjectURL(res.data)
                      const a = document.createElement('a')
                      a.href = url; a.download = `authorization-letter-group-${groupId}.pdf`; a.click()
                      URL.revokeObjectURL(url)
                    })
                    .catch(() => toast.error('Failed to download the authorization letter.'))
                }}>
                  <Download className="h-3.5 w-3.5" /> Authorization Letter
                </Button>
              )}
              {first.request_letter_path && (
                <Button variant="outline" size="sm" onClick={() => {
                  api.get(`/reservations/${first.id}/request-letter`, { responseType: 'blob' })
                    .then(res => {
                      const url = URL.createObjectURL(res.data)
                      const a = document.createElement('a')
                      a.href = url; a.download = `request-letter-group-${groupId}.pdf`; a.click()
                      URL.revokeObjectURL(url)
                    })
                    .catch(() => toast.error('Failed to download the request letter.'))
                }}>
                  <Download className="h-3.5 w-3.5" /> Request Letter
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {awaitingAdminApproval && (
            <span className="text-sm text-[#B7950B] self-center">Awaiting admin approval before payment.</span>
          )}

          {needTerms && (
            <Link to={`/reservations/${first.id}/terms`}>
              <Button>Review Terms &amp; Conditions</Button>
            </Link>
          )}

          {canPay && (
            <Button onClick={() => setShowPayment(true)}>
              Pay All (₱{Number(group.total_amount).toLocaleString()})
            </Button>
          )}

          {awaitingConfirmation && (
            <span className="text-sm text-[#B7950B] self-center">Payment received — confirming your reservations…</span>
          )}

          {allPaid && (
            <span className="text-sm text-[#1E8449] self-center">All dates paid and confirmed.</span>
          )}

          {canCancel && (
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm(`Cancel all ${reservations.length} dates in this bundle? This cannot be undone.`)) {
                  cancelMutation.mutate()
                }
              }}
            >
              Cancel All
            </Button>
          )}
        </div>
      </div>

      {showPayment && (
        <GroupPaymentModal
          groupId={groupId}
          onClose={() => setShowPayment(false)}
        />
      )}
      {receiptId && (
        <ReceiptModal reservationId={receiptId} onClose={() => setReceiptId(null)} />
      )}
    </div>
  )
}
