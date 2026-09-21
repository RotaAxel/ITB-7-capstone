import { useState, useRef, useCallback, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CalendarDays, Clock, CheckCircle2, XCircle } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

// Admin: distinct per-status colors (useful for triage: at a glance, which
// requests are pending vs approved vs confirmed vs cancelled/rejected). A date
// with no reservation at all shows no color — "Available" is listed in the
// legend for clarity but isn't a clickable filter (there's no event to filter).
const ADMIN_STATUS_COLORS = {
  pending:   '#F1C40F',
  approved:  '#2980B9',
  confirmed: '#27AE60',
  cancelled: '#717D7E',
  rejected:  '#C0392B',
}
const ADMIN_LEGEND = [
  { label: 'Available',  color: null,      desc: 'No reservation',              statuses: [] },
  { label: 'Pending',    color: '#F1C40F', desc: 'Awaiting approval',           statuses: ['pending'] },
  { label: 'Approved',   color: '#2980B9', desc: 'Approved, awaiting payment',  statuses: ['approved'] },
  { label: 'Confirmed',  color: '#27AE60', desc: 'Paid and confirmed',          statuses: ['confirmed'] },
  { label: 'Cancelled',  color: '#717D7E', desc: 'Cancelled',                   statuses: ['cancelled'] },
  { label: 'Rejected',   color: '#C0392B', desc: 'Rejected',                    statuses: ['rejected'] },
]

// Client view: simplified to what actually matters when picking a date to book —
// Available (no color), a held/unavailable date (red — approved, confirmed, or
// completed all mean the slot is taken), or Pending (yellow — a request is in,
// but the slot isn't confirmed taken yet). Cancelled/rejected reservations don't
// hold the date, so they render the same as "Available" (no color).
const OCCUPIED_COLOR = '#C0392B'
const PENDING_COLOR  = '#F1C40F'
const CLIENT_STATUS_COLORS = {
  pending:   PENDING_COLOR,
  approved:  OCCUPIED_COLOR,
  confirmed: OCCUPIED_COLOR,
  completed: OCCUPIED_COLOR,
}
const CLIENT_LEGEND = [
  { label: 'Available',     color: null,           desc: 'Open to book',                     statuses: [] },
  { label: 'Not Available', color: OCCUPIED_COLOR,  desc: 'Approved or confirmed — slot held', statuses: ['approved', 'confirmed', 'completed'] },
  { label: 'Pending',       color: PENDING_COLOR,   desc: 'Awaiting approval',                 statuses: ['pending'] },
]

// A date counts as "booked" (day cell tinted red) if it has at least one reservation
// that's still active — cancelled/rejected reservations don't hold the date anymore.
const ACTIVE_STATUSES = ['pending', 'approved', 'confirmed', 'completed']

export default function CalendarPage({ adminView = false }) {
  const navigate = useNavigate()
  const calRef = useRef()
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [lastUpdated, setLastUpdated] = useState(new Date())
  // null = no filter (show everything); otherwise an array of status strings to
  // match — a legend chip like "Not Available" can stand for several statuses
  // at once (approved + confirmed + completed), not just one.
  const [selectedStatuses, setSelectedStatuses] = useState(null)
  // 'all' or a facility name — the Day/Week (timeGrid) views lay every facility's
  // bookings out in the same shared time column, so with several facilities all
  // getting reserved around the same hours, the view turns into a wall of
  // same-colored slivers. Narrowing to one facility is the most effective
  // declutter; see also the two-line eventContent below.
  const [selectedFacility, setSelectedFacility] = useState('all')

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  })

  const { data: rawEvents = [], refetch, isFetching } = useQuery({
    queryKey: ['calendar', adminView ? 'admin' : 'client', dateRange],
    queryFn: async () => {
      if (!dateRange.start) return []
      const params = { start: dateRange.start, end: dateRange.end }
      if (adminView) params.view = 'admin'
      const res = await api.get('/calendar/events', { params })
      setLastUpdated(new Date())
      return res.data ?? []
    },
    enabled: !!dateRange.start,
    refetchInterval: 60_000,
  })

  const LEGEND = adminView ? ADMIN_LEGEND : CLIENT_LEGEND

  const events = rawEvents
    .filter(e => !selectedStatuses || selectedStatuses.includes(e.extendedProps?.status))
    .filter(e => selectedFacility === 'all' || e.extendedProps?.facilityName === selectedFacility)
    .map(e => {
      const status = e.extendedProps?.status
      // Client view: cancelled/rejected reservations don't hold the date anymore,
      // so they fall back to a neutral gray — never the red "not available" color.
      const color  = adminView
        ? (ADMIN_STATUS_COLORS[status] ?? '#717D7E')
        : (CLIENT_STATUS_COLORS[status] ?? '#B5B8BC')
      return { ...e, backgroundColor: color, borderColor: color, textColor: '#FFFFFF' }
    })

  // Independent of the status filter above — a date is "booked" based on all active
  // reservations, not just whichever status pins are currently shown.
  const bookedDates = useMemo(() => {
    const set = new Set()
    rawEvents.forEach(e => {
      if (ACTIVE_STATUSES.includes(e.extendedProps?.status) && e.extendedProps?.reservationDate) {
        set.add(e.extendedProps.reservationDate)
      }
    })
    return set
  }, [rawEvents])

  const dayCellClassNames = useCallback((arg) => {
    const y = arg.date.getFullYear()
    const m = String(arg.date.getMonth() + 1).padStart(2, '0')
    const d = String(arg.date.getDate()).padStart(2, '0')
    if (!bookedDates.has(`${y}-${m}-${d}`)) return []
    // Admin/staff scan many bookings across all users at once, so their tint is a
    // stronger, more obviously "red" wash than the client's subtler highlight.
    return adminView ? ['fc-day-booked', 'fc-day-booked-strong'] : ['fc-day-booked']
  }, [bookedDates, adminView])

  const handleDatesSet = useCallback((info) => {
    setDateRange({ start: info.startStr.slice(0,10), end: info.endStr.slice(0,10) })
  }, [])

  const handleEventClick = (info) => {
    const { reservationId, status, type } = info.event.extendedProps ?? {}
    if (type === 'maintenance') return
    if (!reservationId) return
    if (adminView) {
      navigate(`/admin/reservations`)
    } else {
      if (status === 'approved') navigate(`/reservations/${reservationId}/terms`)
      else if (status === 'confirmed') navigate(`/reservations/${reservationId}/receipt`)
      else navigate(`/reservations/${reservationId}`)
    }
  }

  const handleDateClick = (info) => {
    if (adminView) return
    navigate(`/reservations/new?date=${info.dateStr}`)
  }

  const totalEvents     = rawEvents.length
  const pendingCount    = rawEvents.filter(e => e.extendedProps?.status === 'pending').length
  const confirmedCount  = rawEvents.filter(e => e.extendedProps?.status === 'confirmed').length
  const rejectedCount   = rawEvents.filter(e => ['rejected','cancelled'].includes(e.extendedProps?.status)).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="border-l-4 border-[#C0392B] pl-4">
          <h1 className="text-2xl font-bold text-[#1C2833]">
            {adminView ? 'Reservations Calendar' : 'My Calendar'}
          </h1>
          <p className="text-[#1C2833] text-sm mt-0.5">
            {adminView ? 'View and manage all bookings on the calendar' : 'Track your upcoming reservations'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedFacility}
            onChange={e => setSelectedFacility(e.target.value)}
            className="text-sm border border-[#E5E7E9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C0392B] bg-white text-[#1C2833]"
          >
            <option value="all">All Facilities</option>
            {facilities.map(f => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
          <select
            value={selectedStatuses?.length === 1 ? selectedStatuses[0] : 'all'}
            onChange={e => setSelectedStatuses(e.target.value === 'all' ? null : [e.target.value])}
            className="text-sm border border-[#E5E7E9] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C0392B] bg-white text-[#1C2833]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Legend — "Available" (no color) is informational only, not a filter:
          there's no event to filter to when nothing's booked. Every other chip
          toggles the calendar to just that status (or set of statuses). */}
      <div className="flex flex-wrap gap-2">
        {LEGEND.map(l => {
          const clickable = l.statuses.length > 0
          const isActive  = clickable
            && selectedStatuses?.length === l.statuses.length
            && l.statuses.every(s => selectedStatuses.includes(s))
          return (
            <button
              key={l.label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setSelectedStatuses(isActive ? null : l.statuses)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                !clickable
                  ? 'bg-white text-[#1C2833] border-[#E5E7E9] cursor-default'
                  : isActive
                    ? 'text-white border-transparent'
                    : 'bg-white text-[#1C2833] border-[#E5E7E9] hover:border-gray-300'
              }`}
              style={isActive ? { backgroundColor: l.color, borderColor: l.color } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={
                  l.color === null
                    ? { backgroundColor: '#fff', border: '1.5px solid #B5B8BC' }
                    : { backgroundColor: isActive ? 'white' : l.color }
                }
              />
              {l.label}
              <span className="text-[10px] opacity-70 hidden sm:inline">— {l.desc}</span>
            </button>
          )
        })}
        {selectedStatuses && (
          <button
            onClick={() => setSelectedStatuses(null)}
            className="px-3 py-1.5 rounded-full border border-[#E5E7E9] bg-white text-xs text-[#1C2833] hover:bg-gray-50"
          >
            Clear filter
          </button>
        )}
        <span className="flex items-center gap-1.5 text-xs text-[#1C2833] ml-1">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: 'rgba(192,57,43,0.18)', border: '1px solid rgba(192,57,43,0.4)' }} />
          Date already reserved/booked
        </span>
      </div>

      {/* Calendar card */}
      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E7E9] flex items-center justify-between bg-[#FADBD8]/30">
          <p className="text-sm font-semibold text-[#1C2833]">
            {adminView ? 'All Reservations' : 'My Bookings'}
          </p>
          <p className="text-xs text-[#1C2833]">
            Last updated: {lastUpdated.toLocaleTimeString()}
            {isFetching && <span className="ml-1 text-[#C0392B]">· Refreshing…</span>}
          </p>
        </div>
        <CardContent className="p-5">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={events}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            dayCellClassNames={dayCellClassNames}
            height="auto"
            dayMaxEvents={3}
            eventDisplay="block"
            nowIndicator
            // Week/Day (timeGrid) time axis: a slot + its label every 30 minutes,
            // so reservations that don't line up on the hour are easy to place.
            slotDuration="00:30:00"
            slotLabelInterval="00:30:00"
            // Default rendering crams everything into one line ("6:40 - 7:40
            // Juan dela Cruz — Basketball Court A"), which wraps mid-word in the
            // narrow columns Week/Day views give each event and reads as noise.
            // A clear two-line layout (facility bold, client name small below —
            // color already encodes status, so it doesn't need repeating here)
            // stays legible even in a narrow slot.
            eventContent={(arg) => {
              const { facilityName, userName } = arg.event.extendedProps
              return (
                <div className="fc-event-inner">
                  <div className="fc-event-time">{arg.timeText}</div>
                  <div className="fc-event-facility">{facilityName}</div>
                  {adminView && userName && <div className="fc-event-user">{userName}</div>}
                </div>
              )
            }}
            // dayMaxEvents above only caps month view. Week/Day (timeGrid) views
            // don't stack overlapping events into a scrollable list on their own —
            // by default they instead squeeze every concurrent event side-by-side
            // into equal slivers, so a slot with a dozen same-time reservations
            // renders as a dozen unreadable slices. eventMaxStack caps how many
            // show side-by-side before the rest collapse into a "+N more" link.
            views={{
              timeGridWeek: { eventMaxStack: 3 },
              timeGridDay:  { eventMaxStack: 4 },
            }}
          />
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events',  value: totalEvents,    icon: CalendarDays,  color: 'text-[#2980B9] bg-[#D6EAF8]' },
          { label: 'Pending',       value: pendingCount,   icon: Clock,         color: 'text-[#F39C12] bg-[#FEF9E7]' },
          { label: 'Confirmed',     value: confirmedCount, icon: CheckCircle2,  color: 'text-[#27AE60] bg-[#D5F5E3]' },
          { label: 'Cancelled / Rejected', value: rejectedCount, icon: XCircle, color: 'text-[#C0392B] bg-[#FADBD8]' },
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

      <style>{`
        .fc-button-primary { background-color: #C0392B !important; border-color: #96281B !important; border-radius: 8px !important; font-size: 0.8rem !important; }
        .fc-button-primary:hover { background-color: #96281B !important; }
        .fc-button-primary:not(:disabled).fc-button-active,
        .fc-button-primary:not(:disabled):active { background-color: #96281B !important; }
        .fc-today-button:disabled { background-color: #F1948A !important; border-color: #F1948A !important; }
        .fc-daygrid-day.fc-day-today { background-color: #FADBD8 !important; }
        /* Day cells with at least one active reservation — takes priority over the
           today-highlight above since it's declared after it. */
        .fc-daygrid-day.fc-day-booked { background-color: rgba(192, 57, 43, 0.16) !important; }
        .fc-daygrid-day.fc-day-booked-strong { background-color: rgba(192, 57, 43, 0.32) !important; }
        .fc .fc-toolbar-title { color: #1C2833; font-size: 1.1rem; font-weight: 700; }
        .fc-col-header-cell-cushion { color: #717D7E; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .fc-daygrid-day-number { color: #1C2833; font-size: 0.8rem; }
        .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background-color: #C0392B; color: white; border-radius: 50%;
          width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
        }
        .fc-event { border-radius: 6px !important; padding: 2px 5px !important; }
        .fc-toolbar { margin-bottom: 1rem !important; }
        .fc-list-event:hover td { background-color: #FADBD8 !important; }

        /* Week/Day time axis — with a label on every 30-min row (slotDuration ===
           slotLabelInterval), FullCalendar's default ~1.5em row height packs them
           with almost no gap. Give each row real height and its label some
           padding so times read as a list, not a solid wall of text. */
        .fc-timegrid-slot { height: 2.75em !important; border-color: #F2F3F4 !important; }
        .fc-timegrid-slot-label-cushion { padding: 4px 10px !important; font-size: 0.78rem; color: #717D7E; }
        .fc-timegrid-slot-label { vertical-align: top !important; }

        /* Custom two-line event content (see eventContent above) — facility name
           is the primary line since that's what matters most when scanning a
           day; client name (admin/staff only) is a smaller secondary line.
           Both truncate with an ellipsis instead of wrapping mid-word, which is
           what made narrow Week/Day columns look cluttered before. */
        .fc-event-inner { overflow: hidden; line-height: 1.25; }
        .fc-event-time { font-size: 0.68rem; font-weight: 700; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fc-event-facility { font-size: 0.74rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fc-event-user { font-size: 0.68rem; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fc-daygrid-event .fc-event-time,
        .fc-daygrid-event .fc-event-facility,
        .fc-daygrid-event .fc-event-user { display: inline; margin-right: 4px; }
        .fc-more-link { font-weight: 600; }
      `}</style>
    </div>
  )
}
