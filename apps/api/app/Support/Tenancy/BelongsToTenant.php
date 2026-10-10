<?php

namespace App\Support\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Str;

trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope('tenant', new class implements Scope
        {
            public function apply(Builder $builder, Model $model): void
            {
                $tenantId = TenantContext::id();

                if ($tenantId !== null) {
                    $builder->where($model->getTable().'.tenant_id', $tenantId);
                }
            }
        });

        static::creating(function (Model $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }

            if (empty($model->tenant_id) && TenantContext::id() !== null) {
                $model->tenant_id = TenantContext::id();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
