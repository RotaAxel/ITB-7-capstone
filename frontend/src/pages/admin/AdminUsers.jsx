import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Users, UserCheck, ShieldCheck, Briefcase, MapPin, Clock, CheckCircle2, XCircle, Download } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Modal from '@/components/ui/Modal'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'

const ROLE_COLORS = {
  client:        { bg: 'bg-blue-100',   text: 'text-blue-700'  },
  staff:         { bg: 'bg-amber-100',  text: 'text-amber-700' },
  administrator: { bg: 'bg-red-100',    text: 'text-red-700'   },
}

function avatarColor(name = '') {
  const colors = ['bg-[#C0392B]','bg-[#2980B9]','bg-[#27AE60]','bg-[#8E44AD]','bg-[#E67E22]','bg-[#16A085]']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

const BLANK = {
  full_name: '', email: '', password: '', role: 'client',
  age: '', gender: '', address: '', contact_number: '',
}

// Mirrors User::residency_status on the backend.
const RESIDENCY_META = {
  unverified: { label: 'Not Submitted',    icon: MapPin,       cls: 'text-gray-400' },
  pending:    { label: 'Pending Review',   icon: Clock,        cls: 'text-[#B7950B]' },
  verified:   { label: 'Verified Cabuyeño',icon: CheckCircle2, cls: 'text-[#1E8449]' },
  rejected:   { label: 'Rejected',         icon: XCircle,      cls: 'text-[#C0392B]' },
}

export default function AdminUsers() {
  const queryClient = useQueryClient()

  const [search, setSearch]   = useState('')
  const [role,   setRole]     = useState('all')
  const [page,   setPage]     = useState(1)
  const [modal,  setModal]    = useState(null) // null | 'create' | { ...user }
  const [form,   setForm]     = useState(BLANK)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Residency review — residencyModal holds the user being reviewed; preview is
  // fetched separately as an object URL (PDF/image, same pattern as the
  // reservation letter previews) so an admin can actually look at the submitted
  // document before deciding.
  const [residencyModal,   setResidencyModal]   = useState(null) // null | { ...user }
  const [residencyPreview, setResidencyPreview] = useState(null) // { url, mimeType } | null
  const [residencyLoading, setResidencyLoading] = useState(false)
  const [residencyNote,    setResidencyNote]    = useState('')

  const params = {
    page,
    ...(role   !== 'all' && { role }),
    ...(search && { search }),
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', { params }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const createMutation = useMutation({
    mutationFn: data => api.post('/admin/users', data),
    onSuccess: () => {
      toast.success('User created.')
      setModal(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: err => {
      const errors = err.response?.data?.errors
      if (errors) {
        toast.error(Object.values(errors).flat().join(' '))
      } else {
        toast.error(err.response?.data?.message || 'Failed to create user.')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/users/${id}`, data),
    onSuccess: () => {
      toast.success('User updated.')
      setModal(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to update.'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted.')
      setDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to delete.'),
  })

  const openResidencyReview = (u) => {
    setResidencyModal(u)
    setResidencyNote(u.residency_admin_note ?? '')
    if (u.residency_proof_path) {
      setResidencyLoading(true)
      api.get(`/users/${u.id}/residency-proof`, { responseType: 'blob' })
        .then(res => setResidencyPreview({ url: URL.createObjectURL(res.data), mimeType: res.data.type }))
        .catch(() => toast.error('Failed to load the residency proof.'))
        .finally(() => setResidencyLoading(false))
    }
  }

  const closeResidencyReview = () => {
    if (residencyPreview) URL.revokeObjectURL(residencyPreview.url)
    setResidencyModal(null)
    setResidencyPreview(null)
    setResidencyNote('')
  }

  const downloadResidencyProof = () => {
    if (!residencyPreview || !residencyModal) return
    const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }[residencyPreview.mimeType] || 'bin'
    const a = document.createElement('a')
    a.href = residencyPreview.url
    a.download = `residency-proof-user-${residencyModal.id}.${ext}`
    a.click()
  }

  const verifyResidencyMutation = useMutation({
    mutationFn: ({ id, status, note }) => api.put(`/admin/users/${id}/residency`, { status, note }),
    onSuccess: () => {
      toast.success('Residency status updated.')
      closeResidencyReview()
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to update residency status.'),
  })

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openCreate = () => { setForm(BLANK); setModal('create') }
  const openEdit   = u  => {
    setForm({
      full_name:      u.full_name,
      email:          u.email,
      password:       '',
      role:           u.role,
      age:            u.age ?? '',
      gender:         u.gender ?? '',
      address:        u.address ?? '',
      contact_number: u.contact_number ?? '',
    })
    setModal(u)
  }

  const handleSave = () => {
    const payload = {
      full_name:      form.full_name,
      email:          form.email,
      role:           form.role,
      age:            form.age     ? Number(form.age)  : undefined,
      gender:         form.gender  || undefined,
      address:        form.address || undefined,
      contact_number: form.contact_number || undefined,
      ...(form.password && { password: form.password }),
    }
    if (modal === 'create') {
      createMutation.mutate({ ...payload, password: form.password })
    } else {
      updateMutation.mutate({ id: modal.id, data: payload })
    }
  }

  const changeSearch = val => { setSearch(val); setPage(1) }
  const changeRole   = val => { setRole(val);   setPage(1) }

  const rows     = data?.data         ?? []
  const searchSuggestions = useMemo(() => rows.map(u => ({
    id:               u.id,
    label:            u.full_name,
    sublabel:         u.email,
    avatarText:       initials(u.full_name),
    avatarColorClass: avatarColor(u.full_name),
  })), [rows])
  const lastPage = data?.last_page    ?? 1
  const curPage  = data?.current_page ?? 1
  const total    = data?.total        ?? 0

  // Counts come from the backend (data.counts) so they reflect the whole
  // table, not just whichever roles happen to appear on the current page.
  const totalCount  = data?.counts?.total          ?? 0
  const clientCount = data?.counts?.clients        ?? 0
  const staffCount  = data?.counts?.staff          ?? 0
  const adminCount  = data?.counts?.administrators ?? 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="border-l-4 border-[#C0392B] pl-4">
          <h1 className="text-2xl font-bold text-[#1C2833]">User Management</h1>
          <p className="text-[#1C2833] text-sm mt-0.5">Manage system accounts and roles</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',     value: totalCount,   icon: Users,       color: 'text-[#1C2833] bg-[#F2F3F4]' },
          { label: 'Clients',         value: clientCount,  icon: UserCheck,   color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Staff',           value: staffCount,   icon: Briefcase,   color: 'text-[#E67E22] bg-[#FDEBD0]' },
          { label: 'Administrators',  value: adminCount,   icon: ShieldCheck, color: 'text-[#C0392B] bg-[#FADBD8]' },
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

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {['all', 'client', 'staff', 'administrator'].map(r => (
            <button
              key={r}
              onClick={() => changeRole(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${
                role === r
                  ? 'bg-[#C0392B] text-white border-[#C0392B]'
                  : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
              }`}
            >
              {r === 'all' ? 'All Roles' : r}
            </button>
          ))}
        </div>
        <SearchAutocomplete
          value={search}
          onChange={changeSearch}
          suggestions={searchSuggestions}
          placeholder="Search name or email…"
          wrapperClassName="ml-auto relative"
          iconClassName="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1C2833] pointer-events-none"
          inputClassName="block w-60 rounded-lg border border-gray-300 pl-9 pr-3 py-2 h-9 text-sm bg-white placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* User list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-[#1C2833]">No users found.</div>
          ) : (
            <div className={`divide-y divide-[#E5E7E9] transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {/* Table header */}
              <div className="grid grid-cols-12 px-5 py-3 bg-[#FADBD8]/40 text-xs font-semibold text-[#96281B] uppercase tracking-wide">
                <div className="col-span-4">User</div>
                <div className="col-span-3 hidden md:block">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2 hidden md:block">Contact</div>
                <div className="col-span-1" />
              </div>

              {rows.map(u => {
                const rc = ROLE_COLORS[u.role] ?? ROLE_COLORS.client
                return (
                  <div key={u.id} className="grid grid-cols-12 items-center px-5 py-4 hover:bg-[#FADBD8]/10 transition-colors gap-2">
                    {/* Avatar + name */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${avatarColor(u.full_name)}`}>
                        <span className="text-white text-xs font-bold">{initials(u.full_name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#1C2833] truncate">{u.full_name}</p>
                        <p className="text-xs text-[#1C2833] truncate md:hidden">{u.email}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="col-span-3 hidden md:block min-w-0">
                      <p className="text-sm text-gray-600 truncate">{u.email}</p>
                    </div>

                    {/* Role badge */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${rc.bg} ${rc.text}`}>
                        {u.role}
                      </span>
                      {u.role === 'client' && u.residency_status !== 'unverified' && (() => {
                        const meta = RESIDENCY_META[u.residency_status]
                        const Icon = meta.icon
                        return <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.cls}`} title={meta.label} />
                      })()}
                    </div>

                    {/* Contact */}
                    <div className="col-span-2 hidden md:block">
                      <p className="text-sm text-[#1C2833]">{u.contact_number ?? '—'}</p>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex gap-1 justify-end">
                      {u.role === 'client' && u.residency_proof_path && (
                        <button
                          onClick={() => openResidencyReview(u)}
                          className="p-1.5 rounded-lg text-[#1C2833] hover:text-[#8E44AD] hover:bg-purple-50 transition-colors"
                          title="Review residency proof"
                        >
                          <MapPin className="h-4 w-4" />
                        </button>
                      )}
                      {u.role !== 'administrator' && (
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-[#1C2833] hover:text-[#2980B9] hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {u.role !== 'administrator' && (
                        <button
                          onClick={() => setDeleteConfirm({ id: u.id, name: u.full_name })}
                          className="p-1.5 rounded-lg text-[#1C2833] hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination — always rendered (even for a single page) so the card's
              footer stays put instead of appearing/disappearing as filters change
              the result count. */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7E9]">
            <p className="text-sm text-[#1C2833]">
              Page {curPage} of {lastPage} · <span className="font-medium text-[#1C2833]">{total}</span> users
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

      {/* Create / Edit Modal */}
      {modal !== null && (
        <Modal
          title={modal === 'create' ? 'Add User' : 'Edit User'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button
                loading={createMutation.isPending || updateMutation.isPending}
                onClick={handleSave}
              >
                {modal === 'create' ? 'Create User' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={e => setF('full_name', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setF('email', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{modal === 'create' ? 'Password *' : 'New Password (leave blank to keep)'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={e => setF('password', e.target.value)}
                className="mt-1"
                placeholder={modal === 'create' ? '' : 'Leave blank to keep current'}
              />
            </div>
            <div>
              <Label>Role *</Label>
              <select
                value={form.role}
                onChange={e => setF('role', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white"
              >
                <option value="client">Client</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <Label>Contact Number</Label>
              <Input
                value={form.contact_number}
                onChange={e => setF('contact_number', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Age <span className="text-[#1C2833] font-normal">(Optional)</span></Label>
              <Input
                type="number"
                min={1}
                value={form.age}
                onChange={e => setF('age', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Gender <span className="text-[#1C2833] font-normal">(Optional)</span></Label>
              <select
                value={form.gender}
                onChange={e => setF('gender', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white"
              >
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={e => setF('address', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Residency Proof Review Modal */}
      {residencyModal && (
        <Modal
          title={`Residency Proof — ${residencyModal.full_name}`}
          onClose={closeResidencyReview}
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-medium ${RESIDENCY_META[residencyModal.residency_status].cls}`}>
                Current status: {RESIDENCY_META[residencyModal.residency_status].label}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeResidencyReview}>Close</Button>
                <Button
                  variant="danger"
                  loading={verifyResidencyMutation.isPending}
                  onClick={() => verifyResidencyMutation.mutate({ id: residencyModal.id, status: 'rejected', note: residencyNote })}
                >
                  Reject
                </Button>
                <Button
                  loading={verifyResidencyMutation.isPending}
                  onClick={() => verifyResidencyMutation.mutate({ id: residencyModal.id, status: 'verified', note: residencyNote })}
                  className="bg-[#1E8449] hover:bg-[#196F3D]"
                >
                  Verify as Cabuyeño
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {residencyLoading ? (
              <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            ) : residencyPreview ? (
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm text-[#1C2833]">Submitted document:</p>
                <Button size="sm" variant="outline" onClick={downloadResidencyProof}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            ) : null}

            {!residencyLoading && residencyPreview && (
              residencyPreview.mimeType === 'application/pdf' ? (
                <iframe
                  src={residencyPreview.url}
                  title="Residency proof"
                  className="w-full h-[60vh] rounded-lg border border-[#E5E7E9]"
                />
              ) : (
                <img
                  src={residencyPreview.url}
                  alt="Residency proof"
                  className="max-w-full max-h-[60vh] w-auto h-auto object-contain mx-auto block rounded-lg border border-[#E5E7E9]"
                />
              )
            )}

            <div>
              <Label>Note (shown to the client if rejected)</Label>
              <textarea
                rows={2}
                value={residencyNote}
                onChange={e => setResidencyNote(e.target.value)}
                placeholder="e.g. Document is unreadable, or doesn't show a Cabuyao address."
                className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <Modal
          title="Delete User"
          onClose={() => setDeleteConfirm(null)}
          size="sm"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              >
                Delete
              </Button>
            </div>
          }
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This cannot be
            undone and will remove all their data.
          </p>
        </Modal>
      )}
    </div>
  )
}
