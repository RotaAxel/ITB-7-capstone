import { Clock, CheckCircle2, XCircle, MapPin } from 'lucide-react'

// Mirrors User::residency_status on the backend. Split into its own file
// (rather than living in ResidencyReviewModal.jsx) so that component can stay
// a component-only export — co-locating a constant export there breaks Fast
// Refresh (react-refresh/only-export-components).
export const RESIDENCY_META = {
  unverified: { label: 'Not Submitted',     icon: MapPin,       cls: 'text-gray-400' },
  pending:    { label: 'Pending Review',    icon: Clock,        cls: 'text-[#B7950B]' },
  verified:   { label: 'Verified Cabuyeño', icon: CheckCircle2, cls: 'text-[#1E8449]' },
  rejected:   { label: 'Rejected',          icon: XCircle,      cls: 'text-[#C0392B]' },
}
