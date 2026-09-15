import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Users, Building2, CheckCircle2, AlertTriangle, Ban, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/api/axios'
import Badge from '@/components/ui/Badge'
import Skeleton from '@/components/ui/Skeleton'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'

const FILTERS = [
  { value: 'all',               label: 'All'         },
  { value: 'available',         label: 'Available'   },
  { value: 'under_maintenance', label: 'Maintenance' },
  { value: 'unavailable',       label: 'Unavailable' },
]

function getSportTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('basketball'))              return { color: '#E97316', dark: '#C2410C' }
  if (n.includes('volleyball'))              return { color: '#3B82F6', dark: '#1D4ED8' }
  if (n.includes('swim') || n.includes('pool')) return { color: '#06B6D4', dark: '#0E7490' }
  if (n.includes('track') || n.includes('athlet') || n.includes('run')) return { color: '#22C55E', dark: '#15803D' }
  if (n.includes('football') || n.includes('soccer')) return { color: '#16A34A', dark: '#14532D' }
  if (n.includes('badminton'))               return { color: '#9333EA', dark: '#7E22CE' }
  if (n.includes('tennis'))                  return { color: '#84CC16', dark: '#4D7C0F' }
  if (n.includes('baseball'))                return { color: '#78350F', dark: '#451A03' }
  if (n.includes('gym') || n.includes('gymnasium') || n.includes('multi')) return { color: '#6366F1', dark: '#4338CA' }
  return { color: '#C0392B', dark: '#96281B' }
}

const PAGE_SIZE = 15

export default function StaffFacilities() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [page, setPage]                 = useState(1)
  const navigate                        = useNavigate()

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

  const handleFilter = v => { setStatusFilter(v); setPage(1) }
  const handleSearch = v => { setSearch(v); setPage(1) }

  const countAvailable   = facilities.filter(f => f.status === 'available').length
  const countMaint       = facilities.filter(f => f.status === 'under_maintenance').length
  const countUnavailable = facilities.filter(f => f.status === 'unavailable').length

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7E9] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-[#E5E7E9]">
              <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Facilities</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Overview of all CABS sports facilities</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',         value: facilities.length,           icon: Building2,     color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Available',     value: countAvailable,              icon: CheckCircle2,  color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Maintenance',   value: countMaint,                  icon: AlertTriangle, color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Unavailable',   value: countUnavailable,            icon: Ban,           color: 'text-[#C0392B] bg-[#FADBD8]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E5E7E9] p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color}`}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <p className="text-xl font-bold text-[#1C2833]">{value}</p>
            <p className="text-xs text-[#1C2833]">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <SearchAutocomplete
        value={search}
        onChange={handleSearch}
        suggestions={searchSuggestions}
        placeholder="Search by name or location…"
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#1C2833]">No facilities found.</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E5E7E9] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-[#FADBD8]/60 border-b border-[#E5E7E9]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Facility</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Location</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Capacity</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Price/hr</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#1C2833] uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(f => {
                    const theme = getSportTheme(f.name)
                    return (
                      <tr
                        key={f.id}
                        onClick={() => navigate(`/facilities/${f.id}`)}
                        className="border-b border-[#E5E7E9] last:border-0 hover:bg-[#FADBD8]/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                              {f.image_url ? (
                                <img src={f.image_url} alt={f.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"
                                  style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}>
                                  <Building2 className="h-4 w-4 text-white/80" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#1C2833] text-sm">{f.name}</p>
                              {f.description && (
                                <p className="text-xs text-[#1C2833] truncate max-w-[180px]">{f.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#1C2833]">
                          {f.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-[#C0392B]" /> {f.location}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#1C2833] text-center">
                          {f.capacity ? (
                            <span className="flex items-center justify-center gap-1">
                              <Users className="h-3.5 w-3.5 text-[#1C2833]" /> {f.capacity}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#1C2833] text-center">
                          ₱{Number(f.price_per_hour).toLocaleString()}/hr
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge status={f.status} />
                        </td>
                      </tr>
                    )
                  })}
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
    </div>
  )
}
