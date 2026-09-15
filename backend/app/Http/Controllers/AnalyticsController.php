<?php

namespace App\Http\Controllers;

use App\Models\Facility;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AnalyticsController extends Controller
{
    public function summary()
    {
        $now   = now();
        $today = $now->toDateString();

        $totalReservationsThisMonth = Reservation::whereMonth('created_at', $now->month)
            ->whereYear('created_at', $now->year)
            ->count();

        $totalRevenueThisMonth = Payment::where('status', 'paid')
            ->whereMonth('paid_at', $now->month)
            ->whereYear('paid_at', $now->year)
            ->sum('amount');

        $mostReservedFacility = Reservation::select('facility_id', DB::raw('COUNT(*) as total'))
            ->groupBy('facility_id')
            ->orderByDesc('total')
            ->with('facility:id,name')
            ->first();

        $pendingReservations = Reservation::where('status', 'pending')->count();

        $confirmedToday = Reservation::where('status', 'confirmed')
            ->where('reservation_date', $today)
            ->count();

        $totalUsers     = User::where('role', 'client')->count();
        $totalFacilities = Facility::count();

        return response()->json([
            'total_reservations_this_month' => $totalReservationsThisMonth,
            'total_revenue_this_month'      => (float) $totalRevenueThisMonth,
            'most_reserved_facility'        => $mostReservedFacility ? [
                'id'    => $mostReservedFacility->facility_id,
                'name'  => $mostReservedFacility->facility->name ?? 'N/A',
                'count' => $mostReservedFacility->total,
            ] : null,
            'pending_reservations'          => $pendingReservations,
            'confirmed_today'               => $confirmedToday,
            'total_clients'                 => $totalUsers,
            'total_facilities'              => $totalFacilities,
        ]);
    }

    public function monthlyRevenue()
    {
        $rows = Payment::where('status', 'paid')
            ->where('paid_at', '>=', now()->subMonths(11)->startOfMonth())
            ->select(
                DB::raw("DATE_FORMAT(paid_at, '%Y-%m') as month_key"),
                DB::raw("DATE_FORMAT(paid_at, '%b %Y')  as month_label"),
                DB::raw('SUM(amount) as revenue')
            )
            ->groupBy('month_key', 'month_label')
            ->orderBy('month_key')
            ->get();

        return response()->json($rows);
    }

    public function facilityUtilization()
    {
        $rows = Reservation::where('reservation_date', '>=', now()->subDays(30)->toDateString())
            ->whereIn('status', ['approved', 'confirmed', 'completed'])
            ->select('facility_id', DB::raw('COUNT(*) as count'))
            ->groupBy('facility_id')
            ->with('facility:id,name')
            ->orderByDesc('count')
            ->get()
            ->map(fn($r) => [
                'facility_id' => $r->facility_id,
                'facility'    => $r->facility->name ?? 'Unknown',
                'count'       => $r->count,
            ]);

        return response()->json($rows);
    }

    public function bookingTrends()
    {
        $dayMap = [1 => 'Sun', 2 => 'Mon', 3 => 'Tue', 4 => 'Wed', 5 => 'Thu', 6 => 'Fri', 7 => 'Sat'];

        $rows = Reservation::select(
                DB::raw('DAYOFWEEK(reservation_date) as day_num'),
                DB::raw('COUNT(*) as count')
            )
            ->where('reservation_date', '>=', now()->subDays(90)->toDateString())
            ->groupBy('day_num')
            ->orderBy('day_num')
            ->get()
            ->map(fn($r) => [
                'day'   => $dayMap[$r->day_num] ?? 'Unknown',
                'count' => $r->count,
            ]);

        return response()->json($rows);
    }

    public function reports(Request $request)
    {
        $query = Reservation::with(['user', 'facility', 'payment'])
            ->when($request->filled('date_from'),      fn($q) => $q->where('reservation_date', '>=', $request->date_from))
            ->when($request->filled('date_to'),        fn($q) => $q->where('reservation_date', '<=', $request->date_to))
            ->when($request->filled('facility_id'),    fn($q) => $q->where('facility_id', $request->facility_id))
            ->when($request->filled('status'),         fn($q) => $q->where('status', $request->status))
            ->when($request->filled('payment_status'), fn($q) => $q->whereHas('payment', fn($p) => $p->where('status', $request->payment_status)))
            ->orderByDesc('reservation_date');

        if ($request->query('format') === 'pdf') {
            // dompdf keeps a full in-memory layout tree per table, which grows steeply
            // (measured: ~17s/206MB at 600 rows vs. ~57s/438MB at 1000) — cap how many
            // rows go into one PDF (the on-screen/CSV-era paths are unaffected) and tell
            // the admin to narrow filters for the rest. This used to be 1000 rows split
            // into several small chunked <table>s to keep any single table's layout tree
            // small, but that chunking caused its own visible bugs (chunk boundaries
            // landing awkwardly against page boundaries left near-empty pages, or two
            // chunks' headers stacked a few rows apart) — a single continuous table with
            // a lower row cap is slower per-row but renders correctly with dompdf's
            // native <thead> repeat-per-page behavior, with none of that breakage.
            $maxRows = 600;

            $totalMatching = (clone $query)->count();
            $reservations  = $query->limit($maxRows)->get();
            $truncated     = $totalMatching > $reservations->count();

            // Totals for the closing row at the very end of the table — paid amount
            // only (an unpaid/pending row has no real amount to add to a revenue sum).
            $totalRevenue = (float) $reservations->reduce(
                fn($carry, $r) => $carry + ($r->payment && $r->payment->status === 'paid' ? $r->payment->amount : 0),
                0
            );
            $paidCount = $reservations->filter(fn($r) => $r->payment && $r->payment->status === 'paid')->count();

            // Small safety margin on top of the row cap above — chunked tables in the
            // template already keep this well under the default 512M limit. Rendering
            // ~1000 rows can take upwards of 30s, so also guard against a stricter
            // hosting default for max_execution_time than this project's local php.ini.
            ini_set('memory_limit', '768M');
            set_time_limit(120);

            $facilityName = $request->filled('facility_id')
                ? Facility::find($request->facility_id)?->name
                : null;

            // Embedded as a base64 data URI rather than a file:// or http:// <img src>
            // — dompdf resolves those against the server's remote-fetch settings, which
            // is fragile; a data URI always works regardless of that config.
            $logoPath = resource_path('images/logoCabs.png');
            $logoBase64 = is_file($logoPath)
                ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
                : null;

            // A unique control number stamped on every export so a printed copy can be
            // traced back to the run that produced it (date + time + a short random tag).
            $controlNumber = 'CABS-RPT-' . now()->format('Ymd-His') . '-' . strtoupper(Str::random(4));

            $pdf = Pdf::loadView('pdf.report', [
                'reservations'  => $reservations,
                'totalMatching' => $totalMatching,
                'truncated'     => $truncated,
                'totalRevenue'  => $totalRevenue,
                'paidCount'     => $paidCount,
                'generatedAt'   => now(),
                'controlNumber' => $controlNumber,
                'printedBy'     => $request->user()?->full_name ?? $request->user()?->name ?? 'System',
                'logoBase64'    => $logoBase64,
                'filters'       => [
                    'facility'       => $facilityName,
                    'status'         => $request->query('status'),
                    'payment_status' => $request->query('payment_status'),
                ],
            ])->setPaper('a4', 'landscape')->setOption('isPhpEnabled', true);

            return $pdf->download('cabs-report-' . now()->format('Ymd') . '.pdf');
        }

        return response()->json($query->paginate(25));
    }

    /**
     * A summarized, non-itemized financial report — aggregated revenue by facility,
     * payment method, and month. Deliberately carries no client names or per-reservation
     * rows; it's a management-facing money summary, not a reservation log (see reports()
     * above for the itemized version).
     */
    public function financialReport(Request $request)
    {
        ini_set('memory_limit', '768M');
        set_time_limit(120);

        $query = Reservation::with(['facility', 'payment'])
            ->when($request->filled('date_from'),   fn($q) => $q->where('reservation_date', '>=', $request->date_from))
            ->when($request->filled('date_to'),     fn($q) => $q->where('reservation_date', '<=', $request->date_to))
            ->when($request->filled('facility_id'), fn($q) => $q->where('facility_id', $request->facility_id));

        $reservations = $query->get();
        $paid = $reservations->filter(fn($r) => $r->payment && $r->payment->status === 'paid');

        $totalRevenue      = (float) $paid->sum(fn($r) => $r->payment->amount);
        $totalTransactions = $paid->count();
        $averageValue      = $totalTransactions > 0 ? $totalRevenue / $totalTransactions : 0;

        $byFacility = $paid->groupBy(fn($r) => $r->facility->name ?? 'Unknown')
            ->map(fn($group, $name) => [
                'facility' => $name,
                'count'    => $group->count(),
                'revenue'  => (float) $group->sum(fn($r) => $r->payment->amount),
            ])
            ->sortByDesc('revenue')
            ->values();

        // Friendly display labels for the raw payment_method codes stored on Payment —
        // otherwise the report shows technical values like "PAYMONGO_LINK" / "QR_PH".
        $methodLabels = [
            'gcash'         => 'GCash',
            'paymaya'       => 'Maya',
            'card'          => 'Card',
            'qr_ph'         => 'QR Ph',
            'paymongo_link' => 'Payment Link',
        ];

        $byMethod = $paid->groupBy(fn($r) => $r->payment->payment_method ?? 'unspecified')
            ->map(fn($group, $method) => [
                'method'  => $methodLabels[$method] ?? ucwords(str_replace('_', ' ', $method)),
                'count'   => $group->count(),
                'revenue' => (float) $group->sum(fn($r) => $r->payment->amount),
            ])
            ->sortByDesc('revenue')
            ->values();

        // Grouped by the sortable "Y-m" key, then relabeled to "Mon Year" for display —
        // grouping directly by the display label would sort alphabetically, not chronologically.
        $byMonth = $paid->groupBy(fn($r) => $r->payment->paid_at?->format('Y-m') ?? 'unknown')
            ->sortKeys()
            ->map(fn($group, $key) => [
                'month'   => $key === 'unknown' ? 'Unknown' : \Carbon\Carbon::createFromFormat('Y-m', $key)->format('M Y'),
                'count'   => $group->count(),
                'revenue' => (float) $group->sum(fn($r) => $r->payment->amount),
            ])
            ->values();

        $statusCounts = $reservations->countBy(fn($r) => $r->payment->status ?? 'no_payment');

        $facilityName = $request->filled('facility_id')
            ? Facility::find($request->facility_id)?->name
            : null;

        $logoPath = resource_path('images/logoCabs.png');
        $logoBase64 = is_file($logoPath)
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
            : null;

        $controlNumber = 'CABS-FIN-' . now()->format('Ymd-His') . '-' . strtoupper(Str::random(4));

        $pdf = Pdf::loadView('pdf.financial-report', [
            'generatedAt'       => now(),
            'controlNumber'     => $controlNumber,
            'printedBy'         => $request->user()?->full_name ?? $request->user()?->name ?? 'System',
            'logoBase64'        => $logoBase64,
            'totalRevenue'      => $totalRevenue,
            'totalTransactions' => $totalTransactions,
            'averageValue'      => $averageValue,
            'byFacility'        => $byFacility,
            'byMethod'          => $byMethod,
            'byMonth'           => $byMonth,
            'statusCounts'      => $statusCounts,
            'filters'           => [
                'date_from' => $request->query('date_from'),
                'date_to'   => $request->query('date_to'),
                'facility'  => $facilityName,
            ],
        ])->setPaper('a4', 'landscape')->setOption('isPhpEnabled', true);

        return $pdf->download('cabs-financial-report-' . now()->format('Ymd') . '.pdf');
    }
}
