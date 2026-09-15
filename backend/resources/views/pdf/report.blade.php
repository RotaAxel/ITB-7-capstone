<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CABS Reservation Report – {{ $generatedAt->format('Y-m-d') }}</title>
    <style>
        /* NOTE: deliberately no top-level margin/padding reset here (no "* {...}",
           and not even a scoped "body { margin:0 }") — ANY rule setting margin or
           padding on html/body/table/tr/td etc. silently corrupts dompdf's @page
           margin box on every page after the first (reproduced and confirmed: even
           a bare "html, body { margin:0 }" reproduces it, leaving continuation
           pages with zero margin). Every element below that needs specific spacing
           sets it explicitly; dompdf's small built-in default UA spacing elsewhere
           is negligible next to the 1.5in page margin. */
        @page { margin: 1.5in; }
        /* DejaVu Sans (bundled with dompdf) instead of Arial/Helvetica — the core
           PDF Helvetica font dompdf falls back to has no glyph for the peso sign
           (₱, U+20B1), so it was rendering as "?". DejaVu Sans covers it. */
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1a1a1a; }

        /* Header — centered org block only. Control No./Generated/Printed By/Via
           moved down into the footer (see .footer-meta below) so the header stays
           clean and those details don't compete for attention. */
        .header { border-bottom: 3px solid #C0392B; padding-bottom: 14px; margin-bottom: 18px; text-align: center; }
        .header img.logo { height: 56px; }
        .header h1 { font-size: 36px; font-weight: 900; color: #C0392B; letter-spacing: 4px; line-height: 1; margin-top: 4px; }
        .header .org-name    { font-size: 12px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
        .header .org-address { font-size: 9.5px; color: #555; margin-top: 1px; }
        .header .badge {
            display: inline-block; background: #C0392B; color: #fff; font-size: 10px; font-weight: 700;
            padding: 4px 14px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px;
        }

        /* "Data" section heading above the table */
        h2.section-title { font-size: 15px; font-weight: 700; color: #1a1a1a; border-left: 4px solid #C0392B; padding-left: 10px; margin-bottom: 10px; }

        /* Filters summary (date range intentionally omitted — the Control No. /
           Generated date on the header already dates the document; the period
           covered is whatever the admin picked before exporting). */
        .filters { background: #FADBD8; border: 1px solid #f3c6c1; border-radius: 4px; padding: 8px 12px; margin-bottom: 16px; }
        .filters .title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #96281B; margin-bottom: 4px; }
        .filters .row span { display: inline-block; margin-right: 18px; font-size: 10px; color: #1C2833; }
        .filters .row span strong { color: #1a1a1a; }

        /* Table — one continuous table; dompdf repeats a <thead> at the top of every
           physical page it spans, so the header reappears on every page for free,
           with no manual chunking/page-break logic (an earlier version split this
           into several smaller tables to bound dompdf's memory use, but a chunk
           boundary landing a few rows into a page left the rest of that page
           blank — see AnalyticsController for the row-cap that replaced it). */
        table.report { width: 100%; border-collapse: collapse; }
        table.report thead tr { background: #C0392B; color: #fff; }
        table.report thead th { padding: 6px 8px; text-align: left; font-size: 9.5px; letter-spacing: 0.3px; text-transform: uppercase; }
        table.report tbody tr { border-bottom: 1px solid #f0f0f0; }
        table.report tbody td { padding: 5px 8px; font-size: 10px; vertical-align: top; }
        table.report tbody tr:nth-child(even) { background: #FBF3F2; }
        /* Closing totals row, at the very end of the table. */
        table.report tfoot td { padding: 7px 8px; font-size: 10px; font-weight: 700; border-top: 1.5px solid #C0392B; }

        /* Compressed to 5 columns — reservation date & time combined into one
           column, and the receipt number paired with its paid date into another. */
        .col-client   { width: 26%; }
        .col-facility { width: 20%; }
        .col-datetime { width: 22%; }
        .col-amount   { width: 14%; text-align: right; }
        .col-receipt  { width: 18%; }

        .email { display: block; font-size: 9px; color: #888; }
        .sub   { display: block; font-size: 9px; color: #888; margin-top: 1px; }
        .muted { color: #aaa; }

        /* Footer — Control No./Generated/Printed By/Via now live down here, in small
           muted text, rather than the header where they'd compete for attention. */
        .footer { margin-top: 18px; border-top: 1px solid #e5e7e9; padding-top: 10px; font-size: 9px; color: #888; text-align: center; }
        .footer strong { color: #C0392B; }
        .footer-meta { font-size: 8px; color: #aaa; margin-top: 6px; }
        .footer-meta span { margin: 0 8px; }
    </style>
</head>
<body>
<div class="page">

    {{-- Header — just the org identity; document metadata lives in the footer. --}}
    <div class="header">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="CABS" class="logo">
        @else
            <h1>CABS</h1>
        @endif
        <div class="org-name">Cabuyao Athletes Basic School</div>
        <div class="org-address">Cabuyao, Laguna, Philippines</div>
        <div class="badge">Reservation Report</div>
    </div>

    {{-- Filters applied --}}
    <div class="filters">
        <div class="title">Filters Applied</div>
        <div class="row">
            <span>Facility: <strong>{{ $filters['facility'] ?? 'All facilities' }}</strong></span>
            <span>Status: <strong>{{ $filters['status'] ?? 'All' }}</strong></span>
            <span>Payment: <strong>{{ $filters['payment_status'] ?? 'All' }}</strong></span>
        </div>
    </div>

    @if($truncated)
    <div class="filters" style="background:#FEF9E7; border-color:#fbe7a1;">
        <span style="font-size:10px; color:#78350f;">
            Showing the most recent <strong>{{ number_format($reservations->count()) }}</strong> of
            <strong>{{ number_format($totalMatching) }}</strong> matching records. Narrow the date range or
            filters above to export the remaining records.
        </span>
    </div>
    @endif

    <h2 class="section-title">Reservation Data</h2>

    {{-- Table — a single continuous table (not split into several smaller ones).
         dompdf repeats a <thead> at the top of every physical page a table spans,
         so this alone already gives a repeating header on every page; splitting it
         into chunks with forced page breaks (an earlier version of this template)
         actually made things worse — a chunk boundary landing a few rows into a
         page left the rest of that page blank, which read as the report being
         "cut off". A single table paginates naturally with no gaps. --}}
    <table class="report">
        <thead>
            <tr>
                <th class="col-client">Client</th>
                <th class="col-facility">Facility</th>
                <th class="col-datetime">Reservation Date &amp; Time</th>
                <th class="col-amount">Amount</th>
                <th class="col-receipt">Receipt No. / Paid</th>
            </tr>
        </thead>
        <tbody>
            @forelse($reservations as $r)
            <tr>
                <td class="col-client">
                    {{ $r->user->full_name ?? '—' }}
                    <span class="email">{{ $r->user->email ?? '' }}</span>
                </td>
                <td class="col-facility">{{ $r->facility->name ?? '—' }}</td>
                <td class="col-datetime">
                    {{ $r->reservation_date?->format('M d, Y') ?? '—' }}
                    <span class="sub">{{ substr($r->start_time, 0, 5) }} &ndash; {{ substr($r->end_time, 0, 5) }}</span>
                </td>
                @if($r->payment)
                    <td class="col-amount">&#8369;{{ number_format($r->payment->amount, 2) }}</td>
                    <td class="col-receipt">
                        @if($r->payment->status === 'paid')
                            {{ $r->payment->receipt_number ?? '—' }}
                            <span class="sub">Paid {{ $r->payment->paid_at?->format('M d, Y') }}</span>
                        @else
                            <span class="muted">{{ ucfirst($r->payment->status) }}</span>
                        @endif
                    </td>
                @else
                    <td class="col-amount muted">&mdash;</td>
                    <td class="col-receipt muted">Not paid</td>
                @endif
            </tr>
            @empty
            <tr><td colspan="5" style="text-align:center; padding: 16px; color:#888;">No records match the selected filters.</td></tr>
            @endforelse
        </tbody>
        @if($reservations->count() > 0)
        <tfoot>
            <tr>
                <td class="col-client">Total ({{ number_format($reservations->count()) }} shown)</td>
                <td class="col-facility"></td>
                <td class="col-datetime"></td>
                <td class="col-amount">&#8369;{{ number_format($totalRevenue, 2) }}</td>
                <td class="col-receipt">{{ number_format($paidCount) }} paid</td>
            </tr>
        </tfoot>
        @endif
    </table>

    <div class="footer">
        <strong>CABS Online Reservation, Booking &amp; Payment System</strong><br>
        This report is system-generated and reflects data at the time of generation.
        <div class="footer-meta">
            <span>Control No. {{ $controlNumber }}</span>
            <span>Generated {{ $generatedAt->format('M d, Y g:i A') }}</span>
            <span>Printed By {{ $printedBy }}</span>
            <span>Printed Via CABS System</span>
        </div>
    </div>

</div>

{{-- Page X of Y footer stamp on every page. Safe to enable dompdf's embedded-PHP
     here: every value in this document is rendered through Blade's auto-escaping
     ({{ }}), never {!! !!}, so nothing user-supplied can ever inject a literal
     <script type="text/php"> tag for this option to pick up. --}}
<script type="text/php">
if (isset($pdf)) {
    $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
    $pdf->page_text(760, 555, "Page {PAGE_NUM} of {PAGE_COUNT}", $font, 8, array(0.53, 0.53, 0.53));
}
</script>
</body>
</html>
