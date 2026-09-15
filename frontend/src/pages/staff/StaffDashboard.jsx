import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, isToday, startOfWeek } from 'date-fns'
import { toast } from 'sonner'
import { Clock, CalendarCheck, CheckCircle2, ClipboardList, ArrowRight, Check, X as XIcon } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import TypeBadge from '@/components/ui/TypeBadge'
import { cn } from '@/lib/utils'

export default function StaffDashboard() {
  const qc = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  const { data: allRes = [], isLoading } = useQuery({
    queryKey: ['admin', 'reservations', 'all'],
    queryFn: () => api.get('/admin/reservations').then(r => r.data?.data ?? r.data ?? []),
  })

  const today    = new Date()
  const weekStart = startOfWeek(today)
  const pending   = allRes.filter(r => r.status === 'pending')
  // "Reserve" requests need review while still unpaid (approval unlocks their
  // payment step); "Book" reservations only need a manual look if payment
  // already went through but the auto-confirm webhook hasn't landed yet.
  const needsReview = pending.filter(r => r.type === 'reserve' || r.payment?.status === 'paid')
  const todayRes  = allRes.filter(r => r.reservation_date && isToday(parseISO(r.reservation_date)) && (r.status === 'confirmed' || (r.status === 'pending' && r.payment?.status === 'paid')))
  const approvedWk = allRes.filter(r => r.status === 'confirmed' && r.reviewed_at && new Date(r.reviewed_at) >= weekStart)
  const active    = allRes.filter(r => ['pending','confirmed'].includes(r.status))

  const approveMutation = useMutation({
    mutationFn: id => api.put(`/admin/reservations/${id}/approve`),
    onSuccess: () => { toast.success('Reservation approved'); qc.invalidateQueries({ queryKey: ['admin'] }) },
    onError: err => toast.error(err.response?.data?.message ?? 'Failed to approve'),
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => api.put(`/admin/reservations/${id}/reject`, { admin_note: note }),
    onSuccess: () => { toast.success('Rejected'); setRejectTarget(null); setRejectNote(''); qc.invalidateQueries({ queryKey: ['admin'] }) },
    onError: err => toast.error(err.response?.data?.message ?? 'Failed to reject'),
  })

  const kpis = [
    { label: 'Needs Your Review',  value: needsReview.length, icon: Clock,         color: 'text-[#B7950B] bg-[#FEF9E7]', pulse: needsReview.length > 0, to: '/staff/reservations?status=pending' },
    { label: 'Scheduled Today',    value: todayRes.length,   icon: CalendarCheck, color: 'text-[#C0392B] bg-[#FADBD8]', to: '/staff/calendar' },
    { label: 'Approved This Week', value: approvedWk.length, icon: CheckCircle2,  color: 'text-[#1E8449] bg-[#EAFAF1]', to: '/staff/reservations' },
    { label: 'Active Bookings',    value: active.length,     icon: ClipboardList, color: 'text-[#2980B9] bg-[#D6EAF8]', to: '/staff/reservations' },
  ]

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Staff Panel</h1>
        <p className="text-[#1C2833] text-sm">Manage reservations and facility schedules</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, pulse, to }) => (
          <Link key={label} to={to}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  {pulse && <span className="w-2.5 h-2.5 rounded-full bg-[#C0392B] animate-pulse" />}
                </div>
                <p className="text-2xl font-bold text-[#1C2833]">{value}</p>
                <p className="text-xs text-[#1C2833] mt-0.5 leading-tight">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Pending Reservations
              {pending.length > 0 && (
                <span className="ml-2 bg-[#C0392B] text-white text-[10px] px-2 py-0.5 rounded-full">{pending.length}</span>
              )}
            </CardTitle>
            <Link to="/staff/reservations?status=pending" className="text-xs text-[#2980B9] hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {pending.length === 0 ? (
              <p className="text-center text-[#1C2833] text-sm py-10">No pending reservations</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#FADBD8] border-b border-[#E5E7E9]">
                    <tr>
                      {['Client','Facility','Date','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-[#96281B]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E9]">
                    {pending.slice(0, 8).map(r => (
                      <tr key={r.id} className="hover:bg-[#FADBD8]/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-[#1C2833] text-xs">{r.user?.full_name}</p>
                            <TypeBadge type={r.type} />
                          </div>
                          <p className="text-[10px] text-[#1C2833]">{r.user?.email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#1C2833]">{r.facility?.name}</td>
                        <td className="px-4 py-2.5 text-xs text-[#1C2833]">
                          {r.reservation_date ? format(parseISO(r.reservation_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            {r.type === 'reserve' || r.payment?.status === 'paid' ? (
                              <button onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}
                                className="p-1.5 rounded-lg bg-[#EAFAF1] text-[#1E8449] hover:bg-[#A9DFBF] transition-colors cursor-pointer" title="Approve">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#B7950B]">Awaiting payment</span>
                            )}
                            {(r.type === 'reserve' || r.payment?.status !== 'paid') && (
                              <button onClick={() => setRejectTarget(r)}
                                className="p-1.5 rounded-lg bg-[#FADBD8] text-[#C0392B] hover:bg-[#F1948A] transition-colors cursor-pointer" title="Reject">
                                <XIcon className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's schedule */}
        <Card>
          <CardHeader><CardTitle>Today's Schedule</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            {todayRes.length === 0 ? (
              <p className="text-center text-[#1C2833] text-sm py-8">No reservations today</p>
            ) : (
              todayRes
                .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
                .map(r => (
                  <div key={r.id} className={cn('flex gap-3 p-2.5 rounded-lg border-l-4',
                    r.status === 'confirmed' ? 'border-[#27AE60] bg-[#EAFAF1]/40' :
                    r.status === 'approved'  ? 'border-[#2980B9] bg-[#D6EAF8]/40' :
                    'border-[#F39C12] bg-[#FEF9E7]/40'
                  )}>
                    <div>
                      <p className="text-xs font-semibold text-[#1C2833]">{r.start_time?.slice(0,5)} – {r.end_time?.slice(0,5)}</p>
                      <p className="text-xs text-[#1C2833]">{r.facility?.name}</p>
                      <p className="text-[10px] text-[#1C2833]">{r.user?.full_name}</p>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      {rejectTarget && (
        <Modal isOpen onClose={() => setRejectTarget(null)} title="Reject Reservation">
          <p className="text-sm text-[#1C2833] mb-3">
            Reject reservation for <strong>{rejectTarget.user?.full_name}</strong> at <strong>{rejectTarget.facility?.name}</strong>?
          </p>
          <textarea
            className="w-full border border-[#E5E7E9] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C0392B] focus:ring-2 focus:ring-[#FADBD8] resize-none"
            rows={3} placeholder="Admin note (optional)"
            value={rejectNote} onChange={e => setRejectNote(e.target.value)}
          />
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: rejectTarget.id, note: rejectNote })}>
              Reject
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
