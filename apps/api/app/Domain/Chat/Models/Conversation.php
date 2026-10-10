<?php

namespace App\Domain\Chat\Models;

use App\Domain\CRM\Models\Customer;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conversation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'uuid',
        'tenant_id',
        'customer_id',
        'status',
        'assigned_user_id',
        'ai_paused',
        'last_message_at',
        'operator_last_read_at',
    ];

    protected $appends = [
        'unread',
    ];

    protected function casts(): array
    {
        return [
            'ai_paused' => 'boolean',
            'last_message_at' => 'datetime',
            'operator_last_read_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    public function escalations(): HasMany
    {
        return $this->hasMany(Escalation::class);
    }

    public function getUnreadAttribute(): bool
    {
        return $this->isUnread();
    }

    public function isUnread(): bool
    {
        $latest = $this->relationLoaded('latestMessage')
            ? $this->latestMessage
            : $this->latestMessage()->first();

        if (! $latest || $latest->direction !== 'inbound') {
            return false;
        }

        if ($this->operator_last_read_at === null) {
            return true;
        }

        if ($this->last_message_at === null) {
            return false;
        }

        return $this->last_message_at->gt($this->operator_last_read_at);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query
            ->where(function (Builder $inner) {
                $inner->whereNull('operator_last_read_at')
                    ->orWhereColumn('last_message_at', '>', 'operator_last_read_at');
            })
            ->whereHas('latestMessage', fn (Builder $message) => $message->where('direction', 'inbound'));
    }

    public function markRead(): void
    {
        $this->update(['operator_last_read_at' => now()]);
    }
}
