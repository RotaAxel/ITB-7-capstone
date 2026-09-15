import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/ui/Modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import TypeBadge from '@/components/ui/TypeBadge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import PaymentModal from '@/components/PaymentModal'
import ReceiptModal from '@/components/ReceiptModal'
import { useNotifications } from '@/hooks/useNotifications'

export default function ReservationDetailModal({ reservationId, onClose }) {
  const queryClient = useQueryClient()
  const [showPayment, setShowPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const { notifications, markReadByReservation } = useNotifications()

  useEffect(() => {
    markReadByReservation(reservationId)
  }, [reservationId, notifications])

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ['reservation', String(reservationId)],
    queryFn: () => api.get(`/reservations/${reservationId}`).then(r => r.data),
  })

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/reservations/${reservationId}/cancel`),
    onSuccess: () => {
      toast.success('Reservation cancelled.')
      queryClient.invalidateQueries({ queryKey: ['reservation', String(reservationId)] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to cancel.'),
  })

  const downloadPdf = () => {
    api.get(`/receipts/${reservationId}`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const a   = document.createElement('a')
        a.href     = url
        a.download = `CABS-receipt-${reservation?.payment?.receipt_number || reservationId}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download receipt.'))
  }

  const downloadAuthorizationLetter = () => {
    api.get(`/reservations/${reservationId}/authorization-letter`, { responseType: 'blob' })
      .then(res => {
        const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[res.data.type] || 'bin'
        const url = URL.createObjectURL(res.data)
        const a   = document.createElement('a')
        a.href = url
        a.download = `authorization-letter-reservation-${reservationId}.${ext}`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download the authorization letter.'))
  }

  const r = reservation

  // "Reserve" requests must be approved by an admin before payment unlocks;
  // "Book" reservations can pay immediately. See PaymentController on the backend.
  const awaitingAdminApproval = r && r.type === 'reserve' && r.status === 'pending'
  const readyForPayment       = r && (r.type === 'reserve' ? r.status === 'approved' : r.status === 'pending')

  const canCancel = r && ['pending', 'approved'].includes(r.status) && r.payment?.status !== 'paid'
  const needTerms = readyForPayment && !r.terms_acknowledged && r.payment?.status !== 'paid'
  const canPay    = readyForPayment && r.terms_acknowledged && r.payment?.status !== 'paid'
  const hasPaid   = r && r.payment?.status === 'paid'
  const awaitingApproval = r && r.status === 'pending' && hasPaid

  const duration  = r?.start_time && r?.end_time
    ? (new Date(`2000-01-01T${r.end_time}`) - new Date(`2000-01-01T${r.start_time}`)) / 3_600_000
    : null

  const title = r ? `Reservation #${r.id}` : 'Reservation Details'

  const footer = r && (
    <div className="flex flex-wrap items-center gap-2">
      {awaitingAdminApproval && (
        <span className="text-sm text-[#B7950B]">Awaiting admin approval before payment.</span>
      )}
      {needTerms && (
        <Button size="sm" onClick={() => toast.info('Please review your terms below.')}>
          Review Terms
        </Button>
      )}
      {canPay && (
        <Button size="sm" onClick={() => setShowPayment(true)}>Proceed to Payment</Button>
      )}
      {awaitingApproval && (
        <span className="text-sm text-[#B7950B]">Payment received — confirming your reservation…</span>
      )}
      {hasPaid && (
        <Button variant="outline" size="sm" onClick={() => setShowReceipt(true)}>View Receipt</Button>
      )}
      {hasPaid && (
        <Button variant="outline" size="sm" onClick={downloadPdf} className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download PDF
        </Button>
      )}
      {r?.authorization_letter_path && (
        <Button variant="outline" size="sm" onClick={downloadAuthorizationLetter} className="flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5" /> Your Authorization Letter
        </Button>
      )}
      {canCancel && (
        <Button
          variant="danger"
          size="sm"
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
  )

  return (
    <>
      <Modal title={title} onClose={onClose} size="xl" footer={footer || undefined}>
        {isLoading && <div className="flex justify-center py-10"><Spinner size="lg" /></div>}

        {(error || (!isLoading && !r)) && (
          <p className="text-center text-red-500 py-6">Reservation not found.</p>
        )}

        {r && (
          <div className="space-y-4">
            {/* Status badges */}
            <div className="flex gap-2 flex-wrap">
              <TypeBadge type={r.type} />
              <Badge status={r.status} />
              {r.payment && r.payment.status !== 'pending' && <Badge status={r.payment.status} />}
            </div>

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
                        <span key={a.id} className="bg-[#FADBD8] text-[#96281B] text-xs px-2.5 py-1 rounded-full border border-[#F1948A]">
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
          </div>
        )}
      </Modal>

      {showPayment && (
        <PaymentModal
          reservationId={reservationId}
          onClose={() => setShowPayment(false)}
          onViewReceipt={() => { setShowPayment(false); setShowReceipt(true) }}
        />
      )}
      {showReceipt && (
        <ReceiptModal reservationId={reservationId} onClose={() => setShowReceipt(false)} />
      )}
    </>
  )
}
