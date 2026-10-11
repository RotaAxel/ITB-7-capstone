<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Official Receipt – {{ $payment->receipt_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        /* DejaVu Sans Mono (bundled with dompdf) instead of Courier New — the core
           PDF Courier font dompdf falls back to has no glyph for the peso sign (₱,
           U+20B1), which renders as "?". DejaVu Sans Mono covers it and is still
           monospace, so it keeps the till-receipt look. */
        body { font-family: 'DejaVu Sans Mono', monospace; font-size: 11px; color: #000; }

        .receipt { padding: 16px 14px; }

        .center { text-align: center; }
        .bold   { font-weight: bold; }
        .muted  { color: #444; }
        .small  { font-size: 9px; }

        .store-name { font-size: 22px; font-weight: bold; letter-spacing: 3px; }
        .store-line { font-size: 9.5px; margin-top: 2px; }

        .section-title { text-align: center; font-weight: bold; letter-spacing: 1.5px; font-size: 12px; margin: 8px 0; }

        .divider-solid  { border-top: 1.5px solid #000; margin: 8px 0; }
        .divider-dashed { border-top: 1px dashed #000; margin: 8px 0; }

        /* Label/value line — a table (not flex, which dompdf renders unreliably —
           it silently collapsed to two touching inline spans with no gap when this
           was flex) keeps the amount right-aligned regardless of how long the label
           or value text is. */
        table.row { width: 100%; border-collapse: collapse; margin: 2px 0; }
        table.row td { padding: 0; vertical-align: top; }
        table.row td.value { text-align: right; white-space: nowrap; padding-left: 8px; }

        .item-name { font-weight: bold; }
        .item-sub  { font-size: 9.5px; color: #444; margin-top: 1px; }

        .total-row { font-size: 14px; font-weight: bold; margin-top: 4px; }

        .status-paid {
            display: block; text-align: center; font-weight: bold; letter-spacing: 2px;
            border: 2px solid #000; padding: 3px 0; margin: 10px 0; font-size: 12px;
        }

        .footer { text-align: center; margin-top: 12px; }
        .footer .thanks { font-weight: bold; font-size: 11px; }
        .footer .fine-print { font-size: 8.5px; color: #444; margin-top: 6px; line-height: 1.4; }

        .barcode-text { text-align: center; font-size: 9px; letter-spacing: 4px; margin-top: 10px; }
    </style>
</head>
<body>
<div class="receipt">

    {{-- Store header --}}
    <div class="center store-name">CABS</div>
    <div class="center store-line">Cabuyao Athletes Basic School</div>
    <div class="center store-line">Cabuyao, Laguna, Philippines</div>

    <div class="divider-solid"></div>
    <div class="section-title">OFFICIAL RECEIPT</div>
    <div class="divider-solid"></div>

    <table class="row"><tr><td>No:</td><td class="value bold">{{ $payment->receipt_number }}</td></tr></table>
    <table class="row"><tr><td>Date:</td><td class="value">{{ $payment->paid_at->format('M d, Y g:i A') }}</td></tr></table>

    <div class="divider-dashed"></div>

    <div>Billed to:</div>
    <div class="bold">{{ $reservation->user->full_name }}</div>
    <div class="small muted">{{ $reservation->user->email }}</div>
    @if($reservation->user->contact_number)
        <div class="small muted">{{ $reservation->user->contact_number }}</div>
    @endif

    <div class="divider-dashed"></div>

    <div class="item-name">{{ $reservation->facility->name }}</div>
    @if($reservation->facility->location)
        <div class="item-sub">{{ $reservation->facility->location }}</div>
    @endif
    <div class="item-sub">
        {{ $reservation->reservation_date->format('M d, Y') }} &middot;
        {{ \Carbon\Carbon::createFromFormat('H:i:s', $reservation->start_time)->format('g:i A') }}
        &ndash;
        {{ \Carbon\Carbon::createFromFormat('H:i:s', $reservation->end_time)->format('g:i A') }}
    </div>
    <div class="item-sub">{{ $reservation->number_of_participants }} participant(s) &middot; {{ $reservation->purpose }}</div>

    @if(!empty($amenities))
        <div class="divider-dashed"></div>
        <div class="bold small">AMENITIES / MATERIALS</div>
        @foreach($amenities as $amenity)
            <table class="row small">
                <tr>
                    <td>{{ $amenity['quantity'] }}x {{ $amenity['name'] }}</td>
                    <td class="value">{{ $amenity['fee'] > 0 ? '+&#8369;' . number_format($amenity['fee'], 2) : '' }}</td>
                </tr>
            </table>
        @endforeach
    @endif

    <div class="divider-dashed"></div>

    <table class="row"><tr><td>Facility Rental{{ $residentRateApplied ? ' (Cabuyeño rate)' : '' }}</td><td class="value">&#8369;{{ number_format($facilitySubtotal, 2) }}</td></tr></table>
    @if($amenitiesFee > 0)
        <table class="row"><tr><td>Amenities / Materials</td><td class="value">&#8369;{{ number_format($amenitiesFee, 2) }}</td></tr></table>
    @endif
    <table class="row"><tr><td>Discount</td><td class="value">&#8369;0.00</td></tr></table>
    <div class="divider-solid"></div>
    <table class="row total-row"><tr><td>TOTAL PAID</td><td class="value">&#8369;{{ number_format($payment->amount, 2) }}</td></tr></table>

    <div class="divider-solid"></div>

    <table class="row"><tr><td>Payment Method:</td><td class="value">{{ strtoupper($payment->payment_method ?? '—') }}</td></tr></table>
    @if($payment->paymongo_payment_intent_id)
        <table class="row small"><tr><td>Ref:</td><td class="value">{{ $payment->paymongo_payment_intent_id }}</td></tr></table>
    @endif

    <div class="status-paid">PAID</div>

    <div class="barcode-text">*{{ $payment->receipt_number }}*</div>

    {{-- Condensed Terms & Conditions — the full numbered clauses shown and agreed
         to at booking time don't fit a narrow 80mm receipt, so this is the
         essential summary plus this specific facility's own restrictions/fees
         (see facilities.restrictions / excessive_mess_fee / damage_clearance_fee),
         not a replacement for the full terms. --}}
    <div class="divider-dashed"></div>
    <div class="bold small center">TERMS &amp; CONDITIONS</div>
    <div class="small" style="margin-top: 4px; line-height: 1.4;">
        No refunds once payment has been made. CABS / Cabuyao City Hall may cancel any
        reservation for maintenance, emergencies, or public need, with a full refund in
        that case. Users are liable for any damage caused to the facility or equipment.
        @if($reservation->facility->restrictions)
            <br><br><span class="bold">Restrictions:</span> {{ $reservation->facility->restrictions }}
        @endif
        @if($reservation->facility->excessive_mess_fee > 0 || $reservation->facility->damage_clearance_fee > 0)
            <br><br>
            @if($reservation->facility->excessive_mess_fee > 0)
                Excessive mess fee: &#8369;{{ number_format($reservation->facility->excessive_mess_fee, 2) }}.
            @endif
            @if($reservation->facility->damage_clearance_fee > 0)
                Damage/clearance fee: &#8369;{{ number_format($reservation->facility->damage_clearance_fee, 2) }}.
            @endif
            (Assessed after inspection, not charged upfront.)
        @endif
    </div>
    <div class="small muted" style="margin-top: 4px;">
        Full Terms &amp; Conditions were presented and agreed to at the time of booking.
    </div>

    <div class="footer">
        <div class="thanks">Thank you for booking with CABS!</div>
        <div class="fine-print">
            This is an official receipt issued by the Cabuyao Athletes Basic School (CABS)
            Online Reservation System. Please keep this receipt for your records.<br>
            For concerns, contact us at contact@cabs.edu.ph.<br><br>
            This receipt is system-generated and does not require a signature.
        </div>
    </div>

</div>
</body>
</html>
