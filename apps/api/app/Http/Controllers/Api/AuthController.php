<?php

namespace App\Http\Controllers\Api;

use App\Domain\Tenant\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'company_name' => ['required', 'string', 'max:160'],
        ]);

        [$user, $tenant, $token] = DB::transaction(function () use ($data) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);

            $slugBase = Str::slug($data['company_name']);
            $slug = $slugBase;
            $i = 1;
            while (Tenant::query()->where('slug', $slug)->exists()) {
                $slug = $slugBase.'-'.$i++;
            }

            $tenant = Tenant::query()->create([
                'name' => $data['company_name'],
                'slug' => $slug,
                'status' => 'trialing',
            ]);

            $tenant->users()->attach($user->id, [
                'role' => 'owner',
                'status' => 'active',
            ]);

            $tenant->aiSettings()->create([
                'provider' => 'openai',
                'model' => 'gpt-4.1-mini',
                'temperature' => 0.3,
                'tools_enabled' => ['products.search', 'knowledge.search', 'escalate'],
            ]);

            $token = $user->createToken('dashboard')->plainTextToken;

            return [$user, $tenant, $token];
        });

        return response()->json([
            'token' => $token,
            'user' => $user,
            'tenant' => $tenant,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
                'code' => 'unauthenticated',
            ], 401);
        }

        $token = $user->createToken('dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'tenants' => $user->tenants,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('tenants');

        return response()->json([
            'user' => $user,
            'memberships' => $user->tenants,
        ]);
    }
}
