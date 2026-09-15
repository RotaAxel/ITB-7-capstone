import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format, parseISO,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  startOfISOWeek, endOfISOWeek, setISOWeek, setISOWeekYear,
} from 'date-fns'
import { toast } from 'sonner'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Download, FileText, FileBarChart, ChevronLeft, ChevronRight,
  TrendingUp, ClipboardList, Banknote, CheckCircle2, Building2, Users, CalendarRange,
} from 'lucide-react'
import api from '@/api/axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Input from '@/components/ui/Input'
import Label from '@/components/ui/Label'

const SELECT_CLS = 'mt-1 block w-full rounded-xl border border-[#E5E7E9] px-3 py-2 text-sm bg-white transition-all duration-200 hover:border-[#f3c6c1] focus:outline-none focus:ring-2 focus:ring-[#FADBD8] focus:border-[#C0392B]'
const DATE_INPUT_CLS = 'mt-1 h-9 text-sm rounded-xl transition-all duration-200 hover:border-[#f3c6c1] focus:ring-[#FADBD8] focus:border-[#C0392B]'

const PERIOD_PRESETS = [
  { key: 'weekly',    label: 'Weekly Report'    },
  { key: 'monthly',   label: 'Monthly Report'   },
  { key: 'quarterly', label: 'Quarterly Report' },
  { key: 'yearly',    label: 'Yearly Report'    },
]

const MONTH_NAMES = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
]

// Years selectable in the Year dropdown — the current year back through the
// last decade. No future years: a report can't cover a year that hasn't
// happened yet.
const CURRENT_YEAR   = new Date().getFullYear()
const YEAR_OPTIONS   = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - i)

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
]

// Each period type resolves its own picker values ({ week } | { month, year } |
// { quarter, year } | { year }) into an actual [from, to] date range.
const rangeForWeek = (weekValue) => {
  const [isoYear, isoWeek] = weekValue.split('-W').map(Number)
  let d = setISOWeekYear(new Date(), isoYear)
  d = setISOWeek(d, isoWeek)
  return [startOfISOWeek(d), endOfISOWeek(d)]
}
const rangeForMonth   = (month, year)   => { const d = new Date(year, month - 1, 1);        return [startOfMonth(d),   endOfMonth(d)] }
const rangeForQuarter = (quarter, year) => { const d = new Date(year, (quarter - 1) * 3, 1); return [startOfQuarter(d), endOfQuarter(d)] }
const rangeForYear    = (year)          => { const d = new Date(year, 0, 1);                return [startOfYear(d),    endOfYear(d)] }

const currentIsoWeekValue = (d) => format(d, "RRRR-'W'II")

export default function AdminAnalytics() {
  // Which report period is active. Defaults to "weekly" (the current week) so the
  // page opens already scoped instead of an empty/all-time custom range. Each period
  // type shows its own natural picker instead of a generic date range — Weekly gets
  // a week picker, Monthly gets Month+Year, Quarterly gets Quarter+Year, Yearly gets
  // just Year — and picking a value immediately resolves it into the actual date range.
  const [activePeriod, setActivePeriod] = useState('weekly')
  const [weekValue, setWeekValue] = useState(() => currentIsoWeekValue(new Date()))
  const [month,      setMonth]    = useState(() => new Date().getMonth() + 1)
  const [quarter,    setQuarter]  = useState(() => Math.floor(new Date().getMonth() / 3) + 1)
  const [year,       setYear]     = useState(() => new Date().getFullYear())

  const [filters, setFilters] = useState(() => {
    const [from, to] = rangeForWeek(currentIsoWeekValue(new Date()))
    return {
      date_from: format(from, 'yyyy-MM-dd'), date_to: format(to, 'yyyy-MM-dd'),
      facility_id: '', status: 'all', payment_status: 'all',
    }
  })
  const [page, setPage] = useState(1)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingFinancial, setDownloadingFinancial] = useState(false)

  const { data: summary } = useQuery({
    queryKey: ['admin', 'analytics', 'summary'],
    queryFn: () => api.get('/admin/analytics/summary').then(r => r.data),
  })

  const { data: revenue = [] } = useQuery({
    queryKey: ['admin', 'analytics', 'revenue'],
    queryFn: () => api.get('/admin/analytics/revenue').then(r => r.data),
  })

  const { data: utilization = [] } = useQuery({
    queryKey: ['admin', 'analytics', 'utilization'],
    queryFn: () => api.get('/admin/analytics/utilization').then(r => r.data),
  })

  const { data: trends = [] } = useQuery({
    queryKey: ['admin', 'analytics', 'trends'],
    queryFn: () => api.get('/admin/analytics/trends').then(r => r.data),
  })

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  })

  const reportParams = {
    page,
    ...(filters.date_from               && { date_from:      filters.date_from }),
    ...(filters.date_to                 && { date_to:        filters.date_to }),
    ...(filters.facility_id             && { facility_id:    filters.facility_id }),
    ...(filters.status !== 'all'        && { status:         filters.status }),
    ...(filters.payment_status !== 'all'&& { payment_status: filters.payment_status }),
  }

  const { data: reports, isLoading: loadingReports, isFetching } = useQuery({
    queryKey: ['admin', 'reports', reportParams],
    queryFn: () => api.get('/admin/reports', { params: reportParams }).then(r => r.data),
    placeholderData: prev => prev,
  })

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  // Applies a resolved [from, to] range to the report filters.
  const applyRange = ([from, to]) => {
    setFilters(f => ({ ...f, date_from: format(from, 'yyyy-MM-dd'), date_to: format(to, 'yyyy-MM-dd') }))
    setPage(1)
  }

  const selectPeriod = (key) => {
    // Clicking the already-active preset toggles it off, back to a custom range.
    if (activePeriod === key) {
      setActivePeriod(null)
      setFilters(f => ({ ...f, date_from: '', date_to: '' }))
      setPage(1)
      return
    }
    setActivePeriod(key)
    // Reset that period's picker to "now" and apply immediately, using local values
    // rather than the (not-yet-updated) state so this doesn't apply stale numbers.
    const now = new Date()
    const w = currentIsoWeekValue(now)
    const m = now.getMonth() + 1
    const q = Math.floor(now.getMonth() / 3) + 1
    const y = now.getFullYear()
    setWeekValue(w); setMonth(m); setQuarter(q); setYear(y)
    if (key === 'weekly')    applyRange(rangeForWeek(w))
    if (key === 'monthly')   applyRange(rangeForMonth(m, y))
    if (key === 'quarterly') applyRange(rangeForQuarter(q, y))
    if (key === 'yearly')    applyRange(rangeForYear(y))
  }

  const changeWeek    = (w) => { setWeekValue(w); applyRange(rangeForWeek(w)) }
  const changeMonth   = (m) => { setMonth(m);      applyRange(rangeForMonth(m, year)) }
  const changeQuarter = (q) => { setQuarter(q);    applyRange(rangeForQuarter(q, year)) }
  const changeYear    = (y) => {
    setYear(y)
    if (activePeriod === 'monthly')   applyRange(rangeForMonth(month, y))
    if (activePeriod === 'quarterly') applyRange(rangeForQuarter(quarter, y))
    if (activePeriod === 'yearly')    applyRange(rangeForYear(y))
  }

  const downloadPdf = () => {
    const pdfParams = { ...reportParams }
    delete pdfParams.page
    pdfParams.format = 'pdf'
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(pdfParams).filter(([, v]) => v))
    ).toString()
    setDownloadingPdf(true)
    // Large exports render server-side as several chunked PDF tables and can take a while —
    // well past the client's default 15s timeout — so this request gets a longer allowance.
    api.get(`/admin/reports?${query}`, { responseType: 'blob', timeout: 60_000 })
      .then(res => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const a   = document.createElement('a')
        a.href     = url
        a.download = `cabs-report-${format(new Date(), 'yyyyMMdd')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download report.'))
      .finally(() => setDownloadingPdf(false))
  }

  const downloadFinancialReport = () => {
    const params = {}
    if (filters.date_from)   params.date_from   = filters.date_from
    if (filters.date_to)     params.date_to     = filters.date_to
    if (filters.facility_id) params.facility_id = filters.facility_id
    const query = new URLSearchParams(params).toString()
    setDownloadingFinancial(true)
    api.get(`/admin/reports/financial?${query}`, { responseType: 'blob', timeout: 60_000 })
      .then(res => {
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const a   = document.createElement('a')
        a.href     = url
        a.download = `cabs-financial-report-${format(new Date(), 'yyyyMMdd')}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => toast.error('Failed to download financial report.'))
      .finally(() => setDownloadingFinancial(false))
  }

  const rows     = reports?.data         ?? []
  const lastPage = reports?.last_page    ?? 1
  const curPage  = reports?.current_page ?? 1
  const total    = reports?.total        ?? 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-l-4 border-[#C0392B] pl-4">
        <h1 className="text-2xl font-bold text-[#1C2833]">Analytics &amp; Reports</h1>
        <p className="text-[#1C2833] text-sm mt-0.5">Revenue, utilization trends, and reservation reports</p>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Reservations This Month',
            value: summary?.total_reservations_this_month ?? '—',
            icon: ClipboardList,
            color: 'text-[#2980B9] bg-[#D6EAF8]',
          },
          {
            label: 'Revenue This Month',
            value: summary ? `₱${Number(summary.total_revenue_this_month ?? 0).toLocaleString()}` : '—',
            icon: Banknote,
            color: 'text-[#1E8449] bg-[#EAFAF1]',
          },
          {
            label: 'Pending Approvals',
            value: summary?.pending_reservations ?? '—',
            icon: CheckCircle2,
            color: 'text-[#F39C12] bg-[#FEF9E7]',
          },
          {
            label: 'Total Clients',
            value: summary?.total_clients ?? '—',
            icon: Users,
            color: 'text-[#C0392B] bg-[#FADBD8]',
          },
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Monthly Revenue</CardTitle>
                <p className="text-xs text-[#1C2833] mt-0.5">Collected payments per month</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#FADBD8] flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#C0392B]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {revenue.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-[#1C2833] text-sm">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C0392B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C0392B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F4" />
                  <XAxis dataKey="month_label" tick={{ fontSize: 10, fill: '#717D7E' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#717D7E' }} tickFormatter={v => `₱${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7E9', fontSize: '12px' }}
                    formatter={v => [`₱${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#C0392B" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bookings by day */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bookings by Day of Week</CardTitle>
                <p className="text-xs text-[#1C2833] mt-0.5">Last 90 days</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#D5F5E3] flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-[#27AE60]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {trends.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-[#1C2833] text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F4" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#717D7E' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#717D7E' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7E9', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#27AE60" radius={[6, 6, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Facility utilization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Facility Utilization</CardTitle>
                <p className="text-xs text-[#1C2833] mt-0.5">Bookings per facility in the last 30 days</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#F5EEF8] flex items-center justify-center">
                <Building2 className="h-4 w-4 text-[#8E44AD]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {utilization.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-[#1C2833] text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={utilization} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F4" />
                  <XAxis dataKey="facility" tick={{ fontSize: 10, fill: '#717D7E' }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#717D7E' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7E9', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#8E44AD" radius={[6, 6, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports section */}
      <Card>
        {/* Report header */}
        <div className="px-6 py-4 border-b border-[#E5E7E9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#D6EAF8] flex items-center justify-center">
              <FileText className="h-4 w-4 text-[#2980B9]" />
            </div>
            <div>
              <p className="font-bold text-[#1C2833] text-base">Reservation Report</p>
              <p className="text-xs text-[#1C2833]">{total} records match current filters</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              loading={downloadingFinancial}
              onClick={downloadFinancialReport}
              className="flex items-center gap-2 bg-white text-[#C0392B] border-[#C0392B] rounded-full hover:bg-[#C0392B] hover:text-white transition-colors duration-200"
            >
              {!downloadingFinancial && <FileBarChart className="h-4 w-4" />} {downloadingFinancial ? 'Generating…' : 'Financial Report'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={downloadingPdf}
              onClick={downloadPdf}
              className="flex items-center gap-2 bg-white text-[#C0392B] border-[#C0392B] rounded-full hover:bg-[#C0392B] hover:text-white transition-colors duration-200"
            >
              {!downloadingPdf && <Download className="h-4 w-4" />} {downloadingPdf ? 'Generating…' : 'Export PDF'}
            </Button>
          </div>
        </div>

        {/* Filters — plain white, no tinted container; the period switcher reads as
            a flat segmented control (active = white pill, inactive = plain text). */}
        <div className="px-6 py-4 border-b border-[#E5E7E9]">
          {/* Quick report periods — each one swaps the From/To range below for its own
              natural picker (Week / Month+Year / Quarter+Year / Year). Click the
              active one again to switch back to a custom From/To range. */}
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-full bg-[#F7F8F9] mb-4">
            {PERIOD_PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPeriod(p.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ease-out ${
                  activePeriod === p.key
                    ? 'bg-white text-[#C0392B] shadow-sm'
                    : 'text-[#717D7E] hover:text-[#1C2833]'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" /> {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {activePeriod === 'weekly' && (
              <div>
                <Label className="text-xs text-[#1C2833]">Week</Label>
                <Input type="week" value={weekValue}
                  onChange={e => changeWeek(e.target.value)} className={DATE_INPUT_CLS} />
              </div>
            )}

            {activePeriod === 'monthly' && (
              <>
                <div>
                  <Label className="text-xs text-[#1C2833]">Month</Label>
                  <select value={month} onChange={e => changeMonth(Number(e.target.value))} className={SELECT_CLS}>
                    {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-[#1C2833]">Year</Label>
                  <select value={year} onChange={e => changeYear(Number(e.target.value))} className={SELECT_CLS}>
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </>
            )}

            {activePeriod === 'quarterly' && (
              <>
                <div>
                  <Label className="text-xs text-[#1C2833]">Quarter</Label>
                  <select value={quarter} onChange={e => changeQuarter(Number(e.target.value))} className={SELECT_CLS}>
                    {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-[#1C2833]">Year</Label>
                  <select value={year} onChange={e => changeYear(Number(e.target.value))} className={SELECT_CLS}>
                    {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </>
            )}

            {activePeriod === 'yearly' && (
              <div>
                <Label className="text-xs text-[#1C2833]">Year</Label>
                <select value={year} onChange={e => changeYear(Number(e.target.value))} className={SELECT_CLS}>
                  {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {!activePeriod && (
              <>
                <div>
                  <Label className="text-xs text-[#1C2833]">From</Label>
                  <Input type="date" value={filters.date_from}
                    onChange={e => setFilter('date_from', e.target.value)} className={DATE_INPUT_CLS} />
                </div>
                <div>
                  <Label className="text-xs text-[#1C2833]">To</Label>
                  <Input type="date" value={filters.date_to}
                    onChange={e => setFilter('date_to', e.target.value)} className={DATE_INPUT_CLS} />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs text-[#1C2833]">Facility</Label>
              <select value={filters.facility_id} onChange={e => setFilter('facility_id', e.target.value)} className={SELECT_CLS}>
                <option value="">All facilities</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[#1C2833]">Status</Label>
              <select value={filters.status} onChange={e => setFilter('status', e.target.value)} className={SELECT_CLS}>
                {['all','pending','approved','confirmed','completed','rejected','cancelled'].map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[#1C2833]">Payment</Label>
              <select value={filters.payment_status} onChange={e => setFilter('payment_status', e.target.value)} className={SELECT_CLS}>
                {['all','pending','paid','failed','expired'].map(s => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <CardContent className="p-0">
          {loadingReports ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-[#1C2833] text-sm">No records match the selected filters.</div>
          ) : (
            <div className={`overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FADBD8]/40 border-b border-[#E5E7E9]">
                    {['#','Client','Facility','Date','Time','Status','Amount','Payment','Receipt'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold text-[#96281B] text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7E9]">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-[#FADBD8]/10 transition-colors">
                      <td className="px-4 py-3 text-[#1C2833] font-mono text-xs">{r.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1C2833] whitespace-nowrap">{r.user?.full_name}</p>
                        <p className="text-xs text-[#1C2833]">{r.user?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.facility?.name}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.reservation_date ? format(parseISO(r.reservation_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {r.start_time?.slice(0, 5)} – {r.end_time?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3"><Badge status={r.status} /></td>
                      <td className="px-4 py-3 font-semibold text-[#1E8449] whitespace-nowrap">
                        ₱{Number(r.payment?.amount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {r.payment && <Badge status={r.payment.status} />}
                      </td>
                      <td className="px-4 py-3 text-[#1C2833] font-mono text-xs">
                        {r.payment?.receipt_number ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastPage > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7E9]">
              <p className="text-sm text-[#1C2833]">
                Page {curPage} of {lastPage} · <span className="font-medium text-[#1C2833]">{total}</span> records
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
