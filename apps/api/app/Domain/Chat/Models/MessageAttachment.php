<?php

namespace App\Domain\Chat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class MessageAttachment extends Model
{
    protected $fillable = [
        'uuid',
        'message_id',
        'media_type',
        'storage_path',
        'extracted_text',
    ];

    protected static function booted(): void
    {
        static::creating(function (MessageAttachment $attachment): void {
            if (empty($attachment->uuid)) {
                $attachment->uuid = (string) Str::uuid();
            }
        });
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
