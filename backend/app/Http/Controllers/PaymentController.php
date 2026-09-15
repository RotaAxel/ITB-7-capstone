<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Reservation;
use App\Services\NotificationService;
use App\Services\PayMongoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function __construct(private PayMongoService $payMongo) {}

    // ─── "Book" reservations pay immediately and auto-confirm on payment.
    //     "Reserve" requests must be approved by an admin first — payment only
    //     opens up once the reservation reaches 'approved'. ─────────────────────
    private function paymentNotYetAllowedMessage(Reservation $reservation): ?string
    {
        if ($reservation->type === 'book') {
            return $reservation->status === 'pending'
                ? null
                : 'This reservation is no longer awaiting payment.';
        }

        return match ($reservation->status) {
            'pending' => 'This reservation must be approved by an admin before you can proceed to payment.',
            'approved' => null,
            default => 'This reservation is no longer awaiting payment.',
        };
    }

    // ─── Admin: List all payments ─────────────────────────────────────────────

    public function adminIndex(Request $request)
    {
        $query = Payment::with(['reservation.user', 'reservation.facility'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($inner) use ($search) {
                    $inner->where('receipt_number', 'like', "%{$search}%")
                        ->orWhereHas('reservation.user', function ($u) use ($search) {
                            $u->where('full_name', 'like', "%{$search}%")
                              ->orWhere('email', 'like', "%{$search}%");
                        })
                        ->orWhereHas('reservation.facility', fn($f) => $f->where('name', 'like', "%{$search}%"));
                });
            })
            ->orderByDesc('created_at');

        $paginated = $query->paginate(20);

        // Stat-card totals — always reflect the whole table, independent of the
        // current page/status filter/search, so they don't collapse to whatever
        // happens to be on the current page (only ~1.5% of payments at a time).
        $counts = [
            'total_collected' => (float) Payment::where('status', 'paid')->sum('amount'),
            'paid'             => Payment::where('status', 'paid')->count(),
            'pending'          => Payment::where('status', 'pending')->count(),
            'failed'           => Payment::where('status', 'failed')->count(),
            'cancelled'        => Payment::where('status', 'cancelled')->count(),
            'rejected'         => Payment::where('status', 'rejected')->count(),
        ];

        return response()->json([
            ...$paginated->toArray(),
            'counts' => $counts,
        ]);
    }

    // ─── Payment Link: Create a hosted checkout link ─────────────────────────

    public function createLink(Request $request, $reservationId)
    {
        $user        = $request->user();
        $reservation = Reservation::with(['facility', 'payment'])->findOrFail($reservationId);

        if ($reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($blocked = $this->paymentNotYetAllowedMessage($reservation)) {
            return response()->json(['message' => $blocked], 422);
        }

        if (!$reservation->terms_acknowledged) {
            return response()->json(['message' => 'You must acknowledge the terms before payment.'], 422);
        }

        $payment = $reservation->payment;

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found.'], 422);
        }

        if ($payment->status === 'paid') {
            return response()->json(['message' => 'This reservation has already been paid.'], 422);
        }

        // Recalculate amount from facility price if stored amount is zero
        if ($payment->amount <= 0) {
            $facility = $reservation->facility;
            $start    = strtotime($reservation->reservation_date->format('Y-m-d') . ' ' . $reservation->start_time);
            $end      = strtotime($reservation->reservation_date->format('Y-m-d') . ' ' . $reservation->end_time);
            $hours    = max(1, ($end - $start) / 3600);
            $amount   = round($facility->price_per_hour * $hours, 2);

            if ($amount <= 0) {
                return response()->json(['message' => 'Facility has no price set. Please contact an administrator.'], 422);
            }

            $payment->update(['amount' => $amount]);
            $payment->refresh();
        }

        $description = "CABS Reservation #{$reservation->id} - {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')}";
        $amountCents = (int) round($payment->amount * 100);

        if ($amountCents < 100) {
            return response()->json(['message' => 'Payment amount is too small (minimum ₱1).'], 422);
        }

        $linkData = $this->payMongo->createPaymentLink($amountCents, $description);

        if (!isset($linkData['data']['id'])) {
            Log::error('PayMongo createPaymentLink failed', ['response' => $linkData]);
            $pmError = $linkData['errors'][0]['detail'] ?? 'Unknown PayMongo error.';
            return response()->json(['message' => "Payment gateway error: {$pmError}", 'details' => $linkData], 502);
        }

        $link        = $linkData['data'];
        $checkoutUrl = $link['url'];

        $payment->update([
            'paymongo_payment_intent_id' => $link['id'],
            'paymongo_checkout_url'      => $checkoutUrl,
            'status'                     => 'pending',
        ]);

        return response()->json([
            'checkout_url' => $checkoutUrl,
            'link_id'      => $link['id'],
            'amount'       => $payment->amount,
            'currency'     => $payment->currency,
        ]);
    }

    // ─── Step 1: Create payment intent ───────────────────────────────────────

    public function initiate(Request $request, $reservationId)
    {
        $user        = $request->user();
        $reservation = Reservation::with(['facility', 'payment'])->findOrFail($reservationId);

        if ($reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($blocked = $this->paymentNotYetAllowedMessage($reservation)) {
            return response()->json(['message' => $blocked], 422);
        }

        if (!$reservation->terms_acknowledged) {
            return response()->json(['message' => 'You must acknowledge the terms before payment.'], 422);
        }

        $payment = $reservation->payment;

        if (!$payment) {
            return response()->json(['message' => 'Payment record not found for this reservation.'], 422);
        }

        if ($payment->status === 'paid') {
            return response()->json(['message' => 'This reservation has already been paid.'], 422);
        }

        // Recalculate amount from facility price if stored amount is zero
        if ($payment->amount <= 0) {
            $facility = $reservation->facility;
            $start    = strtotime($reservation->reservation_date->format('Y-m-d') . ' ' . $reservation->start_time);
            $end      = strtotime($reservation->reservation_date->format('Y-m-d') . ' ' . $reservation->end_time);
            $hours    = max(1, ($end - $start) / 3600);
            $amount   = round($facility->price_per_hour * $hours, 2);

            if ($amount <= 0) {
                return response()->json(['message' => 'Facility has no price set. Please contact an administrator.'], 422);
            }

            $payment->update(['amount' => $amount]);
            $payment->refresh();
        }

        $description = "CABS Reservation #{$reservation->id} - {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')}";
        $amountCents = (int) round($payment->amount * 100);

        if ($amountCents < 100) {
            return response()->json(['message' => 'Payment amount is too small (minimum ₱1).'], 422);
        }

        $intentData = $this->payMongo->createPaymentIntent($amountCents, $description);

        if (!isset($intentData['data']['id'])) {
            Log::error('PayMongo createPaymentIntent failed', ['response' => $intentData]);
            $pmError = $intentData['errors'][0]['detail'] ?? 'Unknown PayMongo error.';
            return response()->json(['message' => "Payment gateway error: {$pmError}", 'details' => $intentData], 502);
        }

        $intent = $intentData['data'];

        $payment->update([
            'paymongo_payment_intent_id' => $intent['id'],
            'status'                     => 'pending',
        ]);

        return response()->json([
            'payment_intent_id' => $intent['id'],
            'client_key'        => $intent['attributes']['client_key'],
            'amount'            => $payment->amount,
            'currency'          => $payment->currency,
        ]);
    }

    // ─── Step 2: Select payment method + attach ───────────────────────────────

    public function selectMethod(Request $request, $reservationId)
    {
        $request->validate([
            'payment_method_type' => ['required', 'in:gcash,paymaya,dob,card'],
            'card_number'         => ['required_if:payment_method_type,card', 'nullable', 'string'],
            'exp_month'           => ['required_if:payment_method_type,card', 'nullable', 'integer', 'between:1,12'],
            'exp_year'            => ['required_if:payment_method_type,card', 'nullable', 'integer', 'min:2024'],
            'cvc'                 => ['required_if:payment_method_type,card', 'nullable', 'string', 'min:3', 'max:4'],
        ]);

        $user        = $request->user();
        $reservation = Reservation::with('payment')->findOrFail($reservationId);

        if ($reservation->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $payment = $reservation->payment;

        if (!$payment || !$payment->paymongo_payment_intent_id) {
            return response()->json(['message' => 'Payment intent not found. Please initiate payment first.'], 422);
        }

        // Build billing from the authenticated user so PayMongo always has it
        $billing = array_filter([
            'name'  => $user->full_name,
            'email' => $user->email,
            'phone' => $user->contact_number ?? null,
        ]);

        // Card details (only for card payments)
        $cardDetails = [];
        if ($request->payment_method_type === 'card') {
            $cardDetails = [
                'card_number' => preg_replace('/\s+/', '', $request->card_number),
                'exp_month'   => (int) $request->exp_month,
                'exp_year'    => (int) $request->exp_year,
                'cvc'         => $request->cvc,
            ];
        }

        // Create payment method
        $methodData = $this->payMongo->createPaymentMethod(
            $request->payment_method_type,
            $billing,
            $cardDetails
        );

        if (!isset($methodData['data']['id'])) {
            Log::error('PayMongo createPaymentMethod failed', ['response' => $methodData]);
            $pmError = $methodData['errors'][0]['detail'] ?? 'Unknown PayMongo error.';
            return response()->json(['message' => "Payment gateway error: {$pmError}", 'details' => $methodData], 502);
        }

        $methodId = $methodData['data']['id'];

        $returnUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173'))
            . "/payment/callback?reservation_id={$reservationId}";

        // Attach method to intent
        $attachData = $this->payMongo->attachPaymentMethod(
            $payment->paymongo_payment_intent_id,
            $methodId,
            $returnUrl
        );

        if (!isset($attachData['data'])) {
            Log::error('PayMongo attachPaymentMethod failed', ['response' => $attachData]);
            $pmError = $attachData['errors'][0]['detail'] ?? 'Unknown PayMongo error.';
            return response()->json(['message' => "Payment gateway error: {$pmError}", 'details' => $attachData], 502);
        }

        $intentAttrs = $attachData['data']['attributes'];
        $status      = $intentAttrs['status'];

        $payment->update(['paymongo_payment_method_id' => $methodId]);

        // Redirect required (GCash, Maya, etc.)
        if ($status === 'awaiting_next_action' && isset($intentAttrs['next_action']['redirect']['url'])) {
            $redirectUrl = $intentAttrs['next_action']['redirect']['url'];
            $payment->update(['paymongo_checkout_url' => $redirectUrl]);

            return response()->json([
                'status'       => 'redirect',
                'redirect_url' => $redirectUrl,
            ]);
        }

        // Succeeded immediately (rare — some cards)
        if ($status === 'succeeded') {
            $this->handleSuccess($payment, $attachData['data']);
            return response()->json(['status' => 'succeeded', 'payment' => $payment->fresh()]);
        }

        return response()->json(['status' => $status, 'message' => 'Awaiting payment.']);
    }

    // ─── Step 3: Callback after redirect ─────────────────────────────────────

    public function handleCallback($reservationId)
    {
        $reservation = Reservation::with(['payment', 'facility', 'user'])->findOrFail($reservationId);
        $payment     = $reservation->payment;

        if (!$payment || !$payment->paymongo_payment_intent_id) {
            return response()->json(['message' => 'No payment record found.'], 404);
        }

        $storedId = $payment->paymongo_payment_intent_id;

        // Payment Link flow (IDs start with "link_")
        if (str_starts_with($storedId, 'link_')) {
            $paymentsData = $this->payMongo->getPaymentLinkPayments($storedId);

            if (!isset($paymentsData['data'])) {
                return response()->json(['message' => 'Failed to retrieve payment link status.'], 502);
            }

            // Payment link entries use flat format: {payment_id, status, amount, ...}
            $paidEntry = collect($paymentsData['data'])
                ->first(fn($p) => ($p['status'] ?? '') === 'paid');

            if ($paidEntry && $payment->status !== 'paid') {
                $mockIntentData = [
                    'attributes' => [
                        'payments'             => [],
                        'payment_method_types' => ['paymongo_link'],
                    ],
                ];
                $this->handleSuccess($payment, $mockIntentData);
            } elseif ($payment->status !== 'paid') {
                $payment->update(['status' => 'pending']);
            }

            return response()->json([
                'status'      => $payment->fresh()->status,
                'reservation' => $reservation->fresh()->load(['facility', 'payment']),
            ]);
        }

        // Payment Intent flow (existing)
        $intentData = $this->payMongo->retrievePaymentIntent($storedId);

        if (!isset($intentData['data'])) {
            return response()->json(['message' => 'Failed to retrieve payment intent.'], 502);
        }

        $status = $intentData['data']['attributes']['status'];

        if ($status === 'succeeded' && $payment->status !== 'paid') {
            $this->handleSuccess($payment, $intentData['data']);
        } elseif (in_array($status, ['awaiting_payment_method', 'payment_error'])) {
            $payment->update(['status' => 'failed']);
        }

        return response()->json([
            'status'      => $payment->fresh()->status,
            'reservation' => $reservation->fresh()->load(['facility', 'payment']),
        ]);
    }

    // ─── Internal: Mark paid + confirm reservation ────────────────────────────

    public function handleSuccess(Payment $payment, array $intentData): void
    {
        $receiptNumber = 'CABS-' . now()->format('Y') . '-' . strtoupper(Str::random(6));

        $paymentMethod = $intentData['attributes']['payments'][0]['attributes']['source']['type']
            ?? $intentData['attributes']['payment_method_types'][0]
            ?? 'unknown';

        $payment->update([
            'status'         => 'paid',
            'paid_at'        => now(),
            'payment_method' => $paymentMethod,
            'receipt_number' => $receiptNumber,
        ]);

        $reservation = $payment->reservation->load(['user', 'facility']);

        if ($reservation->type === 'book') {
            // Instant booking: payment alone confirms the reservation, no staff approval needed.
            $reservation->update(['status' => 'confirmed']);

            NotificationService::notifyUser(
                $reservation->user,
                'payment_success',
                'Booking Confirmed',
                "Your payment of ₱{$payment->amount} for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} has been received. Receipt: {$receiptNumber}. Your booking is confirmed!",
                $reservation->id
            );

            NotificationService::notifyAdmins(
                'payment_received',
                'Booking Confirmed',
                "{$reservation->user->full_name} completed payment of ₱{$payment->amount} for {$reservation->facility->name}. Receipt: {$receiptNumber}. Booking confirmed automatically — no action needed.",
                $reservation->id
            );

            return;
        }

        // "Reserve" requests are already approved by staff by the time payment is
        // even allowed to start (see paymentNotYetAllowedMessage()) — so a
        // successful payment here confirms it outright, no second admin click.
        $reservation->update(['status' => 'confirmed']);

        NotificationService::notifyUser(
            $reservation->user,
            'payment_success',
            'Reservation Confirmed',
            "Your payment of ₱{$payment->amount} for {$reservation->facility->name} on {$reservation->reservation_date->format('M d, Y')} has been received. Receipt: {$receiptNumber}. Your reservation is confirmed!",
            $reservation->id
        );

        NotificationService::notifyAdmins(
            'payment_received',
            'Reservation Confirmed',
            "{$reservation->user->full_name} completed payment of ₱{$payment->amount} for {$reservation->facility->name}. Receipt: {$receiptNumber}. Reservation confirmed — no action needed.",
            $reservation->id
        );
    }
}
