<?php

namespace App\Http\Middleware;

use App\Domain\Tenant\Models\Tenant;
use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantUuid = $request->header('X-Tenant-ID');

        if (! $tenantUuid) {
            return response()->json([
                'message' => 'X-Tenant-ID header is required.',
                'code' => 'tenant_required',
            ], 422);
        }

        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'code' => 'unauthenticated',
            ], 401);
        }

        $tenant = Tenant::query()->where('uuid', $tenantUuid)->first();

        if (! $tenant) {
            return response()->json([
                'message' => 'Tenant not found.',
                'code' => 'not_found',
            ], 404);
        }

        $membership = $user->tenants()
            ->where('tenants.id', $tenant->id)
            ->wherePivot('status', 'active')
            ->first();

        if (! $membership) {
            return response()->json([
                'message' => 'You do not have access to this tenant.',
                'code' => 'tenant_forbidden',
            ], 403);
        }

        if (in_array($tenant->status, ['suspended', 'cancelled'], true)) {
            return response()->json([
                'message' => 'Tenant is not active.',
                'code' => 'tenant_suspended',
            ], 403);
        }

        TenantContext::set($tenant);
        $request->attributes->set('tenant', $tenant);
        $request->attributes->set('tenant_role', $membership->pivot->role);

        return $next($request);
    }
}
