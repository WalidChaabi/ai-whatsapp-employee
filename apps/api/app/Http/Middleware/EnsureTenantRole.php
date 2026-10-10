<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantRole
{
    /**
     * Restrict a route to callers holding one of the given tenant roles.
     *
     * Must run after EnsureTenantAccess, which sets the `tenant_role` request
     * attribute this middleware checks.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! in_array($request->attributes->get('tenant_role'), $roles, true)) {
            return response()->json([
                'message' => 'You do not have permission to perform this action.',
                'code' => 'role_forbidden',
            ], 403);
        }

        return $next($request);
    }
}
