<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CABS Financial Report – {{ $generatedAt->format('Y-m-d') }}</title>
    <style>
        /* NOTE: deliberately no top-level margin/padding reset here (no "* {...}",
           and not even a scoped "body { margin:0 }") — ANY rule setting margin or
           padding on html/body/table/tr/td etc. silently corrupts dompdf's @page
           margin box on every page after the first (reproduced and confirmed on the
           reservation report — see pdf/report.blade.php). Every element below that
           needs specific spacing sets it explicitly instead. */
        @page { margin: 1.5in; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1a1a1a; }

        /* Header — just the org identity, matching the Reservation Report; Control
           No./Generated/Printed By/Via moved down into the footer (.footer-meta). */
        .header { border-bottom: 3px solid #C0392B; padding-bottom: 14px; margin-bottom: 18px; text-align: center; }
        .header img.logo { height: 56px; }
        .header h1 { font-size: 36px; font-weight: 900; color: #C0392B; letter-spacing: 4px; line-height: 1; margin-top: 4px; }
        .header .org-name    { font-size: 12px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
        .header .org-address { font-size: 9.5px; color: #555; margin-top: 1px; }
        .header .badge {
            display: inline-block; background: #C0392B; color: #fff; font-size: 10px; font-weight: 700;
            padding: 4px 14px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px;
        }

        h2.section-title { font-size: 15px; font-weight: 700; color: #1a1a1a; border-left: 4px solid #C0392B; padding-left: 10px; margin: 18px 0 10px; }
        h2.section-title:first-of-type { margin-top: 0; }

        .filters { background: #FADBD8; border: 1px solid #f3c6c1; border-radius: 4px; padding: 8px 12px; margin-bottom: 4px; }
        .filters .title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #96281B; margin-bottom: 4px; }
        .filters .row span { display: inline-block; margin-right: 18px; font-size: 10px; color: #1C2833; }
        .filters .row span strong { color: #1a1a1a; }

        table.summary { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        table.summary thead tr { background: #C0392B; color: #fff; }
        table.summary thead th { padding: 6px 8px; text-align: left; font-size: 9.5px; letter-spacing: 0.3px; text-transform: uppercase; }
        table.summary tbody tr { border-bottom: 1px solid #f0f0f0; }
        table.summary tbody td { padding: 5px 8px; font-size: 10px; vertical-align: top; }
        table.summary tbody tr:nth-child(even) { background: #FBF3F2; }
        table.summary tfoot td { padding: 6px 8px; font-size: 10px; font-weight: 700; border-top: 1.5px solid #C0392B; }
        table.summary tfoot .sub { display: block; font-size: 8px; font-weight: 400; color: #888; margin-top: 1px; }
        .col-name    { width: 46%; }
        .col-count   { width: 18%; text-align: right; }
        .col-revenue { width: 18%; text-align: right; }
        .col-share   { width: 18%; text-align: right; }

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
        <div class="badge">Financial Report</div>
    </div>

    {{-- Filters applied --}}
    <div class="filters">
        <div class="title">Coverage</div>
        <div class="row">
            <span>Date Range: <strong>{{ $filters['date_from'] ?? 'Any' }} &ndash; {{ $filters['date_to'] ?? 'Any' }}</strong></span>
            <span>Facility: <strong>{{ $filters['facility'] ?? 'All facilities' }}</strong></span>
        </div>
    </div>

    {{-- Revenue by Facility --}}
    <h2 class="section-title">Revenue by Facility</h2>
    <table class="summary">
        <thead>
            <tr>
                <th class="col-name">Facility</th>
                <th class="col-count">Transactions</th>
                <th class="col-revenue">Revenue</th>
                <th class="col-share">Share</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byFacility as $row)
            <tr>
                <td class="col-name">{{ $row['facility'] }}</td>
                <td class="col-count">{{ number_format($row['count']) }}</td>
                <td class="col-revenue">&#8369;{{ number_format($row['revenue'], 2) }}</td>
                <td class="col-share">{{ $totalRevenue > 0 ? number_format($row['revenue'] / $totalRevenue * 100, 1) : '0.0' }}%</td>
            </tr>
            @empty
            <tr><td colspan="4" style="text-align:center; padding:12px; color:#888;">No paid transactions in this period.</td></tr>
            @endforelse
        </tbody>
        @if($byFacility->count() > 0)
        <tfoot>
            <tr>
                <td class="col-name">
                    Total
                    <span class="sub">Avg. transaction &#8369;{{ number_format($averageValue, 2) }}</span>
                </td>
                <td class="col-count">{{ number_format($totalTransactions) }}</td>
                <td class="col-revenue">&#8369;{{ number_format($totalRevenue, 2) }}</td>
                <td class="col-share">100.0%</td>
            </tr>
        </tfoot>
        @endif
    </table>

    {{-- Revenue by Payment Method --}}
    <h2 class="section-title">Revenue by Payment Method</h2>
    <table class="summary">
        <thead>
            <tr>
                <th class="col-name">Method</th>
                <th class="col-count">Transactions</th>
                <th class="col-revenue">Revenue</th>
                <th class="col-share">Share</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byMethod as $row)
            <tr>
                <td class="col-name">{{ $row['method'] }}</td>
                <td class="col-count">{{ number_format($row['count']) }}</td>
                <td class="col-revenue">&#8369;{{ number_format($row['revenue'], 2) }}</td>
                <td class="col-share">{{ $totalRevenue > 0 ? number_format($row['revenue'] / $totalRevenue * 100, 1) : '0.0' }}%</td>
            </tr>
            @empty
            <tr><td colspan="4" style="text-align:center; padding:12px; color:#888;">No paid transactions in this period.</td></tr>
            @endforelse
        </tbody>
    </table>

    {{-- Revenue by Month --}}
    <h2 class="section-title">Revenue by Month</h2>
    <table class="summary">
        <thead>
            <tr>
                <th class="col-name">Month</th>
                <th class="col-count">Transactions</th>
                <th class="col-revenue">Revenue</th>
                <th class="col-share">Share</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byMonth as $row)
            <tr>
                <td class="col-name">{{ $row['month'] }}</td>
                <td class="col-count">{{ number_format($row['count']) }}</td>
                <td class="col-revenue">&#8369;{{ number_format($row['revenue'], 2) }}</td>
                <td class="col-share">{{ $totalRevenue > 0 ? number_format($row['revenue'] / $totalRevenue * 100, 1) : '0.0' }}%</td>
            </tr>
            @empty
            <tr><td colspan="4" style="text-align:center; padding:12px; color:#888;">No paid transactions in this period.</td></tr>
            @endforelse
        </tbody>
    </table>

    {{-- Reservation Status Breakdown --}}
    <h2 class="section-title">Reservation Status Breakdown</h2>
    <table class="summary">
        <thead>
            <tr>
                <th class="col-name">Payment Status</th>
                <th class="col-count" style="width:54%;">Reservations</th>
            </tr>
        </thead>
        <tbody>
            @forelse($statusCounts as $status => $count)
            <tr>
                <td class="col-name" style="text-transform:capitalize;">{{ str_replace('_', ' ', $status) }}</td>
                <td class="col-count" style="width:54%;">{{ number_format($count) }}</td>
            </tr>
            @empty
            <tr><td colspan="2" style="text-align:center; padding:12px; color:#888;">No reservations in this period.</td></tr>
            @endforelse
        </tbody>
        @if($statusCounts->count() > 0)
        <tfoot>
            <tr>
                <td class="col-name">Total</td>
                <td class="col-count" style="width:54%;">{{ number_format($statusCounts->sum()) }}</td>
            </tr>
        </tfoot>
        @endif
    </table>

    <div class="footer">
        <strong>CABS Online Reservation, Booking &amp; Payment System</strong><br>
        This is a summarized financial report and contains no individual client information.
        It is system-generated and reflects data at the time of generation.
        <div class="footer-meta">
            <span>Control No. {{ $controlNumber }}</span>
            <span>Generated {{ $generatedAt->format('M d, Y g:i A') }}</span>
            <span>Printed By {{ $printedBy }}</span>
            <span>Printed Via CABS System</span>
        </div>
    </div>

</div>

{{-- Page X of Y footer stamp on every page — see the comment in pdf/report.blade.php
     for why isPhpEnabled is safe here (everything in this document goes through
     Blade's auto-escaping). --}}
<script type="text/php">
if (isset($pdf)) {
    $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
    $pdf->page_text(760, 555, "Page {PAGE_NUM} of {PAGE_COUNT}", $font, 8, array(0.53, 0.53, 0.53));
}
</script>
</body>
</html>
