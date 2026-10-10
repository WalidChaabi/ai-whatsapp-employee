<?php

namespace App\Http\Controllers\Api;

use App\Domain\Tenant\Models\Invitation;
use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TeamController extends Controller
{
    public function members(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $members = $tenant->users()
            ->orderByPivot('role')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->pivot->role,
                'status' => $user->pivot->status,
            ]);

        return response()->json([
            'data' => $members,
            'current_role' => $request->attributes->get('tenant_role'),
        ]);
    }

    public function invitations(Request $request): JsonResponse
    {
        $invites = Invitation::query()
            ->where('tenant_id', TenantContext::id())
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->get(['uuid', 'email', 'role', 'token', 'expires_at', 'created_at']);

        return response()->json(['data' => $invites]);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', 'in:owner,agent'],
        ]);

        $email = Str::lower($data['email']);
        $tenant = $request->attributes->get('tenant');

        $existingUser = User::query()->where('email', $email)->first();
        if ($existingUser && $tenant->users()->where('users.id', $existingUser->id)->exists()) {
            return response()->json([
                'message' => 'That user is already a member.',
                'code' => 'already_member',
            ], 422);
        }

        Invitation::query()
            ->where('tenant_id', $tenant->id)
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->delete();

        $invitation = Invitation::query()->create([
            'tenant_id' => $tenant->id,
            'email' => $email,
            'role' => $data['role'],
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json([
            'invitation' => $invitation->only(['uuid', 'email', 'role', 'token', 'expires_at']),
            'message' => 'Invitation created. Share the token with the teammate to accept after login.',
        ], 201);
    }

    public function cancelInvitation(Request $request, string $invitation): JsonResponse
    {
        $invite = Invitation::query()
            ->where('tenant_id', TenantContext::id())
            ->where('uuid', $invitation)
            ->whereNull('accepted_at')
            ->firstOrFail();

        $invite->delete();

        return response()->json(null, 204);
    }

    public function updateMember(Request $request, int $userId): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:owner,agent'],
        ]);

        $tenant = $request->attributes->get('tenant');
        $member = $tenant->users()->where('users.id', $userId)->first();

        if (! $member) {
            return response()->json(['message' => 'Member not found.', 'code' => 'not_found'], 404);
        }

        if ($member->pivot->role === 'owner' && $data['role'] !== 'owner') {
            $ownerCount = $tenant->users()->wherePivot('role', 'owner')->wherePivot('status', 'active')->count();
            if ($ownerCount <= 1) {
                return response()->json([
                    'message' => 'Cannot demote the last owner.',
                    'code' => 'last_owner',
                ], 422);
            }
        }

        $tenant->users()->updateExistingPivot($userId, ['role' => $data['role']]);

        return response()->json([
            'id' => $userId,
            'role' => $data['role'],
        ]);
    }

    public function removeMember(Request $request, int $userId): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $member = $tenant->users()->where('users.id', $userId)->first();

        if (! $member) {
            return response()->json(['message' => 'Member not found.', 'code' => 'not_found'], 404);
        }

        if ($userId === $request->user()->id) {
            return response()->json([
                'message' => 'You cannot remove yourself.',
                'code' => 'cannot_remove_self',
            ], 422);
        }

        if ($member->pivot->role === 'owner') {
            $ownerCount = $tenant->users()->wherePivot('role', 'owner')->wherePivot('status', 'active')->count();
            if ($ownerCount <= 1) {
                return response()->json([
                    'message' => 'Cannot remove the last owner.',
                    'code' => 'last_owner',
                ], 422);
            }
        }

        $tenant->users()->detach($userId);

        return response()->json(null, 204);
    }

    public function acceptInvite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);

        $invitation = Invitation::query()
            ->where('token', $data['token'])
            ->whereNull('accepted_at')
            ->first();

        if (! $invitation || $invitation->expires_at->isPast()) {
            return response()->json([
                'message' => 'Invitation is invalid or expired.',
                'code' => 'invalid_invite',
            ], 422);
        }

        $user = $request->user();
        if (Str::lower($user->email) !== Str::lower($invitation->email)) {
            return response()->json([
                'message' => 'This invitation was sent to a different email.',
                'code' => 'email_mismatch',
            ], 422);
        }

        $tenant = Tenant::query()->findOrFail($invitation->tenant_id);

        if ($tenant->users()->where('users.id', $user->id)->exists()) {
            $invitation->update(['accepted_at' => now()]);

            return response()->json([
                'message' => 'Already a member.',
                'tenant' => $tenant->only(['uuid', 'name', 'slug']),
            ]);
        }

        $tenant->users()->attach($user->id, [
            'role' => $invitation->role,
            'status' => 'active',
        ]);

        $invitation->update(['accepted_at' => now()]);

        return response()->json([
            'message' => 'Invitation accepted.',
            'tenant' => $tenant->only(['uuid', 'name', 'slug']),
            'role' => $invitation->role,
        ]);
    }
}
