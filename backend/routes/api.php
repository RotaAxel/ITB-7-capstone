<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CalendarController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\ReservationController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WebhookController;
use App\Http\Controllers\ReceiptController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/auth/register',                 [AuthController::class, 'register']);
    Route::post('/auth/login',                     [AuthController::class, 'login']);
    Route::post('/auth/verify-email',              [AuthController::class, 'verifyEmail']);
    Route::post('/auth/resend-verification-code',  [AuthController::class, 'resendVerificationCode']);
    Route::post('/auth/forgot-password',            [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password',             [AuthController::class, 'resetPassword']);
});

// Public facility browsing (no auth required — for guest page)
Route::get('/public/facilities',      [FacilityController::class, 'index']);
Route::get('/public/facilities/{id}', [FacilityController::class, 'show']);

// PayMongo webhook (no auth — signature verified internally)
Route::post('/webhooks/paymongo', [WebhookController::class, 'handlePayMongo']);

// Authenticated routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout',    [AuthController::class, 'logout']);
    Route::get('/auth/user',       [AuthController::class, 'user']);
    Route::put('/auth/profile',    [AuthController::class, 'updateProfile']);
    Route::put('/auth/password',   [AuthController::class, 'changePassword']);

    // Facilities (read only for authenticated users)
    Route::get('/facilities',                         [FacilityController::class, 'index']);
    Route::get('/facilities/{id}',                    [FacilityController::class, 'show']);
    Route::get('/facilities/{id}/availability',       [FacilityController::class, 'getAvailability']);

    // Reservations
    Route::get('/reservations',                               [ReservationController::class, 'index']);
    // Reserving/booking a facility is a client action — staff/admin "handle"
    // reservations (approve/reject/complete below), they don't create their own.
    // Kept as the one client-only exception in this shared group rather than
    // splitting the whole group, since everything else here (viewing,
    // acknowledging terms, downloading a letter) is already ownership-checked
    // in the controller and legitimately shared with staff/admin.
    Route::post('/reservations', [ReservationController::class, 'store'])->middleware('role:client');
    Route::get('/reservations/{id}',                          [ReservationController::class, 'show']);
    Route::delete('/reservations/{id}',                       [ReservationController::class, 'destroy']);
    // Cancelling is the client's own call — see ReservationController::cancel(),
    // which now rejects any non-owning caller, staff/admin included.
    Route::post('/reservations/{id}/cancel',                  [ReservationController::class, 'cancel']);
    Route::post('/reservations/{id}/acknowledge-terms',       [ReservationController::class, 'acknowledgeTerms']);
    Route::get('/reservations/{id}/authorization-letter',     [ReservationController::class, 'downloadAuthorizationLetter']);

    // Payments
    Route::post('/payments/{reservationId}/create-link',      [PaymentController::class, 'createLink']);
    Route::post('/payments/{reservationId}/initiate',         [PaymentController::class, 'initiate']);
    Route::post('/payments/{reservationId}/select-method',    [PaymentController::class, 'selectMethod']);
    Route::get('/payments/{reservationId}/status',            [PaymentController::class, 'handleCallback']);

    // Notifications (read-all must come before {id}/read to avoid route collision)
    Route::get('/notifications',                    [NotificationController::class, 'index']);
    Route::put('/notifications/read-all',           [NotificationController::class, 'markAllRead']);
    Route::put('/notifications/{id}/read',          [NotificationController::class, 'markRead']);

    // Receipts
    Route::get('/receipts/{reservationId}',         [ReceiptController::class, 'download']);

    // Calendar
    Route::get('/calendar/events',                  [CalendarController::class, 'events']);

    // Staff + Admin routes
    Route::middleware('role:staff,administrator')->group(function () {
        Route::get('/admin/reservations',                         [ReservationController::class, 'adminIndex']);
        Route::put('/admin/reservations/{id}/approve',            [ReservationController::class, 'approve']);
        Route::put('/admin/reservations/{id}/reject',             [ReservationController::class, 'reject']);
        Route::put('/admin/reservations/{id}/complete',           [ReservationController::class, 'complete']);
    });

    // Admin only routes
    Route::middleware('role:administrator')->group(function () {
        // Payments
        Route::get('/admin/payments',                             [PaymentController::class, 'adminIndex']);

        // Facility management
        Route::post('/admin/facilities',                          [FacilityController::class, 'store']);
        Route::put('/admin/facilities/{id}',                      [FacilityController::class, 'update']);
        Route::delete('/admin/facilities/{id}',                   [FacilityController::class, 'destroy']);
        Route::post('/admin/facilities/{id}/maintenance',         [FacilityController::class, 'updateMaintenance']);

        // Amenity management
        Route::post('/admin/amenities',                           [FacilityController::class, 'storeAmenity']);
        Route::put('/admin/amenities/{id}',                       [FacilityController::class, 'updateAmenity']);
        Route::delete('/admin/amenities/{id}',                    [FacilityController::class, 'destroyAmenity']);

        // User management
        Route::get('/admin/users',                                [UserController::class, 'index']);
        Route::post('/admin/users',                               [UserController::class, 'store']);
        Route::put('/admin/users/{id}',                           [UserController::class, 'update']);
        Route::delete('/admin/users/{id}',                        [UserController::class, 'destroy']);

        // Analytics
        Route::get('/admin/analytics/summary',                    [AnalyticsController::class, 'summary']);
        Route::get('/admin/analytics/revenue',                    [AnalyticsController::class, 'monthlyRevenue']);
        Route::get('/admin/analytics/utilization',                [AnalyticsController::class, 'facilityUtilization']);
        Route::get('/admin/analytics/trends',                     [AnalyticsController::class, 'bookingTrends']);
        Route::get('/admin/reports',                              [AnalyticsController::class, 'reports']);
        Route::get('/admin/reports/financial',                    [AnalyticsController::class, 'financialReport']);
    });
});
