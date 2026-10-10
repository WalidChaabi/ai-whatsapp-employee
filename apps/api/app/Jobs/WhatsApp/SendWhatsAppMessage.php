<?php

namespace App\Jobs\WhatsApp;

use App\Domain\Chat\Models\Message;
use App\Services\WhatsApp\WhatsAppCloudClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendWhatsAppMessage implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public int $messageId)
    {
        $this->onQueue('whatsapp');
    }

    public function backoff(): array
    {
        return [10, 30, 60, 300];
    }

    public function handle(WhatsAppCloudClient $client): void
    {
        $message = Message::query()
            ->withoutGlobalScopes()
            ->with(['conversation.customer', 'conversation.tenant.whatsappAccounts'])
            ->find($this->messageId);

        if (! $message || $message->direction !== 'outbound') {
            return;
        }

        $client->sendText($message);
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('whatsapp.send.job_failed', [
            'message_id' => $this->messageId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
