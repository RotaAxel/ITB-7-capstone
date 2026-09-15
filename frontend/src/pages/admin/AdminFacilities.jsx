import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Wrench, Trash2, MapPin, Users, Building2, CheckCircle2, AlertTriangle, Ban, ChevronLeft, ChevronRight, FileCheck } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import Modal from '@/components/ui/Modal'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'

const BLANK_FACILITY = {
  name: '', description: '', location: '', capacity: '', price_per_hour: '', status: 'available',
  requires_authorization_letter: false,
}

const BLANK_MAINTENANCE = {
  status: 'under_maintenance', maintenance_note: '', maintenance_start: '', maintenance_end: '',
}

const FILTERS = [
  { value: 'all',               label: 'All'         },
  { value: 'available',         label: 'Available'   },
  { value: 'under_maintenance', label: 'Maintenance' },
  { value: 'unavailable',       label: 'Unavailable' },
]

function getSportTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('basketball'))                return { color: '#E97316', dark: '#C2410C', label: 'Basketball Court' }
  if (n.includes('volleyball'))                return { color: '#3B82F6', dark: '#1D4ED8', label: 'Volleyball Court' }
  if (n.includes('swim') || n.includes('pool')) return { color: '#06B6D4', dark: '#0E7490', label: 'Swimming Pool'   }
  if (n.includes('track') || n.includes('athlet') || n.includes('run')) return { color: '#22C55E', dark: '#15803D', label: 'Athletics Track' }
  if (n.includes('football') || n.includes('soccer')) return { color: '#16A34A', dark: '#14532D', label: 'Football Field' }
  if (n.includes('badminton'))                 return { color: '#9333EA', dark: '#7E22CE', label: 'Badminton Court'   }
  if (n.includes('tennis'))                    return { color: '#84CC16', dark: '#4D7C0F', label: 'Tennis Court'      }
  if (n.includes('baseball'))                  return { color: '#78350F', dark: '#451A03', label: 'Baseball Field'   }
  if (n.includes('gym') || n.includes('gymnasium') || n.includes('multi')) return { color: '#6366F1', dark: '#4338CA', label: 'Gymnasium' }
  return { color: '#C0392B', dark: '#96281B', label: 'Sports Facility' }
}

function FacilityRow({ facility, onEdit, onMaint, onDelete }) {
  const theme = getSportTheme(facility.name)
  const navigate = useNavigate()
  return (
    <tr
      onClick={() => navigate(`/facilities/${facility.id}`)}
      className="border-b border-[#E5E7E9] hover:bg-[#FADBD8]/20 cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            {facility.image_url ? (
              <img src={facility.image_url} alt={facility.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}>
                <Building2 className="h-5 w-5 text-white/80" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1C2833] text-sm truncate flex items-center gap-1.5">
              {facility.name}
              {facility.requires_authorization_letter && (
                <FileCheck className="h-3.5 w-3.5 text-[#8E44AD] shrink-0" title="Requires authorization letter" />
              )}
            </p>
            {facility.description && (
              <p className="text-xs text-[#1C2833] truncate max-w-[200px]">{facility.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#1C2833]">
        {facility.location ? (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#C0392B]" /> {facility.location}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-[#1C2833] text-center">
        {facility.capacity ? (
          <span className="flex items-center justify-center gap-1">
            <Users className="h-3.5 w-3.5 text-[#1C2833]" /> {facility.capacity}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-[#1C2833] text-center">
        ₱{Number(facility.price_per_hour).toLocaleString()}/hr
      </td>
      <td className="px-4 py-3 text-center">
        <Badge status={facility.status} />
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(facility)} title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onMaint(facility)} title="Maintenance">
            <Wrench className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => onDelete({ id: facility.id, name: facility.name })}
            title="Delete facility"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

const PAGE_SIZE = 9

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AdminFacilities() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [facilityModal, setFacilityModal] = useState(null)
  const [maintenanceModal, setMaintenanceModal] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const [form,  setForm]  = useState(BLANK_FACILITY)
  const [maint, setMaint] = useState(BLANK_MAINTENANCE)

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  })

  const searchSuggestions = useMemo(() => [
    ...facilities.map(f => f.name),
    ...facilities.map(f => f.location),
  ], [facilities])

  const filtered = facilities.filter(f => {
    const matchStatus = statusFilter === 'all' || f.status === statusFilter
    const q = search.trim().toLowerCase()
    const matchSearch = !q || f.name?.toLowerCase().includes(q) || f.location?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilter = (val) => { setStatusFilter(val); setPage(1) }
  const handleSearch = (val) => { setSearch(val); setPage(1) }

  const buildFormData = () => {
    const fd = new FormData()
    fd.append('name',           form.name)
    fd.append('description',    form.description)
    fd.append('location',       form.location)
    fd.append('capacity',       form.capacity)
    fd.append('price_per_hour', form.price_per_hour)
    fd.append('status',         form.status)
    fd.append('requires_authorization_letter', form.requires_authorization_letter ? 'true' : 'false')
    return fd
  }

  const createMutation = useMutation({
    mutationFn: fd => api.post('/admin/facilities', fd),
    onSuccess: () => {
      toast.success('Facility created.')
      setFacilityModal(null)
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to create.'),
  })

  const updateMutation = useMutation({
    // PHP doesn't parse multipart/form-data on PUT — use POST with _method spoofing
    mutationFn: ({ id, fd }) => {
      fd.append('_method', 'PUT')
      return api.post(`/admin/facilities/${id}`, fd)
    },
    onSuccess: () => {
      toast.success('Facility updated.')
      setFacilityModal(null)
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to update.'),
  })

  const maintenanceMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/admin/facilities/${id}/maintenance`, data),
    onSuccess: () => {
      toast.success('Maintenance status updated.')
      setMaintenanceModal(null)
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to update.'),
  })

  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/admin/facilities/${id}`),
    onSuccess: () => {
      toast.success('Facility deleted.')
      setDeleteConfirm(null)
      queryClient.invalidateQueries({ queryKey: ['facilities'] })
    },
    onError: err => toast.error(err.response?.data?.message || 'Failed to delete facility.'),
  })

  const setF = (k, v) => setForm(f  => ({ ...f,  [k]: v }))
  const setM = (k, v) => setMaint(m => ({ ...m, [k]: v }))

  const openCreate = () => {
    setForm(BLANK_FACILITY)
    setFacilityModal('create')
  }

  const openEdit = f => {
    setForm({ ...f })
    setFacilityModal(f)
  }

  const openMaint = f => {
    setMaint({ ...BLANK_MAINTENANCE })
    setMaintenanceModal(f)
  }

  const handleSaveFacility = () => {
    const fd = buildFormData()
    if (facilityModal === 'create') {
      createMutation.mutate(fd)
    } else {
      updateMutation.mutate({ id: facilityModal.id, fd })
    }
  }

  const handleSaveMaintenance = () => {
    maintenanceMutation.mutate({
      id: maintenanceModal.id,
      data: {
        status:            maint.status,
        maintenance_note:  maint.maintenance_note  || undefined,
        maintenance_start: maint.maintenance_start || undefined,
        maintenance_end:   maint.maintenance_end   || undefined,
      },
    })
  }

  const countAvailable    = facilities.filter(f => f.status === 'available').length
  const countMaintenance  = facilities.filter(f => f.status === 'under_maintenance').length
  const countUnavailable  = facilities.filter(f => f.status === 'unavailable').length

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7E9] overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#E5E7E9]">
              <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[#C0392B] pl-4">
          <h1 className="text-2xl font-bold text-[#1C2833]">Facilities</h1>
          <p className="text-[#1C2833] text-sm mt-0.5">Manage sports facilities and their status</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Facility
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Facilities',   value: facilities.length, icon: Building2,     color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Available',          value: countAvailable,    icon: CheckCircle2,  color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Under Maintenance',  value: countMaintenance,  icon: AlertTriangle, color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Unavailable',        value: countUnavailable,  icon: Ban,          color: 'text-[#C0392B] bg-[#FADBD8]' },
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
        onChange={handleSearch}
        suggestions={searchSuggestions}
        placeholder="Search by facility name or location…"
        inputClassName="w-full pl-11 pr-4 h-11 rounded-xl border-2 border-[#FADBD8] bg-white text-sm text-[#1C2833] placeholder-[#717D7E] shadow-sm focus:outline-none focus:border-[#C0392B] focus:ring-2 focus:ring-[#FADBD8] transition-colors"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === f.value
                ? 'bg-[#C0392B] text-white border-[#C0392B]'
                : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List / Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#1C2833]">No facilities found.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E5E7E9] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-[#FADBD8]/60 border-b border-[#E5E7E9]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Facility</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Location</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Capacity</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Price/hr</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(facility => (
                    <FacilityRow
                      key={facility.id}
                      facility={facility}
                      onEdit={openEdit}
                      onMaint={openMaint}
                      onDelete={setDeleteConfirm}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[#1C2833]">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} facilities
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7E9] bg-white text-sm font-medium text-[#1C2833] hover:bg-[#FADBD8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        n === page
                          ? 'bg-[#C0392B] text-white'
                          : 'bg-white border border-[#E5E7E9] text-[#1C2833] hover:bg-[#FADBD8]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7E9] bg-white text-sm font-medium text-[#1C2833] hover:bg-[#FADBD8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Facility Modal */}
      {facilityModal !== null && (
        <Modal
          title={facilityModal === 'create' ? 'Add New Facility' : 'Edit Facility'}
          onClose={() => setFacilityModal(null)}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFacilityModal(null)}>Cancel</Button>
              <Button
                loading={createMutation.isPending || updateMutation.isPending}
                onClick={handleSaveFacility}
              >
                {facilityModal === 'create' ? 'Create Facility' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setF('name', e.target.value)}
                  placeholder="e.g. Basketball Court A"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={e => setF('location', e.target.value)}
                  placeholder="e.g. Building A, Ground Floor"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={e => setF('capacity', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Price per Hour (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={form.price_per_hour}
                  onChange={e => setF('price_per_hour', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={e => setF('status', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white"
                >
                  <option value="available">Available</option>
                  <option value="under_maintenance">Under Maintenance</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-[#E5E7E9] cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.requires_authorization_letter}
                    onChange={e => setF('requires_authorization_letter', e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E5E7E9] text-[#C0392B] shrink-0"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[#1C2833]">Requires Authorization Letter</span>
                    <span className="block text-xs text-[#1C2833] mt-0.5">
                      Clients must upload a signed authorization letter (PDF or image) when reserving this facility,
                      or their request will be rejected before it reaches you.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Maintenance Modal */}
      {maintenanceModal && (
        <Modal
          title={`Maintenance — ${maintenanceModal.name}`}
          onClose={() => setMaintenanceModal(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMaintenanceModal(null)}>Cancel</Button>
              <Button
                loading={maintenanceMutation.isPending}
                onClick={handleSaveMaintenance}
              >
                Update Status
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <Label>Status *</Label>
              <select
                value={maint.status}
                onChange={e => setM('status', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white"
              >
                <option value="available">Available</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
            <div>
              <Label>Maintenance Note</Label>
              <textarea
                rows={2}
                value={maint.maintenance_note}
                onChange={e => setM('maintenance_note', e.target.value)}
                placeholder="Describe the maintenance work…"
                className="mt-1 w-full rounded-lg border border-[#E5E7E9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={maint.maintenance_start}
                  onChange={e => setM('maintenance_start', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={maint.maintenance_end}
                  onChange={e => setM('maintenance_end', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <Modal
          title="Delete Facility"
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
                <Trash2 className="h-4 w-4" /> Delete Permanently
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Are you sure you want to permanently delete <strong>{deleteConfirm.name}</strong>?
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              This action <strong>cannot be undone</strong>. All reservation history and data
              associated with this facility will be permanently removed.
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
