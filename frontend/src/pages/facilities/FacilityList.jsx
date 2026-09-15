import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Users, Clock, Building2, CheckCircle2, AlertTriangle, Ban, ChevronLeft, ChevronRight, FileCheck } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import NewReservationModal from '@/components/NewReservationModal'
import SearchAutocomplete from '@/components/ui/SearchAutocomplete'

const FILTERS = [
  { value: 'all',               label: 'All'         },
  { value: 'available',         label: 'Available'   },
  { value: 'under_maintenance', label: 'Maintenance' },
  { value: 'unavailable',       label: 'Unavailable' },
]

function getSportTheme(name = '') {
  const n = name.toLowerCase()
  if (n.includes('basketball'))              return { color: '#E97316', dark: '#C2410C', label: 'Basketball Court' }
  if (n.includes('volleyball'))              return { color: '#3B82F6', dark: '#1D4ED8', label: 'Volleyball Court' }
  if (n.includes('swim') || n.includes('pool')) return { color: '#06B6D4', dark: '#0E7490', label: 'Swimming Pool'   }
  if (n.includes('track') || n.includes('athlet') || n.includes('run')) return { color: '#22C55E', dark: '#15803D', label: 'Athletics Track' }
  if (n.includes('football') || n.includes('soccer')) return { color: '#16A34A', dark: '#14532D', label: 'Football Field' }
  if (n.includes('badminton'))               return { color: '#9333EA', dark: '#7E22CE', label: 'Badminton Court'   }
  if (n.includes('tennis'))                  return { color: '#84CC16', dark: '#4D7C0F', label: 'Tennis Court'      }
  if (n.includes('baseball'))                return { color: '#78350F', dark: '#451A03', label: 'Baseball Field'   }
  if (n.includes('gym') || n.includes('gymnasium') || n.includes('multi')) return { color: '#6366F1', dark: '#4338CA', label: 'Gymnasium' }
  return { color: '#C0392B', dark: '#96281B', label: 'Sports Facility' }
}

function FacilityPlaceholder({ name, className = '' }) {
  const theme = getSportTheme(name)
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}
    >
      <Building2 className="h-12 w-12 text-white/60 mb-2" />
      <p className="text-white font-semibold text-sm tracking-wide">{theme.label}</p>
    </div>
  )
}

const PAGE_SIZE = 9

export default function FacilityList() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const { data: facilities = [], isLoading, error } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  })

  const searchSuggestions = useMemo(() => [
    ...facilities.map(f => f.name),
    ...facilities.map(f => f.location),
  ], [facilities])

  const filtered = facilities.filter(f => {
    const matchStatus = status === 'all' || f.status === status
    const q = search.trim().toLowerCase()
    const matchSearch = !q || f.name?.toLowerCase().includes(q) || f.location?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilter = (val) => { setStatus(val); setPage(1) }
  const handleSearch = (val) => { setSearch(val); setPage(1) }

  const countAvailable   = facilities.filter(f => f.status === 'available').length
  const countMaintenance = facilities.filter(f => f.status === 'under_maintenance').length
  const countOther       = facilities.filter(f => f.status === 'unavailable').length

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-44 rounded-none rounded-t-xl" />
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 flex-1" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (error) return <div className="p-6 text-center text-red-500">Failed to load facilities.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Facilities</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Browse and reserve sports facilities</p>
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
              status === f.value
                ? 'bg-[#C0392B] text-white border-[#C0392B]'
                : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:bg-[#FADBD8]/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#1C2833]">No facilities found.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.map(facility => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </div>

          {/* Pagination */}
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Facilities',     value: facilities.length, icon: Building2,    color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Available',            value: countAvailable,    icon: CheckCircle2, color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Under Maintenance',    value: countMaintenance,  icon: AlertTriangle,color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Unavailable',        value: countOther,        icon: Ban,          color: 'text-[#C0392B] bg-[#FADBD8]' },
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
    </div>
  )
}

function FacilityCard({ facility }) {
  const available = facility.status === 'available'
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  return (
    <>
    <Card
      className="flex flex-col overflow-hidden group cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/facilities/${facility.id}`)}
    >
      <div className="h-44 relative overflow-hidden">
        {facility.image_url ? (
          <img
            src={facility.image_url}
            alt={facility.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <FacilityPlaceholder name={facility.name} />
        )}
        {facility.image_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        )}
        <div className="absolute top-3 right-3">
          <Badge status={facility.status} />
        </div>
      </div>

      <CardContent className="flex flex-col flex-1 gap-3 pt-4">
        <div>
          <h3 className="font-semibold text-gray-900">{facility.name}</h3>
          {facility.location && (
            <p className="text-xs text-[#1C2833] flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {facility.location}
            </p>
          )}
          {facility.description && (
            <p className="text-sm text-[#1C2833] mt-1 line-clamp-2">{facility.description}</p>
          )}
          {facility.requires_authorization_letter && (
            <p className="text-xs text-[#8E44AD] flex items-center gap-1 mt-1">
              <FileCheck className="h-3 w-3 shrink-0" /> Requires an authorization letter to reserve
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          {facility.capacity && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-[#1C2833]" /> {facility.capacity} max
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-[#1C2833]" />
            ₱{Number(facility.price_per_hour).toLocaleString()}/hr
          </span>
        </div>

        {facility.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {facility.amenities.slice(0, 3).map(a => (
              <span key={a.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.name}</span>
            ))}
            {facility.amenities.length > 3 && (
              <span className="text-xs text-[#1C2833] py-0.5">+{facility.amenities.length - 3} more</span>
            )}
          </div>
        )}

        {available && (
          <div className="mt-auto pt-2">
            <Button
              className="w-full"
              size="sm"
              onClick={e => { e.stopPropagation(); setShowModal(true) }}
            >
              Reserve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    {showModal && (
      <NewReservationModal
        preselectedFacility={facility.id}
        onClose={() => setShowModal(false)}
      />
    )}
    </>
  )
}
