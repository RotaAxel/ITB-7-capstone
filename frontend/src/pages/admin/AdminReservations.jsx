import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Check, X, ChevronLeft, ChevronRight, CalendarDays, Clock, ClipboardList, AlertCircle, CheckCircle2, Banknote, Eye, FileCheck } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import TypeBadge from '@/components/ui/TypeBadge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Modal from '@/components/ui/Modal'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'
import ReceiptModal from '@/components/ReceiptModal'

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
  rejected:  'border-l-[#C0392B]',
  cancelled: 'border-l-[#717D7E]',
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500',
]

function avatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function AdminReservations() {
  const queryClient = useQueryClient()

  const [status, setStatus]           = useState('all')
  const [date,   setDate]             = useState('')
  const [search, setSearch]           = useState('')
  const [page,   setPage]             = useState(1)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNote,  setRejectNote]  = useState('')
  const [detailModal, setDetailModal] = useState(null)
  const [receiptId,   setReceiptId]   = useState(null)

  const downloadAuthorizationLetter = (id) => {
    api.get(`/reservations/${id}/authorization-letter`, { responseType: 'blob' })
      .then(res => {
        // Extension varies (pdf/jpg/png) — infer it from the blob's MIME type rather
        // than hardcoding one, since setting `a.download` overrides the filename the
        // server suggested via Content-Disposition.
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

  const params = {
    page,
    ...(status !== 'all' && { status }),
    ...(date   && { date }),
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'reservations', params],
    queryFn: () => api.get('/admin/reservations', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  // Separate query for pending count badge (no date/status filter)
  const { data: pendingData } = useQuery({
    queryKey: ['admin', 'reservations', 'pending-count'],
    queryFn: () => api.get('/admin/reservations', { params: { status: 'pending', per_page: 1 } }).then(r => r.data),
    staleTime: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: id => api.put(`/admin/reservations/${id}/approve`),
    onSuccess: () => {
      toast.success('Reservation approved.')
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to approve.'),
  })

  const cancelMutation = useMutation({
    mutationFn: id => api.post(`/reservations/${id}/cancel`),
    onSuccess: () => {
      toast.success('Reservation cancelled.')
      setDetailModal(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to cancel.'),
  })

  const completeMutation = useMutation({
    mutationFn: id => api.put(`/admin/reservations/${id}/complete`),
    onSuccess: () => {
      toast.success('Reservation marked as completed.')
      setDetailModal(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to complete.'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) =>
      api.put(`/admin/reservations/${id}/reject`, { admin_note: note }),
    onSuccess: () => {
      toast.success('Reservation rejected.')
      setRejectModal(null)
      setRejectNote('')
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to reject.'),
  })

  const changeStatus = s => { setStatus(s); setPage(1) }
  const changeDate   = d => { setDate(d);   setPage(1) }

  const allRows  = data?.data         ?? []
  const searchSuggestions = useMemo(() => [
    ...allRows.map(r => r.user?.full_name),
    ...allRows.map(r => r.user?.email),
    ...allRows.map(r => r.facility?.name),
  ], [allRows])
  const rows     = allRows.filter(r => {
    const q = search.trim().toLowerCase()
    return !q ||
      r.user?.full_name?.toLowerCase().includes(q) ||
      r.user?.email?.toLowerCase().includes(q) ||
      r.facility?.name?.toLowerCase().includes(q)
  })
  const lastPage = data?.last_page    ?? 1
  const curPage  = data?.current_page ?? 1
  const total    = data?.total        ?? 0
  const pending  = pendingData?.total ?? 0

  const awaitingApprovalCount = rows.filter(r => r.status === 'pending' && r.payment?.status === 'paid').length
  const confirmedCount        = rows.filter(r => r.status === 'confirmed').length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Reservations</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Review and manage all reservation requests</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',     value: total,          icon: ClipboardList,  color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Pending',   value: pending,             icon: AlertCircle,    color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Awaiting Approval', value: awaitingApprovalCount, icon: CheckCircle2, color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Confirmed', value: confirmedCount,      icon: Banknote,       color: 'text-[#8E44AD] bg-[#F5EEF8]' },
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

      {/* Search bar */}
      <SearchAutocomplete
        value={search}
        onChange={v => { setSearch(v); setPage(1) }}
        suggestions={searchSuggestions}
        placeholder="Search by client name, email, or facility…"
        inputClassName="w-full pl-11 pr-4 h-11 rounded-xl border-2 border-[#FADBD8] bg-white text-sm text-[#1C2833] placeholder-[#717D7E] shadow-sm focus:outline-none focus:border-[#C0392B] focus:ring-2 focus:ring-[#FADBD8] transition-colors"
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => changeStatus(s.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                status === s.value
                  ? 'bg-[#C0392B] text-white border-[#C0392B]'
                  : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={e => changeDate(e.target.value)}
            className="h-9 text-sm w-40"
          />
          {date && (
            <Button variant="ghost" size="sm" onClick={() => changeDate('')}>Clear</Button>
          )}
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#1C2833] gap-2">
              <CalendarDays className="h-10 w-10 opacity-30" />
              <p className="text-sm">No reservations found.</p>
            </div>
          ) : (
            <div className={`transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {/* Column headers */}
              <div className="grid grid-cols-12 px-5 py-3 bg-[#FADBD8]/40 text-xs font-semibold text-[#96281B] uppercase tracking-wide border-b border-[#E5E7E9]">
                <div className="col-span-3">Client</div>
                <div className="col-span-2">Facility</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-1">Amount</div>
                <div className="col-span-2 text-right">Status</div>
              </div>

              <div className="divide-y divide-[#E5E7E9]">
                {rows.map(r => {
                  const name   = r.user?.full_name ?? ''
                  const border = STATUS_BORDER[r.status] ?? 'border-l-gray-300'
                  const duration = r.start_time && r.end_time
                    ? (new Date(`2000-01-01T${r.end_time}`) - new Date(`2000-01-01T${r.start_time}`)) / 3_600_000
                    : null

                  return (
                    <div
                      key={r.id}
                      onClick={() => setDetailModal(r)}
                      className={`grid grid-cols-12 items-center px-5 py-4 border-l-4 ${border} hover:bg-[#FADBD8]/10 transition-colors cursor-pointer gap-2`}
                    >
                      {/* Client */}
                      <div className="col-span-3 flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${avatarColor(name)}`}>
                          {initials(name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1C2833] truncate">{name || '—'}</p>
                          <p className="text-xs text-[#1C2833] truncate">{r.user?.email}</p>
                        </div>
                      </div>

                      {/* Facility */}
                      <div className="col-span-2 min-w-0">
                        <p className="text-sm font-medium text-[#1C2833] truncate">{r.facility?.name ?? '—'}</p>
                        {r.facility?.location && (
                          <p className="text-xs text-[#1C2833] truncate">{r.facility.location}</p>
                        )}
                      </div>

                      {/* Date */}
                      <div className="col-span-2">
                        <p className="text-sm text-[#1C2833] flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 text-[#1C2833] shrink-0" />
                          {r.reservation_date ? format(parseISO(r.reservation_date), 'MMM d, yyyy') : '—'}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="col-span-2">
                        <p className="text-sm text-[#1C2833] flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#1C2833] shrink-0" />
                          {r.start_time?.slice(0, 5)} – {r.end_time?.slice(0, 5)}
                        </p>
                        {duration != null && (
                          <p className="text-xs text-[#1C2833] mt-0.5">{duration}h duration</p>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="col-span-1">
                        <p className="text-sm font-semibold text-[#1C2833]">
                          ₱{Number(r.payment?.amount ?? 0).toLocaleString()}
                        </p>
                      </div>

                      {/* Status + quick actions */}
                      <div className="col-span-2 flex flex-col items-end gap-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {r.authorization_letter_path && (
                            <FileCheck className="h-3.5 w-3.5 text-[#8E44AD]" title="Authorization letter attached" />
                          )}
                          <TypeBadge type={r.type} />
                          <Badge status={r.status} />
                        </div>
                        {/* "Reserve" is approved before payment (unlocks it); "Book" pays
                            first and auto-confirms, so its Approve here is just a manual
                            fallback for a stuck payment webhook. */}
                        {r.status === 'pending' && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {r.type === 'reserve' || r.payment?.status === 'paid' ? (
                              <button
                                onClick={() => approveMutation.mutate(r.id)}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors cursor-pointer"
                                title="Approve"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#B7950B] self-center">Awaiting payment</span>
                            )}
                            {(r.type === 'reserve' || r.payment?.status !== 'paid') && (
                              <button
                                onClick={() => { setRejectModal({ id: r.id, clientName: name }); setRejectNote('') }}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Reject"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        {r.status === 'approved' && (
                          <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
                            <span className="text-[11px] text-[#2980B9] self-center">Awaiting client payment</span>
                            <button
                              onClick={() => { setRejectModal({ id: r.id, clientName: name }); setRejectNote('') }}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                              title="Revoke approval"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7E9]">
              <p className="text-sm text-[#1C2833]">
                Page {curPage} of {lastPage} &middot; {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={curPage <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={curPage >= lastPage}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      {detailModal && (() => {
        const r = detailModal
        const duration = r.start_time && r.end_time
          ? (new Date(`2000-01-01T${r.end_time}`) - new Date(`2000-01-01T${r.start_time}`)) / 3_600_000
          : null
        return (
          <Modal
            title="Reservation Details"
            onClose={() => setDetailModal(null)}
            footer={
              <div className="flex items-center justify-between gap-2">
                {/* "Reserve" is approved before payment (unlocks it); "Book" pays
                    first and auto-confirms, so its Approve here is just a manual
                    fallback for a stuck payment webhook. */}
                {r.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    {r.type === 'reserve' || r.payment?.status === 'paid' ? (
                      <Button
                        loading={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(r.id, { onSuccess: () => setDetailModal(null) })}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    ) : (
                      <span className="text-sm text-[#B7950B]">Awaiting payment</span>
                    )}
                    {(r.type === 'reserve' || r.payment?.status !== 'paid') && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          setDetailModal(null)
                          setRejectModal({ id: r.id, clientName: r.user?.full_name ?? '' })
                          setRejectNote('')
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                  </div>
                )}
                {r.status === 'approved' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#2980B9]">Awaiting client payment</span>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setDetailModal(null)
                        setRejectModal({ id: r.id, clientName: r.user?.full_name ?? '' })
                        setRejectNote('')
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Revoke Approval
                    </Button>
                  </div>
                )}
                {r.status === 'confirmed' && (() => {
                  const hasEnded = r.reservation_date && r.end_time
                    && new Date(`${r.reservation_date}T${r.end_time}`) <= new Date()
                  return hasEnded ? (
                    <Button
                      loading={completeMutation.isPending}
                      onClick={() => completeMutation.mutate(r.id)}
                      className="bg-[#8E44AD] hover:bg-[#7D3C98] text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Mark as Completed
                    </Button>
                  ) : (
                    <span className="text-xs text-[#1C2833] italic">
                      Available after {r.end_time?.slice(0, 5)} on {r.reservation_date}
                    </span>
                  )
                })()}
                {['pending', 'approved'].includes(r.status) && r.payment?.status !== 'paid' && (
                  <Button
                    variant="danger"
                    loading={cancelMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Cancel reservation for ${r.user?.full_name}?`)) {
                        cancelMutation.mutate(r.id)
                      }
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel Reservation
                  </Button>
                )}
                {!['pending', 'approved', 'confirmed'].includes(r.status) && <span />}
                <Button variant="outline" onClick={() => setDetailModal(null)}>Close</Button>
              </div>
            }
          >
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-[#1C2833] w-28 shrink-0">Type</dt>
                <dd><TypeBadge type={r.type} /></dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-[#1C2833] w-28 shrink-0">Status</dt>
                <dd><Badge status={r.status} /></dd>
              </div>
              {[
                ['Client',       r.user?.full_name],
                ['Email',        r.user?.email],
                ['Facility',     r.facility?.name],
                ['Date',         r.reservation_date ? format(parseISO(r.reservation_date), 'MMMM d, yyyy') : '—'],
                ['Time',         r.start_time && r.end_time ? `${r.start_time.slice(0,5)} – ${r.end_time.slice(0,5)}` : '—'],
                ['Duration',     duration != null ? `${duration}h` : '—'],
                ['Participants', r.number_of_participants],
                ['Purpose',      r.purpose],
                ['Amount',       r.payment ? `₱${Number(r.payment.amount).toLocaleString()}` : '—'],
                ['Payment',      r.payment?.status ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-[#1C2833] w-28 shrink-0">{label}</dt>
                  <dd className="text-gray-900 font-medium">{value ?? '—'}</dd>
                </div>
              ))}
              {r.payment?.status === 'paid' && (
                <div className="flex gap-2">
                  <dt className="text-[#1C2833] w-28 shrink-0">Receipt</dt>
                  <dd>
                    <button
                      onClick={() => setReceiptId(r.id)}
                      className="flex items-center gap-1.5 text-[#2980B9] hover:underline font-medium"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Receipt
                    </button>
                  </dd>
                </div>
              )}
              {r.authorization_letter_path && (
                <div className="flex gap-2">
                  <dt className="text-[#1C2833] w-28 shrink-0">Auth. Letter</dt>
                  <dd>
                    <button
                      onClick={() => downloadAuthorizationLetter(r.id)}
                      className="flex items-center gap-1.5 text-[#2980B9] hover:underline font-medium"
                    >
                      <FileCheck className="h-3.5 w-3.5" /> Download Authorization Letter
                    </button>
                  </dd>
                </div>
              )}
              {r.admin_note && (
                <div className="flex gap-2">
                  <dt className="text-[#1C2833] w-28 shrink-0">Admin Note</dt>
                  <dd className="text-orange-700">{r.admin_note}</dd>
                </div>
              )}
            </dl>
          </Modal>
        )
      })()}

      {/* Reject modal */}
      {rejectModal && (
        <Modal
          title="Reject Reservation"
          onClose={() => setRejectModal(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!rejectNote.trim() || rejectMutation.isPending}
                loading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectModal.id, note: rejectNote })}
              >
                Confirm Rejection
              </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600 mb-3">
            Rejecting reservation from <strong>{rejectModal.clientName}</strong>.
            A reason is required and will be sent to the client.
          </p>
          <Label>Reason for rejection *</Label>
          <textarea
            rows={3}
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
            placeholder="e.g. Facility is unavailable on this date due to a scheduled event."
            className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
          />
        </Modal>
      )}

      {receiptId && (
        <ReceiptModal reservationId={receiptId} onClose={() => setReceiptId(null)} />
      )}
    </div>
  )
}
