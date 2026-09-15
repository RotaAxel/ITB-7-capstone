import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, ExternalLink, CreditCard, Smartphone, Building2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import api from '@/api/axios'
import Modal from '@/components/ui/Modal'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function PaymentModal({ reservationId, onClose, onViewReceipt }) {
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState('idle')
  const [checkoutUrl, setCheckoutUrl] = useState(null)

  const { data: reservation, isLoading } = useQuery({
    queryKey: ['reservation', String(reservationId)],
    queryFn: () => api.get(`/reservations/${reservationId}`).then(r => r.data),
  })

  const createLinkMutation = useMutation({
    mutationFn: () => api.post(`/payments/${reservationId}/create-link`),
    onSuccess: res => {
      const url = res.data.checkout_url
      if (url) {
        setCheckoutUrl(url)
        window.open(url, '_blank', 'noopener,noreferrer')
        setPhase('opened')
      } else {
        toast.error('No checkout URL returned. Please try again.')
      }
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to create payment link.'),
  })

  const verifyMutation = useMutation({
    mutationFn: () => api.get(`/payments/${reservationId}/status`),
    onSuccess: res => {
      if (res.data.status === 'paid') {
        setPhase('success')
        queryClient.invalidateQueries({ queryKey: ['reservations'] })
        queryClient.invalidateQueries({ queryKey: ['reservation', String(reservationId)] })
      } else {
        setPhase('failed')
      }
    },
    onError: () => setPhase('failed'),
  })

  const r = reservation

  // Payment must be accomplished before a reservation can go anywhere (approval
  // included) — closing out unpaid means it should never have been added.
  const handleClose = () => {
    if (phase !== 'success' && r?.status === 'pending') {
      toast.info(
        r.type === 'book'
          ? 'Booking not completed — no payment was made.'
          : 'Reservation not completed — no payment was made.'
      )
      api.delete(`/reservations/${reservationId}`).catch(() => {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ['reservations'] })
        queryClient.invalidateQueries({ queryKey: ['reservation', String(reservationId)] })
      })
    }
    onClose()
  }

  const titles = {
    idle:   'Complete Payment',
    opened: 'Complete Your Payment',
    success: r?.type === 'book' ? 'Booking Confirmed' : 'Reservation Confirmed',
    failed: 'Payment Not Confirmed',
  }

  let body

  if (isLoading) {
    body = <div className="flex justify-center py-8"><Spinner size="lg" /></div>

  } else if (phase === 'success') {
    // Payment only unlocks for a "reserve" once it's already been approved (see
    // PaymentController), so a successful payment confirms it outright either way.
    body = (
      <div className="flex flex-col items-center text-center py-6">
        <CheckCircle2 className="h-16 w-16 text-[#27AE60] mb-4" />
        <h2 className="text-xl font-bold text-[#1C2833] mb-2">
          {r?.type === 'book' ? 'Booking Confirmed!' : 'Reservation Confirmed!'}
        </h2>
        <p className="text-[#1C2833] mb-6">
          {r?.type === 'book'
            ? 'Your booking is confirmed — no approval needed.'
            : 'Your reservation is confirmed!'}
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          {onViewReceipt && (
            <Button onClick={onViewReceipt}>View Receipt</Button>
          )}
          <Button variant="outline" onClick={handleClose}>Close</Button>
        </div>
      </div>
    )

  } else if (phase === 'failed') {
    body = (
      <div className="flex flex-col items-center text-center py-6">
        <XCircle className="h-16 w-16 text-[#C0392B] mb-4" />
        <h2 className="text-xl font-bold text-[#1C2833] mb-2">Payment Not Confirmed</h2>
        <p className="text-[#1C2833] mb-2">Your payment hasn't been recorded yet.</p>
        <p className="text-sm text-[#1C2833] mb-6">
          If you already paid, please wait a moment and try verifying again.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          {checkoutUrl && (
            <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><ExternalLink className="h-4 w-4" /> Re-open PayMongo</Button>
            </a>
          )}
          <Button onClick={() => verifyMutation.mutate()} loading={verifyMutation.isPending}>
            <RefreshCw className="h-4 w-4" /> Verify Again
          </Button>
          <Button variant="outline" onClick={() => setPhase('idle')}>Start Over</Button>
        </div>
      </div>
    )

  } else if (phase === 'opened') {
    body = (
      <div className="space-y-4">
        <Card className="bg-[#EBF5FB] border-[#AED6F1]">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-[#1A5276] mb-1">PayMongo checkout opened in a new tab</p>
            <p className="text-sm text-[#1A5276]">
              Complete your payment there, then click <strong>I've Paid</strong> to confirm.
            </p>
            {checkoutUrl && (
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#2980B9] hover:underline font-medium">
                <ExternalLink className="h-3.5 w-3.5" /> Open checkout again
              </a>
            )}
          </CardContent>
        </Card>

        {r && (
          <Card className="bg-[#FADBD8]/30 border-[#F1948A]/30">
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-[#1C2833]">{r.facility?.name}</p>
              <p className="text-sm text-[#C0392B] mt-0.5">
                {r.reservation_date}
                {r.start_time && r.end_time && <> · {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</>}
              </p>
              <p className="text-3xl font-bold text-[#1C2833] mt-3">
                ₱{Number(r.payment?.amount ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}

        <Button className="w-full" size="lg" loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
          <CheckCircle2 className="h-4 w-4" />
          {verifyMutation.isPending ? 'Verifying…' : "I've Paid — Verify Now"}
        </Button>
        <button onClick={() => setPhase('idle')} className="w-full text-sm text-[#1C2833] hover:text-[#1C2833] py-1 transition-colors">
          Go back
        </button>
      </div>
    )

  } else {
    body = (
      <div className="space-y-4">
        {r && (
          <Card className="bg-[#FADBD8]/30 border-[#F1948A]/30">
            <CardContent className="py-4">
              <p className="text-sm font-semibold text-[#1C2833]">{r.facility?.name}</p>
              <p className="text-sm text-[#C0392B] mt-0.5">
                {r.reservation_date}
                {r.start_time && r.end_time && <> · {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}</>}
              </p>
              <p className="text-3xl font-bold text-[#1C2833] mt-3">
                ₱{Number(r.payment?.amount ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold text-[#1C2833] uppercase tracking-wide mb-3">Accepted Payment Methods</p>
            <div className="flex flex-wrap gap-3 text-sm text-[#4A4A4A]">
              <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-[#2980B9]" /> GCash</span>
              <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-[#8E44AD]" /> Maya</span>
              <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-[#27AE60]" /> Online Banking</span>
              <span className="flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-[#1C2833]" /> Card</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 bg-[#EBF5FB] border border-[#AED6F1] rounded-lg p-3">
          <ExternalLink className="h-4 w-4 text-[#2980B9] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#1A5276]">
            PayMongo checkout will open in a <strong>new tab</strong>. After paying, return here and click <strong>I've Paid</strong>.
          </p>
        </div>

        <Button className="w-full" size="lg" loading={createLinkMutation.isPending} onClick={() => createLinkMutation.mutate()}>
          <ExternalLink className="h-4 w-4" />
          {createLinkMutation.isPending ? 'Opening PayMongo…' : 'Pay Now via PayMongo'}
        </Button>

        <p className="text-center text-xs text-[#1C2833] flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" /> Secured by PayMongo. CABS does not store your payment details.
        </p>
      </div>
    )
  }

  return (
    <Modal title={titles[phase] ?? 'Payment'} onClose={handleClose} size="md">
      {body}
    </Modal>
  )
}
