import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'
import ResidencyReviewModal from '@/components/ResidencyReviewModal'
import { RESIDENCY_META } from '@/constants/residency'

const STATUS_FILTERS = [
  { value: 'all',      label: 'All'      },
  { value: 'pending',  label: 'Pending'  },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
]

function avatarColor(name = '') {
  const colors = ['bg-[#C0392B]','bg-[#2980B9]','bg-[#27AE60]','bg-[#8E44AD]','bg-[#E67E22]','bg-[#16A085]']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

// Admin's narrow slice of residency verification, carved back out after full
// User Management moved to staff-only (see routes/api.php and
// UserController::residencyReviewIndex) — only Cabuyeño proof review, nothing
// else from User Management. Staff keep the full AdminUsers.jsx page, which
// shares the same ResidencyReviewModal for the actual review/approve UI.
export default function AdminResidencyVerification() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)
  const [reviewing, setReviewing] = useState(null) // null | { ...user }

  const params = {
    page,
    ...(status !== 'all' && { status }),
    ...(search && { search }),
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'residency-reviews', params],
    queryFn: () => api.get('/admin/residency-reviews', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const users    = data?.data ?? []
  const lastPage = data?.last_page    ?? 1
  const curPage  = data?.current_page ?? 1
  const total    = data?.total        ?? 0

  const changeStatus = v => { setStatus(v); setPage(1) }
  const changeSearch = v => { setSearch(v); setPage(1) }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'residency-reviews'] })

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="h-8 w-56 bg-gray-100 animate-pulse rounded" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-xl" />)}
      </div>
      <div className="h-10 w-72 bg-gray-100 animate-pulse rounded-lg" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Residency Verification</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Review and approve Cabuyeño residency proofs</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending',  value: data?.counts?.pending  ?? 0, icon: Clock,        color: 'text-[#B7950B] bg-[#FEF9E7]' },
          { label: 'Verified', value: data?.counts?.verified ?? 0, icon: CheckCircle2, color: 'text-[#1E8449] bg-[#EAFAF1]' },
          { label: 'Rejected', value: data?.counts?.rejected ?? 0, icon: XCircle,      color: 'text-[#C0392B] bg-[#FADBD8]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
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

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => changeStatus(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === f.value
                  ? 'bg-[#C0392B] text-white border-[#C0392B]'
                  : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <SearchAutocomplete
          value={search}
          onChange={changeSearch}
          suggestions={users.map(u => u.full_name)}
          placeholder="Search client name or email…"
          wrapperClassName="sm:ml-auto relative"
          iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1C2833] pointer-events-none"
          inputClassName="block w-72 rounded-lg border border-gray-300 pl-9 pr-3 py-2 h-9 text-sm bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#1C2833] gap-2">
              <MapPin className="h-10 w-10 opacity-30" />
              <p className="text-sm">No residency submissions found.</p>
            </div>
          ) : (
            <div className={`divide-y divide-[#E5E7E9] transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {users.map(u => {
                const meta = RESIDENCY_META[u.residency_status]
                const Icon = meta.icon
                return (
                  <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#FADBD8]/10 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${avatarColor(u.full_name)}`}>
                        {initials(u.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C2833] truncate">{u.full_name}</p>
                        <p className="text-xs text-[#1C2833] truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.cls}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => setReviewing(u)}>Review</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7E9]">
            <p className="text-sm text-[#1C2833]">
              Page {curPage} of {lastPage} · <span className="font-medium text-[#1C2833]">{total}</span> submissions
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={curPage <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={curPage >= lastPage} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reviewing && (
        <ResidencyReviewModal
          user={reviewing}
          onClose={() => setReviewing(null)}
          onUpdated={invalidate}
        />
      )}
    </div>
  )
}
