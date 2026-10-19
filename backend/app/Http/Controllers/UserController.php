<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()
            ->when($request->filled('role'),   fn($q) => $q->where('role', $request->role))
            ->when($request->filled('search'), function ($q) use ($request) {
                $q->where(function ($inner) use ($request) {
                    $inner->where('full_name', 'like', "%{$request->search}%")
                          ->orWhere('email', 'like', "%{$request->search}%");
                });
            })
            ->orderByDesc('created_at');

        $paginated = $query->paginate(25);

        // Role breakdown for the stat cards — always reflects the whole table,
        // independent of the current page/filter/search, so it doesn't collapse
        // to whatever roles happen to appear on the current page.
        $counts = [
            'total'          => User::count(),
            'clients'        => User::where('role', 'client')->count(),
            'staff'          => User::where('role', 'staff')->count(),
            'administrators' => User::where('role', 'administrator')->count(),
        ];

        return response()->json([
            ...$paginated->toArray(),
            'counts' => $counts,
        ]);
    }

    public function store(Request $request)
    {
        // User management is staff-only now (see routes/api.php) — staff can
        // create client and staff accounts, but not administrator ones. There
        // is no administrator-reachable path left to this endpoint, so this is
        // the only gate needed.
        $validated = $request->validate([
            'full_name'      => ['required', 'string', 'max:255'],
            'email'          => ['required', 'email', 'unique:users,email'],
            'password'       => ['required', Password::min(8)],
            'role'           => ['required', 'in:client,staff'],
            'age'            => ['nullable', 'integer', 'min:1'],
            'gender'         => ['nullable', 'in:male,female,other'],
            'address'        => ['nullable', 'string'],
            'contact_number' => ['nullable', 'string', 'max:20'],
        ]);

        $user = User::create([
            ...$validated,
            'password'    => Hash::make($validated['password']),
            'is_verified' => true,
        ]);

        return response()->json($user, 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Same reasoning as destroy() below — staff (the only role that can
        // reach this endpoint now) can't touch an administrator account at all,
        // and can't promote anyone to one either.
        if ($user->isAdmin()) {
            return response()->json(['message' => 'Cannot edit an administrator account.'], 403);
        }

        $validated = $request->validate([
            'full_name'      => ['sometimes', 'string', 'max:255'],
            'email'          => ['sometimes', 'email', "unique:users,email,{$id}"],
            'role'           => ['sometimes', 'in:client,staff'],
            'age'            => ['nullable', 'integer', 'min:1'],
            'gender'         => ['nullable', 'in:male,female,other'],
            'address'        => ['nullable', 'string'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'is_verified'    => ['boolean'],
            'password'       => ['nullable', Password::min(8)],
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json($user->fresh());
    }

    public function verifyResidency(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', 'in:verified,rejected'],
            'note'   => ['nullable', 'string'],
        ]);

        if (!$user->residency_proof_path) {
            return response()->json(['message' => 'This user has not submitted a residency proof.'], 422);
        }

        $user->update([
            'residency_status'     => $validated['status'],
            'residency_admin_note' => $validated['note'] ?? null,
        ]);

        return response()->json($user->fresh());
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);

        if ($user->isAdmin()) {
            return response()->json(['message' => 'Cannot delete an administrator account.'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }
}
