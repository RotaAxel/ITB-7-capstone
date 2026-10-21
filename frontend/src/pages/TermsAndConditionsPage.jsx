import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// General, system-wide clauses only — not tied to a specific reservation, so
// unlike TermsPage.jsx (which needs a reservation to read "book" vs "reserve"
// off of, and shows that facility's own specific rules) this merges both
// paths into neutral wording and skips facility-specific rules entirely,
// which only make sense once a facility is actually picked. Kept in sync by
// hand with termsFor() in NewReservationModal.jsx / NewReservation.jsx /
// TermsPage.jsx — clauses 1 and 2 are the two that differ there by type.
const TERMS = [
  {
    heading: '1. Reservation Policy',
    body: 'All bookings and reservations are subject to availability. A "Book" reservation is confirmed automatically as soon as full payment is received — no staff approval is required. A "Reserve" request must first be reviewed and approved by CABS administration before payment is requested; payment then confirms it.',
  },
  {
    heading: '2. Payment',
    body: 'Full payment is required to confirm a reservation — immediately for a "Book" reservation, or once a "Reserve" request has been approved. Accepted methods include GCash, Maya, and online banking. Approved "Reserve" requests left unpaid for too long may be forfeited.',
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
  {
    heading: '7. City Hall Authority',
    body: 'CABS facilities are government property. The Cabuyao City Hall / local government may cancel or pre-empt any reservation at any time — for public events, emergencies, maintenance, or other administrative directives — even after approval or payment. Affected clients will be notified as soon as possible and are entitled to a full refund for any reservation cancelled on this basis.',
  },
  {
    heading: '8. Crowd Management (Large Events)',
    body: 'For events with 50 or more participants, the client is solely responsible for providing adequate crowd management — entry/exit, crowd flow, and security — both during and after the event. CABS does not provide crowd management services itself.',
  },
  {
    heading: '9. Waste Management',
    body: 'Regardless of event size, the client is solely responsible for providing adequate waste management and disposal, both during and after the event. CABS does not provide waste management services itself.',
  },
]

export default function TermsAndConditionsPage() {
  const { isAuthenticated, user } = useAuth()

  const homeLink = !isAuthenticated ? '/'
    : user?.role === 'administrator' ? '/admin/dashboard'
    : user?.role === 'staff'         ? '/staff/dashboard'
    : '/dashboard'

  return (
    <div className="min-h-screen bg-white text-[#1C2833]">
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E5E7E9] shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={homeLink} className="flex items-center gap-2.5">
            <img src="/logoCabs.png" alt="CABS" className="h-9 w-auto object-contain" />
            <p className="text-[10px] text-[#1C2833] leading-none">Reservation System</p>
          </Link>
          {!isAuthenticated && (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-[#1C2833] hover:text-[#C0392B] transition-colors px-3 py-1.5">
                Sign In
              </Link>
              <Link to="/register" className="text-sm font-semibold bg-[#C0392B] hover:bg-[#96281B] text-white px-4 py-2 rounded-lg transition-colors">
                Register Free
              </Link>
            </div>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-6 w-6 text-[#C0392B]" />
          <h1 className="text-2xl font-bold text-[#1C2833]">Terms and Conditions</h1>
        </div>
        <p className="text-sm text-[#1C2833] mb-8">
          These are the standard terms that apply to every CABS facility reservation. Individual facilities
          may have additional rules of their own — shown during booking, and summarized again before you
          confirm.
        </p>

        <div className="space-y-6">
          {TERMS.map(({ heading, body }) => (
            <div key={heading}>
              <h3 className="font-semibold text-gray-900 mb-1">{heading}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
