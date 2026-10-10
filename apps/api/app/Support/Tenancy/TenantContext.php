<?php

namespace App\Support\Tenancy;

use App\Domain\Tenant\Models\Tenant;

class TenantContext
{
    protected static ?Tenant $tenant = null;

    public static function set(?Tenant $tenant): void
    {
        static::$tenant = $tenant;
    }

    public static function get(): ?Tenant
    {
        return static::$tenant;
    }

    public static function id(): ?int
    {
        return static::$tenant?->id;
    }

    public static function uuid(): ?string
    {
        return static::$tenant?->uuid;
    }

    public static function clear(): void
    {
        static::$tenant = null;
    }

    public static function check(): bool
    {
        return static::$tenant !== null;
    }
}
