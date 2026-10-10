<?php

namespace App\Domain\WhatsApp\Models;

use App\Domain\Tenant\Models\Tenant;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsappAccount extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'phone_number_id',
        'waba_id',
        'display_phone',
        'access_token_encrypted',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'access_token_encrypted' => 'encrypted',
            'meta' => 'array',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
