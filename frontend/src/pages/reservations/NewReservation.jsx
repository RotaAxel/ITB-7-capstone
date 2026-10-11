import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, ChevronLeft, ChevronRight, Upload, FileCheck, X } from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'
import { useAuth } from '@/hooks/useAuth'

const STEPS = ['Schedule', 'Details', 'Review']

// Mirrors ReservationController::LARGE_EVENT_THRESHOLD — at or above this many
// participants, a reservation is treated as a "large event" and must include a
// waste management plan, a crowd management plan, and pre-/post-event
// considerations. Below it, those fields aren't even shown.
const LARGE_EVENT_THRESHOLD = 50

const fmt12 = t => {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

export default function NewReservation() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const preselected     = searchParams.get('facility')
  const { user }        = useAuth()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    type:                    'reserve',
    facility_id:            preselected || '',
    reservation_date:       '',
    reservation_dates:      [], // used only when multiDate is on — several dates, same facility/time/details, submitted/approved/paid as one bundle
    start_time:             '',
    end_time:               '',
    purpose:                '',
    number_of_participants: '',
    selected_amenities:     [],
    waste_management_plan:  '',
    crowd_management_plan:  '',
    event_considerations:   '',
  })
  const [errors, setErrors] = useState({})
  const [letterFile, setLetterFile] = useState(null)
  const [requestLetterFile, setRequestLetterFile] = useState(null)
  const [multiDate, setMultiDate] = useState(false)
  const [dateToAdd, setDateToAdd] = useState('')

  const today = new Date().toISOString().split('T')[0]

  const { data: facilities = [], isLoading: loadingFacilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
    select: data => data.filter(f => f.status === 'available'),
    enabled: !preselected,
  })

  const { data: facilityDetail } = useQuery({
    queryKey: ['facility', form.facility_id],
    queryFn: () => api.get(`/facilities/${form.facility_id}`).then(r => r.data),
    enabled: Boolean(form.facility_id),
  })

  const { data: bookedSlots = [] } = useQuery({
    queryKey: ['availability', form.facility_id, form.reservation_date],
    queryFn: () =>
      api.get(`/facilities/${form.facility_id}/availability`, {
        params: { date: form.reservation_date },
      }).then(r => r.data),
    enabled: Boolean(form.facility_id && form.reservation_date),
  })

  // A facility that requires an authorization letter always needs a human to
  // review that letter before anything is confirmed — incompatible with "Book",
  // which auto-confirms on payment with no review. Derived rather than written
  // back into form.type: this is the type actually used everywhere below (the
  // picker itself just stops offering "Book" for these facilities), so a stale
  // "book" left in state from before a letter-requiring facility was selected
  // can never leak into the submitted request or the summary text.
  const letterRequired = Boolean(facilityDetail?.requires_authorization_letter || facilityDetail?.requires_request_letter)
  const effectiveType  = letterRequired ? 'reserve' : form.type

  const mutation = useMutation({
    mutationFn: data => api.post('/reservations', data), // plain object or FormData — see submit()
    onSuccess: res => {
      // A bundle (reservation_dates with 2+ dates) comes back as { group_id,
      // reservations: [...] } instead of a single reservation object — route to
      // the group's own view instead of a single reservation's.
      if (res.data.group_id) {
        toast.success(`${res.data.reservations.length}-date reservation submitted successfully!`)
        navigate(`/reservations/group/${res.data.group_id}`, { replace: true })
        return
      }
      toast.success(effectiveType === 'book' ? 'Booking submitted successfully!' : 'Reservation submitted successfully!')
      navigate(`/reservations/${res.data.id}`, { replace: true })
    },
    onError: err => {
      toast.error(err.response?.data?.message || 'Failed to submit reservation.')
    },
  })

  const setField = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const toggleAmenity = id => {
    setForm(f => ({
      ...f,
      selected_amenities: f.selected_amenities.includes(id)
        ? f.selected_amenities.filter(x => x !== id)
        : [...f.selected_amenities, id],
    }))
  }

  const hasConflict = () => {
    if (!form.start_time || !form.end_time) return false
    return bookedSlots.some(
      s => form.start_time < s.end_time && form.end_time > s.start_time
    )
  }

  // Multi-date mode has no live per-date conflict preview (the availability
  // endpoint only checks one date at a time) — the server validates every date
  // atomically at submission and reports back which ones, if any, conflict.
  const addDate = () => {
    if (!dateToAdd) return
    if (dateToAdd < today) {
      toast.error('Reservation date cannot be in the past.')
      return
    }
    if (form.reservation_dates.includes(dateToAdd)) {
      toast.error('That date is already in the list.')
      return
    }
    setForm(f => ({ ...f, reservation_dates: [...f.reservation_dates, dateToAdd].sort() }))
    setDateToAdd('')
    setErrors(e => ({ ...e, reservation_dates: '' }))
  }

  const removeDate = date => {
    setForm(f => ({ ...f, reservation_dates: f.reservation_dates.filter(d => d !== date) }))
  }

  const validateStep0 = () => {
    const errs = {}
    if (!form.facility_id) errs.facility_id = 'Please select a facility.'
    if (multiDate) {
      if (form.reservation_dates.length === 0) errs.reservation_dates = 'Please add at least one date.'
    } else {
      if (!form.reservation_date) errs.reservation_date = 'Please select a date.'
      else if (form.reservation_date < today) errs.reservation_date = 'Reservation date cannot be in the past.'
    }
    if (!form.start_time)       errs.start_time       = 'Please enter a start time.'
    if (!form.end_time)         errs.end_time         = 'Please enter an end time.'
    if (form.start_time && form.end_time && form.start_time >= form.end_time) {
      errs.end_time = 'End time must be after start time.'
    }
    if (!multiDate && hasConflict()) {
      errs.start_time = 'This time slot conflicts with an existing booking.'
    }
    if (facilityDetail?.requires_authorization_letter && !letterFile) {
      errs.authorization_letter = `${facilityDetail.name} requires an authorization letter to be attached.`
    }
    if (facilityDetail?.requires_request_letter && !requestLetterFile) {
      errs.request_letter = `${facilityDetail.name} requires a request letter to be attached.`
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const validateStep1 = () => {
    const errs = {}
    if (!form.purpose.trim()) {
      errs.purpose = 'Please describe the purpose.'
    }
    const n = Number(form.number_of_participants)
    if (!form.number_of_participants || n < 1) {
      errs.number_of_participants = 'Participants must be at least 1.'
    }
    if (facilityDetail?.capacity && n > facilityDetail.capacity) {
      errs.number_of_participants = `Exceeds facility capacity of ${facilityDetail.capacity}.`
    }
    if (n >= LARGE_EVENT_THRESHOLD) {
      if (!form.waste_management_plan.trim()) errs.waste_management_plan = 'Required for events of this size.'
      if (!form.crowd_management_plan.trim()) errs.crowd_management_plan = 'Required for events of this size.'
      if (!form.event_considerations.trim())  errs.event_considerations  = 'Required for events of this size.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const goNext = () => {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    setStep(s => s + 1)
  }

  const submit = () => {
    // Only switch to multipart when there's a file to send — keeps the plain-JSON
    // path (and every facility that doesn't need a letter) untouched.
    if (letterFile || requestLetterFile) {
      const fd = new FormData()
      fd.append('facility_id',            form.facility_id)
      if (multiDate) {
        form.reservation_dates.forEach(d => fd.append('reservation_dates[]', d))
      } else {
        fd.append('reservation_date',     form.reservation_date)
      }
      fd.append('start_time',             form.start_time)
      fd.append('end_time',               form.end_time)
      fd.append('purpose',                form.purpose)
      fd.append('waste_management_plan',  form.waste_management_plan)
      fd.append('crowd_management_plan',  form.crowd_management_plan)
      fd.append('event_considerations',   form.event_considerations)
      fd.append('number_of_participants', form.number_of_participants)
      form.selected_amenities.forEach(id => fd.append('selected_amenities[]', id))
      fd.append('terms_acknowledged', 'false')
      fd.append('type',                effectiveType)
      if (letterFile)        fd.append('authorization_letter', letterFile)
      if (requestLetterFile) fd.append('request_letter',        requestLetterFile)
      mutation.mutate(fd)
      return
    }

    mutation.mutate({
      facility_id:            Number(form.facility_id),
      ...(multiDate
        ? { reservation_dates: form.reservation_dates }
        : { reservation_date:  form.reservation_date }),
      start_time:             form.start_time,
      end_time:               form.end_time,
      purpose:                form.purpose,
      waste_management_plan:  form.waste_management_plan || null,
      crowd_management_plan:  form.crowd_management_plan || null,
      event_considerations:   form.event_considerations || null,
      number_of_participants: Number(form.number_of_participants),
      selected_amenities:     form.selected_amenities,
      terms_acknowledged:     false,
      type:                   effectiveType,
    })
  }

  const activeFacility = facilityDetail

  const durationHours = form.start_time && form.end_time
    ? (new Date(`2000-01-01T${form.end_time}`) - new Date(`2000-01-01T${form.start_time}`)) / 3_600_000
    : 0

  // Each selected amenity ("material") can carry its own flat additional fee —
  // summed once per selection, not multiplied by its stock quantity. Mirrors the
  // authoritative calculation in ReservationController::store(); this is only an
  // estimate for display, so it staying in sync just keeps the preview honest.
  const amenitiesFee = activeFacility?.amenities
    ?.filter(a => form.selected_amenities.includes(a.id))
    .reduce((sum, a) => sum + Number(a.fee ?? 0), 0) ?? 0

  // Mirrors Facility::rateFor() on the backend — a verified Cabuyeño resident
  // pays resident_price_per_hour when the facility has one set, everyone else
  // pays the standard price_per_hour. Only an estimate for display; the server
  // always re-derives the real charge from the user's own verification status.
  const hourlyRate = activeFacility
    ? (user?.residency_status === 'verified' && activeFacility.resident_price_per_hour != null
        ? Number(activeFacility.resident_price_per_hour)
        : Number(activeFacility.price_per_hour))
    : 0

  const estimatedCostPerDate = durationHours > 0 && activeFacility
    ? durationHours * hourlyRate + amenitiesFee
    : 0

  const dateCount = multiDate ? Math.max(form.reservation_dates.length, 1) : 1
  const estimatedCost = estimatedCostPerDate * dateCount

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="border-l-4 border-[#C0392B] pl-4 mb-6">
        <h1 className="text-2xl font-bold text-[#1C2833]">{effectiveType === 'book' ? 'New Booking' : 'New Reservation'}</h1>
        <p className="text-[#1C2833] text-sm">Book a sports facility for your event.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                i <= step ? 'bg-[#C0392B] text-white' : 'bg-[#F2F3F4] text-[#1C2833]'
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`ml-2 text-sm font-medium hidden sm:inline ${
                i <= step ? 'text-[#C0392B]' : 'text-[#1C2833]'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? 'bg-[#C0392B]' : 'bg-[#E5E7E9]'}`} />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* ── Step 0: Schedule ── */}
          {step === 0 && (
            <>
              <div>
                <Label>Reservation Type *</Label>
                {letterRequired ? (
                  // "Book" auto-confirms on payment with no human review — incompatible
                  // with a facility that requires an authorization letter to be looked
                  // at first. Reservation-only, no picker to fight with.
                  <div className="mt-1 p-3 rounded-lg border-2 border-[#C0392B] bg-[#FADBD8]/30">
                    <p className="font-semibold text-sm text-[#1C2833]">Reserve</p>
                    <p className="text-xs text-[#1C2833] mt-0.5">
                      {facilityDetail.name} requires an authorization letter, so it's reservation-only —
                      staff reviews your request and letter before you pay. Instant "Book" isn't available for it.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    {[
                      { value: 'reserve', title: 'Reserve', desc: 'Request now, pay to submit for approval. Staff reviews and confirms.' },
                      { value: 'book',    title: 'Book',    desc: 'Pay now for instant confirmation. No approval wait.' },
                    ].map(opt => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setField('type', opt.value)}
                        className={`text-left p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                          form.type === opt.value
                            ? 'border-[#C0392B] bg-[#FADBD8]/30'
                            : 'border-[#E5E7E9] hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-semibold text-sm text-[#1C2833]">{opt.title}</p>
                        <p className="text-xs text-[#1C2833] mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!preselected ? (
                <div>
                  <Label>Facility *</Label>
                  {loadingFacilities ? (
                    <div className="mt-1"><Spinner size="sm" /></div>
                  ) : (
                    <select
                      value={form.facility_id}
                      onChange={e => setField('facility_id', e.target.value)}
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white ${
                        errors.facility_id ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                      }`}
                    >
                      <option value="">— Select a facility —</option>
                      {facilities.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name} — ₱{Number(f.price_per_hour).toLocaleString()}/hr
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.facility_id && (
                    <p className="text-red-500 text-xs mt-1">{errors.facility_id}</p>
                  )}
                </div>
              ) : (
                activeFacility && (
                  <div className="flex items-center gap-3 p-3 bg-[#FADBD8]/30 rounded-lg border border-[#F1948A]/30">
                    <div className="flex-1">
                      <p className="font-medium text-[#1C2833]">{activeFacility.name}</p>
                      <p className="text-sm text-[#C0392B]">
                        ₱{Number(activeFacility.price_per_hour).toLocaleString()}/hr
                      </p>
                    </div>
                    <Badge status={activeFacility.status} />
                  </div>
                )
              )}

              {facilityDetail?.requires_authorization_letter && (
                <div>
                  <Label>Authorization Letter *</Label>
                  <p className="text-xs text-[#1C2833] mt-0.5 mb-1.5">
                    {facilityDetail.name} requires a signed authorization letter (PDF or image) to be attached to this request.
                  </p>
                  {letterFile ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#A9DFBF] bg-[#EAFAF1]">
                      <span className="flex items-center gap-2 min-w-0 text-sm text-[#1E8449]">
                        <FileCheck className="h-4 w-4 shrink-0" />
                        <span className="truncate">{letterFile.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setLetterFile(null)}
                        className="p-1 rounded text-[#1E8449] hover:bg-[#D5F5E3] shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      errors.authorization_letter ? 'border-[#C0392B] bg-[#FADBD8]/10' : 'border-[#E5E7E9] hover:bg-gray-50'
                    }`}>
                      <Upload className="h-5 w-5 text-[#1C2833]" />
                      <span className="text-sm text-[#1C2833]">Click to upload — PDF, JPG, or PNG (max 5MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files[0]
                          if (file) { setLetterFile(file); setErrors(er => ({ ...er, authorization_letter: '' })) }
                        }}
                      />
                    </label>
                  )}
                  {errors.authorization_letter && (
                    <p className="text-red-500 text-xs mt-1">{errors.authorization_letter}</p>
                  )}
                </div>
              )}

              {facilityDetail?.requires_request_letter && (
                <div>
                  <Label>Request Letter *</Label>
                  <p className="text-xs text-[#1C2833] mt-0.5 mb-1.5">
                    {facilityDetail.name} requires a formal request letter (PDF or image) addressed to CABS/City Hall
                    to be attached to this request.
                  </p>
                  {requestLetterFile ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#A9DFBF] bg-[#EAFAF1]">
                      <span className="flex items-center gap-2 min-w-0 text-sm text-[#1E8449]">
                        <FileCheck className="h-4 w-4 shrink-0" />
                        <span className="truncate">{requestLetterFile.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRequestLetterFile(null)}
                        className="p-1 rounded text-[#1E8449] hover:bg-[#D5F5E3] shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      errors.request_letter ? 'border-[#C0392B] bg-[#FADBD8]/10' : 'border-[#E5E7E9] hover:bg-gray-50'
                    }`}>
                      <Upload className="h-5 w-5 text-[#1C2833]" />
                      <span className="text-sm text-[#1C2833]">Click to upload — PDF, JPG, or PNG (max 5MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files[0]
                          if (file) { setRequestLetterFile(file); setErrors(er => ({ ...er, request_letter: '' })) }
                        }}
                      />
                    </label>
                  )}
                  {errors.request_letter && (
                    <p className="text-red-500 text-xs mt-1">{errors.request_letter}</p>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label>{multiDate ? 'Dates *' : 'Date *'}</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMultiDate(m => !m)
                      setErrors(e => ({ ...e, reservation_date: '', reservation_dates: '' }))
                    }}
                    className="text-xs font-medium text-[#C0392B] hover:underline"
                  >
                    {multiDate ? 'Switch to a single date' : 'Reserve multiple dates at once'}
                  </button>
                </div>

                {multiDate ? (
                  <>
                    <p className="text-xs text-[#1C2833] mt-0.5 mb-1.5">
                      Pick several dates for the same facility and time slot (e.g. every Saturday this
                      month) — they're submitted, approved, and paid together as one bundle.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        min={today}
                        value={dateToAdd}
                        onChange={e => setDateToAdd(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="outline" onClick={addDate}>Add</Button>
                    </div>
                    {form.reservation_dates.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {form.reservation_dates.map(d => (
                          <li key={d} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#FADBD8]/20 border border-[#F1948A]/20 text-sm">
                            <span className="text-[#1C2833]">{d}</span>
                            <button type="button" onClick={() => removeDate(d)} className="text-[#C0392B] hover:text-[#96281B]">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {errors.reservation_dates && (
                      <p className="text-red-500 text-xs mt-1">{errors.reservation_dates}</p>
                    )}
                  </>
                ) : (
                  <>
                    <Input
                      type="date"
                      min={today}
                      value={form.reservation_date}
                      onChange={e => setField('reservation_date', e.target.value)}
                      error={!!errors.reservation_date}
                      className="mt-1"
                    />
                    {errors.reservation_date && (
                      <p className="text-red-500 text-xs mt-1">{errors.reservation_date}</p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time *</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={e => setField('start_time', e.target.value)}
                    error={!!errors.start_time}
                    className="mt-1"
                  />
                  {errors.start_time && (
                    <p className="text-red-500 text-xs mt-1">{errors.start_time}</p>
                  )}
                </div>
                <div>
                  <Label>End Time *</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={e => setField('end_time', e.target.value)}
                    error={!!errors.end_time}
                    className="mt-1"
                  />
                  {errors.end_time && (
                    <p className="text-red-500 text-xs mt-1">{errors.end_time}</p>
                  )}
                </div>
              </div>

              {durationHours > 0 && activeFacility && (
                <div className="p-3 bg-[#EAFAF1] rounded-lg border border-[#A9DFBF] text-sm">
                  <span className="text-[#1E8449] font-medium">
                    Duration: {durationHours}h/date — Estimated Cost: ₱{estimatedCostPerDate.toLocaleString()}
                    {multiDate && dateCount > 0 && (
                      <> × {dateCount} date{dateCount !== 1 ? 's' : ''} = ₱{estimatedCost.toLocaleString()} total</>
                    )}
                  </span>
                </div>
              )}

              {!multiDate && bookedSlots.length > 0 && (
                <div className="p-3 bg-[#FEF9E7] rounded-lg border border-[#F9E79F] text-sm">
                  <p className="font-semibold text-[#B7950B] mb-2">Already booked on this date:</p>
                  <ul className="space-y-1">
                    {bookedSlots.map((s, i) => (
                      <li key={i} className="text-[#B7950B]">
                        {fmt12(s.start_time)} – {fmt12(s.end_time)}
                        <span className="ml-2 capitalize text-[#F39C12]">({s.status})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <>
              <div>
                <Label>Purpose of Use *</Label>
                <textarea
                  rows={3}
                  value={form.purpose}
                  onChange={e => setField('purpose', e.target.value)}
                  placeholder="e.g. Basketball practice, team training, school event…"
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none ${
                    errors.purpose ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                  }`}
                />
                {errors.purpose && (
                  <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>
                )}
              </div>

              <div>
                <Label>
                  Number of Participants *
                  {facilityDetail?.capacity && (
                    <span className="text-[#1C2833] font-normal ml-1">
                      (max {facilityDetail.capacity})
                    </span>
                  )}
                </Label>
                <select
                  value={form.number_of_participants}
                  onChange={e => setField('number_of_participants', e.target.value)}
                  disabled={!facilityDetail?.capacity}
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] bg-white disabled:bg-gray-50 disabled:cursor-not-allowed ${
                    errors.number_of_participants ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                  }`}
                >
                  <option value="">
                    {facilityDetail?.capacity ? '— Select —' : 'Loading capacity…'}
                  </option>
                  {facilityDetail?.capacity && Array.from({ length: facilityDetail.capacity }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {errors.number_of_participants && (
                  <p className="text-red-500 text-xs mt-1">{errors.number_of_participants}</p>
                )}
              </div>

              {facilityDetail?.amenities?.filter(a => a.is_available).length > 0 && (
                <div>
                  <Label>Amenities (optional)</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {facilityDetail.amenities
                      .filter(a => a.is_available)
                      .map(a => (
                        <label
                          key={a.id}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-[#E5E7E9] text-[#C0392B] h-4 w-4"
                            checked={form.selected_amenities.includes(a.id)}
                            onChange={() => toggleAmenity(a.id)}
                          />
                          <div>
                            <span className="text-sm text-gray-700 font-medium">{a.name}</span>
                            <span className="text-xs text-[#1C2833] ml-1">×{a.quantity}</span>
                            {Number(a.fee) > 0 && (
                              <span className="block text-xs text-[#C0392B] font-medium">
                                +₱{Number(a.fee).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              )}

              {Number(form.number_of_participants) >= LARGE_EVENT_THRESHOLD && (
                <div className="space-y-4">
                  <div className="p-3 bg-[#FEF9E7] rounded-lg border border-[#F9E79F] text-sm text-[#B7950B]">
                    Events with {LARGE_EVENT_THRESHOLD}+ participants need a plan on file before admins can
                    approve the request.
                  </div>

                  <div>
                    <Label>Waste Management Plan *</Label>
                    <textarea
                      rows={2}
                      value={form.waste_management_plan}
                      onChange={e => setField('waste_management_plan', e.target.value)}
                      placeholder="How will trash/waste be collected and disposed of during and after the event?"
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none ${
                        errors.waste_management_plan ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                      }`}
                    />
                    {errors.waste_management_plan && (
                      <p className="text-red-500 text-xs mt-1">{errors.waste_management_plan}</p>
                    )}
                  </div>

                  <div>
                    <Label>Crowd Management Plan *</Label>
                    <textarea
                      rows={2}
                      value={form.crowd_management_plan}
                      onChange={e => setField('crowd_management_plan', e.target.value)}
                      placeholder="How will entry/exit, crowd flow, and security be handled?"
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none ${
                        errors.crowd_management_plan ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                      }`}
                    />
                    {errors.crowd_management_plan && (
                      <p className="text-red-500 text-xs mt-1">{errors.crowd_management_plan}</p>
                    )}
                  </div>

                  <div>
                    <Label>Pre-Event &amp; Post-Event Considerations *</Label>
                    <textarea
                      rows={2}
                      value={form.event_considerations}
                      onChange={e => setField('event_considerations', e.target.value)}
                      placeholder="Setup/teardown schedule, equipment arrival, cleanup responsibilities, etc."
                      className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B] resize-none ${
                        errors.event_considerations ? 'border-[#C0392B]' : 'border-[#E5E7E9]'
                      }`}
                    />
                    {errors.event_considerations && (
                      <p className="text-red-500 text-xs mt-1">{errors.event_considerations}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Review ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Review Your Reservation</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-sm">
                {[
                  ['Type',         effectiveType === 'book' ? 'Book (instant confirm)' : 'Reserve (requires approval)'],
                  ['Facility',     activeFacility?.name],
                  multiDate
                    ? ['Dates',      `${form.reservation_dates.length} dates: ${form.reservation_dates.join(', ')}`]
                    : ['Date',       form.reservation_date],
                  ['Time',         `${form.start_time} – ${form.end_time}`],
                  ['Duration',     `${durationHours}h${multiDate ? '/date' : ''}`],
                  multiDate
                    ? ['Est. Cost',    `₱${estimatedCostPerDate.toLocaleString()}/date × ${dateCount} = ₱${estimatedCost.toLocaleString()}`]
                    : ['Est. Cost',    `₱${estimatedCost.toLocaleString()}`],
                  ['Purpose',      form.purpose],
                  ['Participants', form.number_of_participants],
                  ['Amenities',
                    form.selected_amenities.length > 0
                      ? facilityDetail?.amenities
                          ?.filter(a => form.selected_amenities.includes(a.id))
                          .map(a => a.name)
                          .join(', ')
                      : 'None',
                  ],
                  ...(facilityDetail?.requires_authorization_letter
                    ? [['Authorization Letter', letterFile?.name ?? '—']]
                    : []),
                  ...(facilityDetail?.requires_request_letter
                    ? [['Request Letter', requestLetterFile?.name ?? '—']]
                    : []),
                  ...(Number(form.number_of_participants) >= LARGE_EVENT_THRESHOLD
                    ? [
                        ['Waste Management', form.waste_management_plan],
                        ['Crowd Management', form.crowd_management_plan],
                        ['Event Considerations', form.event_considerations],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-4 px-4 py-2.5">
                    <span className="font-medium text-[#1C2833] w-28 shrink-0">{label}</span>
                    <span className="text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-[#1C2833] bg-[#FADBD8]/20 p-3 rounded-lg border border-[#F1948A]/20">
                {effectiveType === 'book'
                  ? <>After submission, you'll be asked to <strong>review the terms and complete payment</strong> right away. Once payment is received, your booking is confirmed instantly — no approval wait.</>
                  : <>After submission, an admin will <strong>review and approve</strong> your request first. You'll only be asked to review the terms and pay once it's approved.</>}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-gray-100">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={goNext}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={submit}
                loading={mutation.isPending}
                disabled={mutation.isPending}
              >
                {multiDate
                  ? `Submit ${form.reservation_dates.length || ''} Dates`
                  : (effectiveType === 'book' ? 'Submit Booking' : 'Submit Reservation')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
