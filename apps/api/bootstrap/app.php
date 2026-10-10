<?php

use App\Http\Middleware\EnsureTenantAccess;
use App\Http\Middleware\EnsureTenantRole;
use App\Http\Middleware\VerifyN8nHmac;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::middleware('api')
                ->prefix('internal')
                ->group(base_path('routes/internal.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'tenant' => EnsureTenantAccess::class,
            'tenant.role' => EnsureTenantRole::class,
            'n8n.hmac' => VerifyN8nHmac::class,
        ]);

        // EnsureTenantAccess sets TenantContext, which the BelongsToTenant global
        // scope depends on. Without this, Laravel's default middleware priority
        // runs SubstituteBindings (implicit route-model binding) before this
        // middleware, so tenant-scoped models resolve with no tenant filter at
        // all — any authenticated user could bind another tenant's model by UUID.
        $middleware->prependToPriorityList(
            before: \Illuminate\Routing\Middleware\SubstituteBindings::class,
            prepend: EnsureTenantAccess::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
