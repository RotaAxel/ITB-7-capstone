import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { MapPin, Users, Clock, ArrowLeft, Building2 } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import NewReservationModal from '@/components/NewReservationModal'
import { useAuth } from '@/hooks/useAuth'

/* ── Sport theme helper ─────────────────────────────────────────────────── */
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

/* ── Hero image ──────────────────────────────────────────────────────────── */
function FacilityHero({ facility, onBack }) {
  const theme = getSportTheme(facility.name)
  return (
    <div className="relative w-full h-72 rounded-2xl overflow-hidden mb-6">
      {facility.image_url ? (
        <img
          src={facility.image_url}
          alt={facility.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${theme.color}, ${theme.dark})` }}
        >
          <Building2 className="h-16 w-16 text-white/50 mb-3" />
          <p className="text-white font-semibold text-lg">{theme.label}</p>
        </div>
      )}
      {/* Dark gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-white bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      {/* Facility name + badge at bottom */}
      <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white drop-shadow">{facility.name}</h1>
          {facility.location && (
            <p className="text-white/80 text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {facility.location}
            </p>
          )}
        </div>
        <Badge status={facility.status} />
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function FacilityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isClient } = useAuth()
  const [showModal, setShowModal] = useState(false)

  const { data: facility, isLoading, error } = useQuery({
    queryKey: ['facility', id],
    queryFn: () => api.get(`/facilities/${id}`).then(r => r.data),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (error || !facility) return <div className="p-6 text-center text-red-500">Facility not found.</div>

  const STATUS_COLOR = {
    pending:   '#F39C12',
    approved:  '#2980B9',
    confirmed: '#27AE60',
    completed: '#8E44AD',
  }

  const events = (facility.booked_slots || []).map(slot => ({
    title:           `${slot.start_time}–${slot.end_time}`,
    start:           `${slot.reservation_date}T${slot.start_time}`,
    end:             `${slot.reservation_date}T${slot.end_time}`,
    backgroundColor: STATUS_COLOR[slot.status] ?? '#6b7280',
    borderColor:     'transparent',
    textColor:       '#ffffff',
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Hero — full width at top */}
      <FacilityHero facility={facility} onBack={() => navigate(-1)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — info */}
        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardContent className="space-y-4 pt-4">
              {facility.location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-[#1C2833] shrink-0" />
                  {facility.location}
                </div>
              )}

              {facility.capacity && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-[#1C2833] shrink-0" />
                  Capacity: {facility.capacity} persons
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="h-4 w-4 text-[#1C2833] shrink-0" />
                ₱{Number(facility.price_per_hour).toLocaleString()} / hour
              </div>

              {facility.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{facility.description}</p>
              )}

              {!isClient ? (
                // Staff/admin land here from their own facility management pages
                // (to view details) — reserving is a client action, not something
                // staff "handle" on their own behalf.
                <p className="text-xs text-[#1C2833] bg-gray-50 border border-[#E5E7E9] rounded-lg px-3 py-2.5 text-center">
                  Staff and admin accounts can't make reservations.
                </p>
              ) : facility.status === 'available' ? (
                <Button className="w-full" onClick={() => setShowModal(true)}>
                  Reserve This Facility
                </Button>
              ) : (
                <Button disabled className="w-full">Not Available for Booking</Button>
              )}
            </CardContent>
          </Card>

          {facility.amenities?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Amenities</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {facility.amenities.map(a => (
                    <li key={a.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-700">{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#1C2833]">×{a.quantity}</span>
                        {!a.is_available && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Unavailable</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Availability Calendar</CardTitle>
              <p className="text-sm text-[#1C2833] mt-1">
                Colored blocks show booked slots. Days without blocks are open for reservation.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4 mb-4 text-xs">
                {[
                  { color: '#F39C12', label: 'Pending'   },
                  { color: '#2980B9', label: 'Approved'  },
                  { color: '#27AE60', label: 'Confirmed' },
                  { color: '#8E44AD', label: 'Completed' },
                ].map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-gray-600">
                    <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
              <FullCalendar
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                events={events}
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                height={460}
                eventDisplay="block"
                dayMaxEvents={3}
                noEventsContent="No bookings in this period"
              />
              <style>{`
                .fc-button-primary { background-color: #C0392B !important; border-color: #96281B !important; }
                .fc-button-primary:hover { background-color: #96281B !important; }
                .fc-button-primary:not(:disabled).fc-button-active,
                .fc-button-primary:not(:disabled):active { background-color: #96281B !important; }
                .fc-today-button:disabled { background-color: #F1948A !important; border-color: #F1948A !important; }
                .fc-daygrid-day.fc-day-today { background-color: #FADBD8 !important; }
                .fc .fc-toolbar-title { color: #1C2833; font-size: 1rem; font-weight: 700; }
                .fc-col-header-cell-cushion { color: #717D7E; font-size: 0.7rem; font-weight: 600; }
                .fc-daygrid-day-number { color: #1C2833; font-size: 0.75rem; }
                .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
                  background-color: #C0392B; color: white; border-radius: 50%;
                  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
                }
              `}</style>
            </CardContent>
          </Card>
        </div>
      </div>

      {showModal && (
        <NewReservationModal
          preselectedFacility={id}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
