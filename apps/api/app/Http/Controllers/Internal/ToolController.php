<?php

namespace App\Http\Controllers\Internal;

use App\Domain\AI\Models\ToolRun;
use App\Domain\Catalog\Models\Product;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\Knowledge\Models\KnowledgeArticle;
use App\Domain\WhatsApp\Models\WhatsappAccount;
use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ToolController extends Controller
{
    public function searchProducts(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string'],
            'q' => ['required', 'string', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
            'conversation_uuid' => ['nullable', 'uuid'],
        ]);

        $this->bindTenant($data['phone_number_id']);

        $started = microtime(true);
        $limit = $data['limit'] ?? 5;

        $products = Product::query()
            ->where('status', 'active')
            ->where(function ($q) use ($data) {
                $q->where('name', 'like', '%'.$data['q'].'%')
                    ->orWhere('sku', 'like', '%'.$data['q'].'%')
                    ->orWhere('description', 'like', '%'.$data['q'].'%');
            })
            ->limit($limit)
            ->get(['uuid', 'sku', 'name', 'description', 'price', 'currency', 'stock_qty']);

        $conversationId = null;
        if (! empty($data['conversation_uuid'])) {
            $conversationId = Conversation::query()
                ->where('uuid', $data['conversation_uuid'])
                ->value('id');
        }

        ToolRun::query()->create([
            'conversation_id' => $conversationId,
            'tool' => 'products.search',
            'input' => ['q' => $data['q'], 'limit' => $limit],
            'output' => ['count' => $products->count()],
            'latency_ms' => (int) ((microtime(true) - $started) * 1000),
        ]);

        return response()->json(['data' => $products]);
    }

    public function searchKnowledge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string'],
            'q' => ['required', 'string', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
            'conversation_uuid' => ['nullable', 'uuid'],
        ]);

        $this->bindTenant($data['phone_number_id']);

        $started = microtime(true);
        $limit = $data['limit'] ?? 5;

        $articles = KnowledgeArticle::query()
            ->where('status', 'active')
            ->where(function ($q) use ($data) {
                $q->where('title', 'like', '%'.$data['q'].'%')
                    ->orWhere('body', 'like', '%'.$data['q'].'%');
            })
            ->limit($limit)
            ->get(['uuid', 'title', 'body']);

        $conversationId = null;
        if (! empty($data['conversation_uuid'])) {
            $conversationId = Conversation::query()
                ->where('uuid', $data['conversation_uuid'])
                ->value('id');
        }

        ToolRun::query()->create([
            'conversation_id' => $conversationId,
            'tool' => 'knowledge.search',
            'input' => ['q' => $data['q'], 'limit' => $limit],
            'output' => ['count' => $articles->count()],
            'latency_ms' => (int) ((microtime(true) - $started) * 1000),
        ]);

        return response()->json(['data' => $articles]);
    }

    public function escalate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string'],
            'conversation_uuid' => ['required', 'uuid'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $this->bindTenant($data['phone_number_id']);

        $conversation = Conversation::query()
            ->where('uuid', $data['conversation_uuid'])
            ->firstOrFail();

        $escalation = $conversation->escalations()->create([
            'reason' => $data['reason'] ?? 'AI escalation',
            'status' => 'open',
        ]);

        $conversation->update([
            'status' => 'human',
            'ai_paused' => true,
        ]);

        ToolRun::query()->create([
            'conversation_id' => $conversation->id,
            'tool' => 'escalate',
            'input' => ['reason' => $data['reason'] ?? null],
            'output' => ['escalation_uuid' => $escalation->uuid],
        ]);

        return response()->json([
            'escalation_uuid' => $escalation->uuid,
            'ai_paused' => true,
        ], 201);
    }

    public function egress(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string'],
            'conversation_uuid' => ['required', 'uuid'],
            'wamid' => ['nullable', 'string'],
            'body' => ['required', 'string'],
            'type' => ['nullable', 'string'],
            'ai_meta' => ['nullable', 'array'],
        ]);

        $this->bindTenant($data['phone_number_id']);

        $conversation = Conversation::query()
            ->where('uuid', $data['conversation_uuid'])
            ->firstOrFail();

        if (! empty($data['wamid'])) {
            $dup = Message::query()->where('wamid', $data['wamid'])->exists();
            if ($dup) {
                return response()->json([
                    'message' => 'Duplicate outbound wamid.',
                    'code' => 'duplicate_wamid',
                ], 409);
            }
        }

        try {
            $message = Message::query()->create([
                'conversation_id' => $conversation->id,
                'direction' => 'outbound',
                'type' => $data['type'] ?? 'text',
                'body' => $data['body'],
                'wamid' => $data['wamid'] ?? null,
                'sender_type' => 'ai',
                'ai_meta' => $data['ai_meta'] ?? null,
            ]);
        } catch (QueryException $e) {
            if ((string) $e->getCode() !== '23000') {
                throw $e;
            }

            // Lost the race against a concurrent request carrying the same wamid.
            return response()->json([
                'message' => 'Duplicate outbound wamid.',
                'code' => 'duplicate_wamid',
            ], 409);
        }

        $conversation->update(['last_message_at' => now()]);

        return response()->json($message, 201);
    }

    public function health(): JsonResponse
    {
        return response()->json(['ok' => true]);
    }

    protected function bindTenant(string $phoneNumberId): void
    {
        $account = WhatsappAccount::query()
            ->withoutGlobalScopes()
            ->where('phone_number_id', $phoneNumberId)
            ->firstOrFail();

        TenantContext::set($account->tenant);
    }
}
