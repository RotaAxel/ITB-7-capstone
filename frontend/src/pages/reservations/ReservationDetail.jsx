import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { ArrowLeft, Download } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import TypeBadge from '@/components/ui/TypeBadge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { useNotifications } from '@/hooks/useNotifications'
import PaymentModal from '@/components/PaymentModal'
import ReceiptModal from '@/components/ReceiptModal'

export default function ReservationDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const { notifications, markReadByReservation } = useNotifications()

  useEffect(() => {
    markReadByReservation(id)
  }, [id, notifications])

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ['reservation', id],
    queryFn: () => api.get(`/reservations/${id}`).then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/reservations/${id}/cancel`),
    onSuccess: () => {
      toast.success('Reservation cancelled.')
      queryClient.invalidateQueries({ queryKey: ['reservation', id] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to cancel.'),
  })

  const downloadPdf = () => {
    api.get(`/receipts/${id}`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const a   = document.createElement('a')
        a.href     = url
        a.download = `CABS-receipt-${reservation?.payment?.receipt_number || id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download receipt.'))
  }

  const downloadAuthorizationLetter = () => {
    api.get(`/reservations/${id}/authorization-letter`, { responseType: 'blob' })
      .then(res => {
        const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[res.data.type] || 'bin'
        const url = URL.createObjectURL(res.data)
        const a   = document.createElement('a')
        a.href = url
        a.download = `authorization-letter-reservation-${id}.${ext}`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download the authorization letter.'))
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  if (error || !reservation) {
    return <div className="p-6 text-center text-red-500">Reservation not found.</div>
  }

  const r = reservation

  // "Reserve" requests must be approved by an admin before payment unlocks;
  // "Book" reservations can pay immediately. See PaymentController on the backend.
  const awaitingAdminApproval = r.type === 'reserve' && r.status === 'pending'
  const readyForPayment       = r.type === 'reserve' ? r.status === 'approved' : r.status === 'pending'

  const canCancel = ['pending', 'approved'].includes(r.status) && r.payment?.status !== 'paid'
  const needTerms = readyForPayment && !r.terms_acknowledged && r.payment?.status !== 'paid'
  const canPay    = readyForPayment && r.terms_acknowledged && r.payment?.status !== 'paid'
  const hasPaid   = r.payment?.status === 'paid'
  const awaitingApproval = r.status === 'pending' && hasPaid

  const duration = r.start_time && r.end_time
    ? (new Date(`2000-01-01T${r.end_time}`) - new Date(`2000-01-01T${r.start_time}`)) / 3_600_000
    : null

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
            <h1 className="text-2xl font-bold text-[#1C2833]">Reservation #{r.id}</h1>
            <p className="text-[#1C2833] text-sm mt-0.5">{r.facility?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <TypeBadge type={r.type} />
          <Badge status={r.status} />
          {r.payment && r.payment.status !== 'pending' && <Badge status={r.payment.status} />}
        </div>
      </div>

      <div className="space-y-5">
        {/* Booking Details */}
        <Card>
          <CardHeader><CardTitle>Booking Details</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-gray-100 text-sm">
              {[
                ['Facility',     r.facility?.name],
                ['Date',         r.reservation_date ? format(parseISO(r.reservation_date), 'MMMM d, yyyy') : '—'],
                ['Time',         r.start_time && r.end_time ? `${r.start_time.slice(0, 5)} – ${r.end_time.slice(0, 5)}` : '—'],
                ['Duration',     duration != null ? `${duration}h` : '—'],
                ['Purpose',      r.purpose],
                ['Participants', r.number_of_participants],
                ['Submitted',    r.created_at ? format(parseISO(r.created_at), 'MMM d, yyyy h:mm a') : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 py-2.5">
                  <dt className="font-medium text-[#1C2833] w-32 shrink-0">{label}</dt>
                  <dd className="text-gray-900">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Selected Amenities */}
        {r.selected_amenities?.length > 0 && r.facility?.amenities && (
          <Card>
            <CardHeader><CardTitle>Selected Amenities</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {r.facility.amenities
                  .filter(a => r.selected_amenities.includes(a.id))
                  .map(a => (
                    <span
                      key={a.id}
                      className="bg-[#FADBD8] text-[#96281B] text-xs px-2.5 py-1 rounded-full border border-[#F1948A]"
                    >
                      {a.name}
                    </span>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment */}
        {r.payment && (
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <dl className="divide-y divide-gray-100 text-sm">
                {[
                  ['Amount',    `₱${Number(r.payment.amount).toLocaleString()}`],
                  ['Status',    <Badge key="ps" status={r.payment.status} />],
                  ['Method',    r.payment.payment_method ?? '—'],
                  ['Receipt #', r.payment.receipt_number ?? '—'],
                  ['Paid At',   r.payment.paid_at ? format(parseISO(r.payment.paid_at), 'MMM d, yyyy h:mm a') : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 py-2.5">
                    <dt className="font-medium text-[#1C2833] w-32 shrink-0">{label}</dt>
                    <dd className="text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Admin Note */}
        {r.admin_note && (
          <Card className="border-orange-100">
            <CardHeader><CardTitle className="text-orange-700">Admin Note</CardTitle></CardHeader>
            <CardContent className="pt-0 text-sm text-gray-700">{r.admin_note}</CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {awaitingAdminApproval && (
            <span className="text-sm text-[#B7950B] self-center">Awaiting admin approval before payment.</span>
          )}

          {needTerms && (
            <Link to={`/reservations/${id}/terms`}>
              <Button>Review Terms &amp; Conditions</Button>
            </Link>
          )}

          {canPay && (
            <Button onClick={() => setShowPayment(true)}>Proceed to Payment</Button>
          )}

          {awaitingApproval && (
            <span className="text-sm text-[#B7950B] self-center">Payment received — confirming your reservation…</span>
          )}

          {hasPaid && (
            <Button variant="outline" onClick={() => setShowReceipt(true)}>View Receipt</Button>
          )}

          {hasPaid && (
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          )}

          {r.authorization_letter_path && (
            <Button variant="outline" onClick={downloadAuthorizationLetter}>
              <Download className="h-4 w-4" /> Your Authorization Letter
            </Button>
          )}

          {canCancel && (
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm('Cancel this reservation? This cannot be undone.')) {
                  cancelMutation.mutate()
                }
              }}
            >
              Cancel Reservation
            </Button>
          )}
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          reservationId={id}
          onClose={() => setShowPayment(false)}
          onViewReceipt={() => { setShowPayment(false); setShowReceipt(true) }}
        />
      )}
      {showReceipt && (
        <ReceiptModal reservationId={id} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  )
}
