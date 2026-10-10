<?php

namespace App\Http\Controllers\Internal;

use App\Domain\AI\Models\AiPrompt;
use App\Domain\AI\Models\ToolRun;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\CRM\Models\Customer;
use App\Domain\WhatsApp\Models\WhatsappAccount;
use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IngressController extends Controller
{
    public function message(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string'],
            'wamid' => ['required', 'string'],
            'from_wa_id' => ['required', 'string'],
            'type' => ['required', 'string'],
            'text' => ['nullable', 'string'],
            'timestamp' => ['nullable', 'string'],
            'raw_payload' => ['nullable', 'array'],
        ]);

        $account = WhatsappAccount::query()
            ->withoutGlobalScopes()
            ->where('phone_number_id', $data['phone_number_id'])
            ->first();

        if (! $account) {
            return response()->json([
                'message' => 'WhatsApp account not found.',
                'code' => 'not_found',
            ], 404);
        }

        TenantContext::set($account->tenant);

        $existing = Message::query()
            ->where('wamid', $data['wamid'])
            ->first();

        if ($existing) {
            return $this->duplicateResponse($existing);
        }

        try {
            $pack = DB::transaction(function () use ($data, $account) {
                $customer = Customer::query()->firstOrCreate(
                    ['wa_id' => $data['from_wa_id']],
                    ['phone' => $data['from_wa_id']]
                );

                $conversation = Conversation::query()
                    ->where('customer_id', $customer->id)
                    ->whereIn('status', ['bot', 'human'])
                    ->latest('last_message_at')
                    ->first();

                if (! $conversation) {
                    $conversation = Conversation::query()->create([
                        'customer_id' => $customer->id,
                        'status' => 'bot',
                        'ai_paused' => false,
                        'last_message_at' => now(),
                    ]);
                }

                Message::query()->create([
                    'conversation_id' => $conversation->id,
                    'direction' => 'inbound',
                    'type' => $data['type'],
                    'body' => $data['text'] ?? null,
                    'wamid' => $data['wamid'],
                    'sender_type' => 'customer',
                ]);

                $conversation->update(['last_message_at' => now()]);

                $settings = $account->tenant->aiSettings;
                $prompt = AiPrompt::query()
                    ->where('key', 'system')
                    ->where('is_active', true)
                    ->latest('version')
                    ->first();

                $recent = $conversation->messages()
                    ->orderByDesc('created_at')
                    ->limit(20)
                    ->get()
                    ->sortBy('created_at')
                    ->values()
                    ->map(fn (Message $m) => [
                        'direction' => $m->direction,
                        'sender_type' => $m->sender_type,
                        'type' => $m->type,
                        'body' => $m->body,
                    ]);

                return [
                    'tenant_uuid' => $account->tenant->uuid,
                    'conversation_uuid' => $conversation->uuid,
                    'ai_paused' => $conversation->ai_paused,
                    'model' => $settings?->model ?? 'gpt-4.1-mini',
                    'provider' => $settings?->provider ?? 'openai',
                    'system_prompt' => $prompt?->content ?? 'You are a helpful WhatsApp sales and support assistant.',
                    'tools' => $settings?->tools_enabled ?? ['products.search', 'knowledge.search', 'escalate'],
                    'customer' => [
                        'uuid' => $customer->uuid,
                        'name' => $customer->name,
                        'wa_id' => $customer->wa_id,
                    ],
                    'recent_messages' => $recent,
                ];
            });
        } catch (QueryException $e) {
            if ((string) $e->getCode() !== '23000') {
                throw $e;
            }

            // Lost the race against a concurrent delivery of the same wamid
            // (e.g. an n8n webhook retry) — treat it the same as the
            // pre-insert duplicate check above.
            $existing = Message::query()->where('wamid', $data['wamid'])->first();

            return $existing
                ? $this->duplicateResponse($existing)
                : response()->json(['message' => 'Duplicate message.', 'code' => 'duplicate_wamid'], 409);
        }

        return response()->json($pack);
    }

    private function duplicateResponse(Message $existing): JsonResponse
    {
        return response()->json([
            'message' => 'Duplicate message.',
            'code' => 'duplicate_wamid',
            'conversation_uuid' => $existing->conversation->uuid,
            'ai_paused' => $existing->conversation->ai_paused,
        ], 409);
    }
}
