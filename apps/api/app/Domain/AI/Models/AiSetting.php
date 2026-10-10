<?php

namespace App\Domain\AI\Models;

use App\Domain\Tenant\Models\Tenant;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'provider',
        'model',
        'temperature',
        'tools_enabled',
        'handoff_rules',
    ];

    protected function casts(): array
    {
        return [
            'temperature' => 'float',
            'tools_enabled' => 'array',
            'handoff_rules' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
