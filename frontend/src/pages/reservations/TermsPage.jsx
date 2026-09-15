import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

const termsFor = type => [
  {
    heading: '1. Reservation Policy',
    body: type === 'book'
      ? 'All bookings are subject to availability. A "Book" reservation is confirmed automatically as soon as full payment is received — no staff approval is required.'
      : 'All reservations are subject to availability. A "Reserve" request must first be reviewed and approved by CABS administration — you\'re only asked to pay once it\'s approved, and payment then confirms it.',
  },
  {
    heading: '2. Payment',
    body: type === 'book'
      ? 'Full payment is required to instantly confirm your booking. Accepted methods include GCash, Maya, and online banking.'
      : 'Since your request has already been approved, full payment now confirms your reservation. Accepted methods include GCash, Maya, and online banking. Unpaid approved requests may be forfeited if payment is not completed promptly.',
  },
  {
    heading: '3. Cancellation & Refund',
    body: 'Cancellations made before payment are free of charge. Once payment has been made, no refunds will be issued. CABS reserves the right to cancel any reservation for maintenance or emergency situations.',
  },
  {
    heading: '4. Facility Use Rules',
    body: 'Users must maintain cleanliness and order within the facility. No food or beverages inside courts unless specified. Participants must wear appropriate athletic attire and footwear.',
  },
  {
    heading: '5. Liability',
    body: 'CABS is not liable for any injury, loss, or damage incurred during the use of the facilities. Users are responsible for any damage caused to the facilities or equipment.',
  },
  {
    heading: '6. Compliance',
    body: 'All users must comply with CABS rules and regulations. Non-compliance may result in immediate termination of the reservation without refund and may affect future booking privileges.',
  },
]

export default function TermsPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const [agreed, setAgreed] = useState(false)

  const { data: reservation, isLoading } = useQuery({
    queryKey: ['reservation', id],
    queryFn: () => api.get(`/reservations/${id}`).then(r => r.data),
  })

  const acknowledgeMutation = useMutation({
    mutationFn: () => api.post(`/reservations/${id}/acknowledge-terms`),
    onSuccess: () => {
      toast.success('Terms acknowledged. Proceeding to payment.')
      queryClient.invalidateQueries({ queryKey: ['reservation', id] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      navigate(`/reservations/${id}/payment`, { replace: true })
    },
    onError: () => toast.error('Failed to acknowledge terms.'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

  if (reservation?.terms_acknowledged) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Terms Already Acknowledged</h2>
        <p className="text-[#1C2833] mb-6">You have already agreed to the terms and conditions.</p>
        <Link to={`/reservations/${id}/payment`} replace>
          <Button>Proceed to Payment</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-[#1C2833] hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-6 w-6 text-[#C0392B]" />
        <h1 className="text-2xl font-bold text-[#1C2833]">Terms and Conditions</h1>
      </div>
      <p className="text-[#1C2833] text-sm mb-6">
        Please read and acknowledge the following terms before proceeding to payment.
      </p>

      <Card className="mb-5">
        <CardContent className="space-y-5 py-5">
          {termsFor(reservation?.type).map(({ heading, body }) => (
            <div key={heading}>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">{heading}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <label className="flex items-start gap-3 p-4 bg-[#FADBD8]/20 rounded-lg border border-[#F1948A]/30 mb-5 cursor-pointer">
        <input
          type="checkbox"
          id="agree"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[#E5E7E9] text-[#C0392B] shrink-0"
        />
        <span className="text-sm text-gray-700">
          I have read and agree to the Terms and Conditions stated above. I understand that payment
          is required to confirm my reservation, and that cancellations after payment are
          non-refundable.
        </span>
      </label>

      <Button
        disabled={!agreed || acknowledgeMutation.isPending}
        loading={acknowledgeMutation.isPending}
        className="w-full"
        onClick={() => acknowledgeMutation.mutate()}
      >
        I Agree — Proceed to Payment
      </Button>
    </div>
  )
}
