<?php

namespace App\Http\Controllers;

use App\Mail\VerificationCodeMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

class AuthController extends Controller
{
    // How long a freshly-sent verification code stays valid before the client
    // must request a new one.
    private const VERIFICATION_CODE_TTL_MINUTES = 15;

    // Letters (incl. accented), spaces, and the handful of punctuation marks real
    // names use (O'Brien, dela Cruz, St. James) — no digits or other symbols.
    // Mirrors the frontend's NAME_REGEX in Register.jsx; kept here too since the
    // frontend check alone is trivially bypassable via a direct API call.
    private const NAME_REGEX = '/^[\pL\s\'.\-]+$/u';

    // A PH mobile number in "+63" + 10-digit local-part form (e.g. +639171234567).
    // The frontend only ever sends this shape (fixed "+63" prefix in the UI), but
    // validate the full pattern server-side rather than trusting that.
    private const PH_MOBILE_REGEX = '/^\+639\d{9}$/';

    /**
     * Same complexity bar everywhere a user sets their own password (register,
     * reset, change): 8+ characters, upper + lower case, a number, a symbol.
     */
    private function strongPassword(): PasswordRule
    {
        return PasswordRule::min(8)->mixedCase()->numbers()->symbols();
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'full_name'      => ['required', 'string', 'max:255', 'regex:' . self::NAME_REGEX],
            'email'          => ['required', 'email', 'unique:users,email'],
            'password'       => ['required', 'confirmed', $this->strongPassword()],
            'age'            => ['nullable', 'integer', 'min:1', 'max:150'],
            'gender'         => ['nullable', 'in:male,female,other'],
            'address'        => ['nullable', 'string'],
            'contact_number' => ['nullable', 'regex:' . self::PH_MOBILE_REGEX],
        ], [
            'full_name.regex'      => 'Full name may only contain letters.',
            'contact_number.regex' => 'Enter a valid PH mobile number.',
        ]);

        $user = User::create([
            'full_name'      => $validated['full_name'],
            'email'          => $validated['email'],
            'password'       => Hash::make($validated['password']),
            'age'            => $validated['age'] ?? null,
            'gender'         => $validated['gender'] ?? null,
            'address'        => $validated['address'] ?? null,
            'contact_number' => $validated['contact_number'] ?? null,
            'role'           => 'client',
            'is_verified'    => false,
        ]);

        $this->issueAndSendVerificationCode($user);

        // No token yet — the account isn't usable until the emailed code is confirmed
        // via verifyEmail() below.
        return response()->json([
            'message'             => 'Registration successful. Please check your email for a verification code.',
            'email'               => $user->email,
            'needs_verification'  => true,
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        $user = Auth::user();

        if (!$user->is_verified) {
            // Don't leave a session behind for an account that isn't allowed to use one yet.
            Auth::logout();

            // Refresh the code so a user who registered a while ago and comes back to
            // log in isn't stuck with a long-expired one.
            $this->issueAndSendVerificationCode($user);

            return response()->json([
                'message'            => 'Please verify your email before signing in. A new code has been sent.',
                'email'              => $user->email,
                'needs_verification' => true,
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'user'    => $user,
            'token'   => $token,
        ]);
    }

    public function verifyEmail(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'code'  => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            return response()->json(['message' => 'Account not found.'], 404);
        }

        if ($user->is_verified) {
            return response()->json(['message' => 'This account is already verified.'], 422);
        }

        if (!$user->verification_code || !hash_equals($user->verification_code, $validated['code'])) {
            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        if (!$user->verification_code_expires_at || $user->verification_code_expires_at->isPast()) {
            return response()->json(['message' => 'This code has expired. Please request a new one.'], 422);
        }

        $user->update([
            'is_verified'                  => true,
            'email_verified_at'            => now(),
            'verification_code'            => null,
            'verification_code_expires_at' => null,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Email verified successfully.',
            'user'    => $user,
            'token'   => $token,
        ]);
    }

    public function resendVerificationCode(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Same response whether or not the account exists, so this endpoint can't be
        // used to probe which emails are registered.
        if (!$user || $user->is_verified) {
            return response()->json(['message' => 'If that account needs verifying, a new code has been sent.']);
        }

        $this->issueAndSendVerificationCode($user);

        return response()->json(['message' => 'A new verification code has been sent.']);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Laravel's password broker already responds identically for a known vs.
        // unknown email (both resolve to Password::RESET_LINK_SENT / INVALID_USER
        // without revealing which), so the generic message below is safe either way.
        Password::sendResetLink($validated);

        return response()->json(['message' => 'If that email is registered, a password reset link has been sent.']);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'token'                 => ['required', 'string'],
            'email'                 => ['required', 'email'],
            'password'              => ['required', 'confirmed', $this->strongPassword()],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password) {
                $user->update(['password' => Hash::make($password)]);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset successfully. You can now sign in.']);
    }

    private function issueAndSendVerificationCode(User $user): void
    {
        $code = (string) random_int(100000, 999999);

        $user->update([
            'verification_code'            => $code,
            'verification_code_expires_at' => now()->addMinutes(self::VERIFICATION_CODE_TTL_MINUTES),
        ]);

        Mail::to($user->email)->send(new VerificationCodeMail($user));
    }

    public function updateProfile(Request $request)
    {
        $validated = $request->validate([
            'full_name'      => ['required', 'string', 'max:255'],
            'age'            => ['nullable', 'integer', 'min:1', 'max:150'],
            'gender'         => ['nullable', 'in:male,female,other'],
            'address'        => ['nullable', 'string'],
            'contact_number' => ['nullable', 'string', 'max:20'],
        ]);

        $user = $request->user();
        $user->update($validated);

        return response()->json($user);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => ['required'],
            'password'         => ['required', 'confirmed', $this->strongPassword()],
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }
}
