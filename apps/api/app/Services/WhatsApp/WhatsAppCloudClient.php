<?php

namespace App\Services\WhatsApp;

use App\Domain\Chat\Models\Message;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class WhatsAppCloudClient
{
    public function sendText(Message $message): void
    {
        $conversation = $message->conversation;
        $customer = $conversation?->customer;
        $account = $conversation?->tenant?->whatsappAccounts()
            ->where('status', 'connected')
            ->latest()
            ->first();

        if (! $customer?->wa_id || ! $account?->phone_number_id || ! $account->access_token_encrypted) {
            Log::warning('whatsapp.send.skipped', [
                'message_id' => $message->id,
                'reason' => 'missing_customer_or_account',
            ]);

            return;
        }

        $version = config('services.whatsapp.graph_version', 'v21.0');
        $url = sprintf(
            'https://graph.facebook.com/%s/%s/messages',
            $version,
            $account->phone_number_id
        );

        $response = Http::withToken($account->access_token_encrypted)
            ->acceptJson()
            ->timeout(10)
            ->connectTimeout(5)
            ->post($url, [
                'messaging_product' => 'whatsapp',
                'to' => $customer->wa_id,
                'type' => 'text',
                'text' => [
                    'preview_url' => false,
                    'body' => $message->body,
                ],
            ]);

        if (! $response->successful()) {
            Log::error('whatsapp.send.failed', [
                'message_id' => $message->id,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            throw new RuntimeException('WhatsApp Graph API send failed: '.$response->status());
        }

        $wamid = data_get($response->json(), 'messages.0.id');

        if ($wamid) {
            $message->update(['wamid' => $wamid]);
        }

        Log::info('whatsapp.send.ok', [
            'message_id' => $message->id,
            'wamid' => $wamid,
        ]);
    }
}
