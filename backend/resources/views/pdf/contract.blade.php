<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CABS Contract of Agreement @if($groupId) – Group {{ $groupId }} @else – Reservation #{{ $first->id }} @endif</title>
    <style>
        /* NOTE: deliberately no top-level margin/padding reset here (see
           report.blade.php) — any rule setting margin/padding on html/body/table
           etc. silently corrupts dompdf's @page margin box on continuation pages. */
        @page { margin: 1in; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #1a1a1a; }

        .header { border-bottom: 3px solid #C0392B; padding-bottom: 14px; margin-bottom: 18px; }
        table.header-table { width: 100%; border-collapse: collapse; }
        table.header-table td { vertical-align: top; }
        .header-spacer { width: 24%; }
        .header-meta    { width: 24%; text-align: right; }
        .header-meta .label { text-transform: uppercase; letter-spacing: 0.4px; color: #96281B; font-weight: 700; font-size: 8px; }
        .header-meta .value { color: #1a1a1a; font-size: 9.5px; margin: 2px 0 8px; }
        .header-org { width: 52%; text-align: center; }
        .header-org img.logo { height: 52px; }
        .header-org h1 { font-size: 32px; font-weight: 900; color: #C0392B; letter-spacing: 4px; line-height: 1; margin-top: 4px; }
        .header-org .org-name    { font-size: 11px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
        .header-org .org-address { font-size: 9px; color: #555; margin-top: 1px; }
        .header-org .badge {
            display: inline-block; background: #C0392B; color: #fff; font-size: 9.5px; font-weight: 700;
            padding: 4px 14px; border-radius: 4px; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px;
        }

        h2.section-title { font-size: 13px; font-weight: 700; color: #1a1a1a; border-left: 4px solid #C0392B; padding-left: 10px; margin: 16px 0 10px; }

        .intro { font-size: 10px; line-height: 1.5; margin-bottom: 10px; }

        table.parties { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
        table.parties td { width: 50%; vertical-align: top; padding: 10px; border: 1px solid #e5e7e9; }
        table.parties td + td { border-left: none; }
        .party-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #96281B; margin-bottom: 4px; }
        .party-name  { font-size: 11px; font-weight: 700; }
        .party-line  { font-size: 9.5px; color: #333; margin-top: 2px; }

        table.details { width: 100%; border-collapse: collapse; }
        table.details td { padding: 4px 0; font-size: 10px; vertical-align: top; }
        table.details td.label { width: 32%; color: #666; }
        table.details td.value { font-weight: 600; }

        table.slots { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.slots thead tr { background: #C0392B; color: #fff; }
        table.slots thead th { padding: 5px 8px; text-align: left; font-size: 8.5px; letter-spacing: 0.3px; text-transform: uppercase; }
        table.slots tbody td { padding: 4px 8px; font-size: 9.5px; border-bottom: 1px solid #f0f0f0; }
        table.slots tfoot td { padding: 6px 8px; font-size: 10px; font-weight: 700; border-top: 1.5px solid #C0392B; }
        .col-amount { text-align: right; }

        .clause { margin-bottom: 8px; }
        .clause .heading { font-size: 10px; font-weight: 700; color: #1a1a1a; }
        .clause .body    { font-size: 9.5px; color: #333; line-height: 1.45; margin-top: 1px; }
        .clause.facility-specific .heading { color: #96281B; }

        .consent { margin-top: 14px; font-size: 9.5px; line-height: 1.5; background: #FADBD8; border: 1px solid #f3c6c1; border-radius: 4px; padding: 10px 12px; }

        table.signatures { width: 100%; border-collapse: collapse; margin-top: 26px; }
        table.signatures td { width: 50%; vertical-align: top; padding: 0 14px; }
        table.signatures td:first-child { padding-left: 0; }
        table.signatures td:last-child  { padding-right: 0; }
        .sig-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #96281B; margin-bottom: 28px; }
        .sig-line  { border-top: 1px solid #1a1a1a; padding-top: 4px; font-size: 9px; }
        .sig-field { margin-top: 14px; font-size: 9px; }
        .sig-field .fill { display: inline-block; border-bottom: 1px solid #999; min-width: 140px; }

        .footer { margin-top: 24px; border-top: 1px solid #e5e7e9; padding-top: 10px; font-size: 9px; color: #888; text-align: center; }
        .footer-meta { font-size: 8px; color: #aaa; margin-top: 6px; }
        .footer-meta span { margin: 0 8px; }
    </style>
</head>
<body>
<div class="page">

    {{-- Header --}}
    <div class="header">
        <table class="header-table">
            <tr>
                <td class="header-spacer"></td>
                <td class="header-org">
                    @if($logoBase64)
                        <img src="{{ $logoBase64 }}" alt="CABS" class="logo">
                    @else
                        <h1>CABS</h1>
                    @endif
                    <div class="org-name">Cabuyao Athletes Basic School</div>
                    <div class="org-address">Banaybanay, Cabuyao, Laguna, Philippines</div>
                    <div class="badge">Contract of Agreement &middot; Kontrata</div>
                </td>
                <td class="header-meta">
                    <div class="label">Control No.</div>
                    <div class="value">{{ $controlNumber }}</div>
                    <div class="label">Generated</div>
                    <div class="value">{{ $generatedAt->format('F d, Y g:i A') }}</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="intro">
        This Contract of Agreement ("Agreement") is made and entered into by and between the parties named
        below, governing the use of a CABS facility under the reservation(s) detailed in this document. By
        signing below, both parties agree to be bound by the Terms &amp; Conditions stated herein.
    </div>

    {{-- Parties --}}
    <table class="parties">
        <tr>
            <td>
                <div class="party-label">Party A &middot; Facility Owner</div>
                <div class="party-name">Cabuyao Athletes Basic School (CABS)</div>
                <div class="party-line">Banaybanay, Cabuyao, Laguna, Philippines</div>
                <div class="party-line">contact@cabs.edu.ph</div>
            </td>
            <td>
                <div class="party-label">Party B &middot; Client / Renter</div>
                <div class="party-name">{{ $first->user->full_name }}</div>
                <div class="party-line">{{ $first->user->email }}</div>
                @if($first->user->contact_number)
                    <div class="party-line">{{ $first->user->contact_number }}</div>
                @endif
                @if($first->user->address)
                    <div class="party-line">{{ $first->user->address }}</div>
                @endif
            </td>
        </tr>
    </table>

    {{-- Reservation Details --}}
    <h2 class="section-title">Reservation Details</h2>
    <table class="details">
        <tr><td class="label">Facility</td><td class="value">{{ $facility->name }}</td></tr>
        @if($facility->location)
            <tr><td class="label">Location</td><td class="value">{{ $facility->location }}</td></tr>
        @endif
        <tr><td class="label">Reservation Type</td><td class="value">{{ $first->type === 'book' ? 'Book (instant confirm)' : 'Reserve (requires approval)' }}</td></tr>
        <tr><td class="label">Purpose</td><td class="value">{{ $first->purpose }}</td></tr>
        @if($first->event_package)
            <tr><td class="label">Event Package</td><td class="value">{{ $first->event_package }}</td></tr>
        @endif
        <tr><td class="label">Participants</td><td class="value">{{ $first->number_of_participants }}</td></tr>
        @if(!empty($amenities))
            <tr>
                <td class="label">Amenities</td>
                <td class="value">
                    @foreach($amenities as $a)
                        {{ $a['is_quantifiable'] ? $a['requested_quantity'] . '&times; ' . $a['name'] : $a['name'] }}{{ !$loop->last ? ', ' : '' }}
                    @endforeach
                </td>
            </tr>
        @endif
    </table>

    <table class="slots">
        <thead>
            <tr>
                <th>Date</th>
                <th>Time</th>
                <th class="col-amount">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach($reservations as $r)
                <tr>
                    <td>{{ $r->reservation_date->format('F d, Y (l)') }}</td>
                    <td>
                        {{ \Carbon\Carbon::createFromFormat('H:i:s', $r->start_time)->format('g:i A') }}
                        &ndash;
                        {{ \Carbon\Carbon::createFromFormat('H:i:s', $r->end_time)->format('g:i A') }}
                    </td>
                    <td class="col-amount">&#8369;{{ number_format($r->payment->amount ?? 0, 2) }}</td>
                </tr>
            @endforeach
        </tbody>
        @if($reservations->count() > 1)
            <tfoot>
                <tr><td colspan="2">Total ({{ $reservations->count() }} dates)</td><td class="col-amount">&#8369;{{ number_format($totalAmount, 2) }}</td></tr>
            </tfoot>
        @endif
    </table>

    {{-- Terms & Conditions — mirrors termsFor()/facilityTermsFor() in
         NewReservationModal.jsx / NewReservation.jsx, the same clauses shown and
         digitally acknowledged at booking time. --}}
    <h2 class="section-title">Terms &amp; Conditions</h2>

    <div class="clause">
        <div class="heading">1. Reservation Policy</div>
        <div class="body">
            @if($first->type === 'book')
                All bookings are subject to availability. A "Book" reservation is confirmed automatically as soon as full payment is received — no staff approval is required.
            @else
                All reservations are subject to availability. A "Reserve" request must first be reviewed and approved by CABS administration. Payment is only required, and confirms it, once approved.
            @endif
        </div>
    </div>
    <div class="clause">
        <div class="heading">2. Payment</div>
        <div class="body">
            @if($first->type === 'book')
                Full payment is required to instantly confirm this booking. Accepted methods include GCash, Maya, and online banking.
            @else
                Once this reservation request is approved, full payment will be required to confirm it. Accepted methods include GCash, Maya, and online banking. Approved requests left unpaid for too long may be forfeited.
            @endif
        </div>
    </div>
    <div class="clause">
        <div class="heading">3. Cancellation &amp; Refund</div>
        <div class="body">Cancellations made before payment are free of charge. Once payment has been made, no refunds will be issued. CABS reserves the right to cancel any reservation for maintenance or emergency situations.</div>
    </div>
    <div class="clause">
        <div class="heading">4. Facility Use Rules</div>
        <div class="body">Users must maintain cleanliness and order within the facility. No food or beverages inside courts unless specified. Participants must wear appropriate athletic attire and footwear.</div>
    </div>
    <div class="clause">
        <div class="heading">5. Liability</div>
        <div class="body">CABS is not liable for any injury, loss, or damage incurred during the use of the facilities. Users are responsible for any damage caused to the facilities or equipment.</div>
    </div>
    <div class="clause">
        <div class="heading">6. Compliance</div>
        <div class="body">All users must comply with CABS rules and regulations. Non-compliance may result in immediate termination of the reservation without refund and may affect future booking privileges.</div>
    </div>
    <div class="clause">
        <div class="heading">7. City Hall Authority</div>
        <div class="body">CABS facilities are government property. The Cabuyao City Hall / local government may cancel or pre-empt any reservation at any time — for public events, emergencies, maintenance, or other administrative directives — even after approval or payment. Affected clients will be notified as soon as possible and are entitled to a full refund for any reservation cancelled on this basis.</div>
    </div>
    @if($first->number_of_participants >= 50)
        <div class="clause">
            <div class="heading">8. Crowd Management (Large Events)</div>
            <div class="body">
                For events with 50 or more participants, the client is solely responsible for providing adequate
                crowd management — entry/exit, crowd flow, and security — both during and after the event. The
                client confirmed this responsibility at booking time
                @if($first->crowd_management_confirmed) (confirmed). @else (not yet confirmed). @endif
                CABS does not provide crowd management services itself.
            </div>
        </div>
    @endif
    <div class="clause">
        <div class="heading">9. Waste Management</div>
        <div class="body">
            Regardless of event size, the client is solely responsible for providing adequate waste management
            and disposal, both during and after the event. The client confirmed this responsibility at booking
            time
            @if($first->waste_management_confirmed) (confirmed). @else (not yet confirmed). @endif
            CABS does not provide waste management services itself.
        </div>
    </div>

    @if($facility->requires_authorization_letter)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: Authorization Letter</div>
            <div class="body">A signed authorization letter (PDF or image) must be attached when reserving {{ $facility->name }}.</div>
        </div>
    @endif
    @if($facility->requires_request_letter)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: Request Letter</div>
            <div class="body">A formal request letter (PDF or image) addressed to CABS/City Hall must be attached when reserving {{ $facility->name }}.</div>
        </div>
    @endif
    @if($facility->what_to_bring)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: What to Bring</div>
            <div class="body">{{ $facility->what_to_bring }}</div>
        </div>
    @endif
    @if($facility->restrictions)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: Restrictions</div>
            <div class="body">{{ $facility->restrictions }}</div>
        </div>
    @endif
    @if($facility->additional_terms)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: Additional Terms</div>
            <div class="body">{{ $facility->additional_terms }}</div>
        </div>
    @endif
    @if($facility->excessive_mess_fee > 0 || $facility->damage_clearance_fee > 0)
        <div class="clause facility-specific">
            <div class="heading">Facility-Specific: Cleanliness &amp; Damage Fees</div>
            <div class="body">
                Following a post-event inspection,
                @if($facility->excessive_mess_fee > 0) an excessive mess fee of &#8369;{{ number_format($facility->excessive_mess_fee, 0) }} @endif
                @if($facility->excessive_mess_fee > 0 && $facility->damage_clearance_fee > 0) and/or @endif
                @if($facility->damage_clearance_fee > 0) a damage/clearance fee of &#8369;{{ number_format($facility->damage_clearance_fee, 0) }} @endif
                may be charged if applicable. This is not collected upfront and only applies if the facility is left excessively messy or damaged.
            </div>
        </div>
    @endif

    <div class="consent">
        By signing below, both parties acknowledge that they have read, understood, and freely agree to be
        bound by all the Terms &amp; Conditions stated in this Agreement, including the facility-specific
        rules listed above where applicable.
    </div>

    {{-- Signatures --}}
    <table class="signatures">
        <tr>
            <td>
                <div class="sig-label">Party B &middot; Client / Renter</div>
                <div class="sig-line">Signature over Printed Name</div>
                <div class="sig-field">Printed Name: <span class="fill">{{ $first->user->full_name }}</span></div>
                <div class="sig-field">Date: <span class="fill">&nbsp;</span></div>
            </td>
            <td>
                <div class="sig-label">Party A &middot; CABS Representative</div>
                <div class="sig-line">Signature over Printed Name</div>
                <div class="sig-field">Printed Name: <span class="fill">&nbsp;</span></div>
                <div class="sig-field">Position: <span class="fill">&nbsp;</span></div>
                <div class="sig-field">Date: <span class="fill">&nbsp;</span></div>
            </td>
        </tr>
    </table>

    <div class="footer">
        This Contract of Agreement was generated by the CABS Online Reservation System for
        @if($groupId) reservation group <strong>{{ $groupId }}</strong> @else reservation <strong>#{{ $first->id }}</strong> @endif.
        Print, sign, and keep a copy on file for both parties.
        <div class="footer-meta">
            <span>Control No. {{ $controlNumber }}</span>
            <span>Generated {{ $generatedAt->format('F d, Y g:i A') }}</span>
        </div>
    </div>

</div>
</body>
</html>
