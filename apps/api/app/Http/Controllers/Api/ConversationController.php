<?php

namespace App\Http\Controllers\Api;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Http\Controllers\Controller;
use App\Jobs\WhatsApp\SendWhatsAppMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->string('status')->toString();
        $paused = $request->query('ai_paused');

        $conversations = Conversation::query()
            ->with([
                'customer',
                'assignedUser:id,name,email',
                'latestMessage',
            ])
            ->when($status === 'paused', fn ($q) => $q->where('ai_paused', true))
            ->when($status === 'unread', fn ($q) => $q->unread())
            ->when($status !== '' && ! in_array($status, ['paused', 'unread'], true), fn ($q) => $q->where('status', $status))
            ->when($paused !== null && $paused !== '', function ($q) use ($paused) {
                $q->where('ai_paused', filter_var($paused, FILTER_VALIDATE_BOOLEAN));
            })
            ->when($request->string('q')->toString(), function ($q, $search) {
                $q->whereHas('customer', function ($customer) use ($search) {
                    $customer->where(function ($inner) use ($search) {
                        $inner->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('wa_id', 'like', "%{$search}%");
                    });
                });
            })
            ->orderByDesc('last_message_at')
            ->paginate(30);

        return response()->json($conversations);
    }

    public function meta(): JsonResponse
    {
        return response()->json([
            'all' => Conversation::query()->count(),
            'bot' => Conversation::query()->where('status', 'bot')->where('ai_paused', false)->count(),
            'human' => Conversation::query()->where('status', 'human')->count(),
            'paused' => Conversation::query()->where('ai_paused', true)->count(),
            'unread' => Conversation::query()->unread()->count(),
        ]);
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'uuids' => ['required', 'array', 'min:1', 'max:50'],
            'uuids.*' => ['uuid'],
            'action' => ['required', 'in:read,claim,unassign,pause,resume'],
        ]);

        $conversations = Conversation::query()
            ->whereIn('uuid', $data['uuids'])
            ->get();

        $userId = $request->user()->id;
        $updated = 0;

        foreach ($conversations as $conversation) {
            match ($data['action']) {
                'read' => $conversation->markRead(),
                'claim' => $conversation->update(['assigned_user_id' => $userId]),
                'unassign' => $conversation->update(['assigned_user_id' => null]),
                'pause' => $conversation->update([
                    'ai_paused' => true,
                    'status' => 'human',
                    'assigned_user_id' => $conversation->assigned_user_id ?? $userId,
                ]),
                'resume' => tap($conversation, function (Conversation $conversation) use ($userId) {
                    $conversation->update([
                        'ai_paused' => false,
                        'status' => 'bot',
                    ]);
                    $conversation->escalations()
                        ->where('status', 'open')
                        ->update([
                            'status' => 'resolved',
                            'resolved_at' => now(),
                            'resolved_by' => $userId,
                        ]);
                }),
            };
            $updated++;
        }

        return response()->json([
            'updated' => $updated,
            'action' => $data['action'],
        ]);
    }

    public function show(Conversation $conversation): JsonResponse
    {
        return response()->json(
            $conversation->load(['customer', 'assignedUser:id,name,email', 'escalations', 'latestMessage'])
        );
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        $messages = $conversation->messages()
            ->orderBy('created_at')
            ->paginate(100);

        $markRead = filter_var(
            $request->query('mark_read', true),
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($markRead !== false) {
            $conversation->markRead();
        }

        return response()->json($messages);
    }

    public function markRead(Conversation $conversation): JsonResponse
    {
        $conversation->markRead();

        return response()->json(
            $conversation->fresh()->load(['customer', 'assignedUser:id,name,email', 'latestMessage'])
        );
    }

    public function assign(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        // Omit user_id → claim as current user; explicit null → unassign.
        $userId = array_key_exists('user_id', $data)
            ? $data['user_id']
            : $request->user()->id;

        if ($userId !== null && $userId !== $request->user()->id) {
            $assigneeOk = User::query()
                ->whereKey($userId)
                ->whereHas('tenants', fn ($q) => $q->where('tenants.id', $conversation->tenant_id))
                ->exists();

            if (! $assigneeOk) {
                return response()->json([
                    'message' => 'Assignee must belong to this tenant.',
                    'code' => 'invalid_assignee',
                ], 422);
            }
        }

        $conversation->update([
            'assigned_user_id' => $userId,
        ]);

        return response()->json(
            $conversation->fresh()->load(['customer', 'assignedUser:id,name,email', 'latestMessage'])
        );
    }

    public function reply(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:4096'],
        ]);

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'direction' => 'outbound',
            'type' => 'text',
            'body' => $data['body'],
            'sender_type' => 'agent',
        ]);

        $conversation->update([
            'last_message_at' => now(),
            'status' => 'human',
            'ai_paused' => true,
            'operator_last_read_at' => now(),
            'assigned_user_id' => $conversation->assigned_user_id ?? $request->user()->id,
        ]);

        SendWhatsAppMessage::dispatch($message->id);

        return response()->json($message, 201);
    }

    public function escalate(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $escalation = $conversation->escalations()->create([
            'reason' => $data['reason'] ?? 'Manual escalation',
            'status' => 'open',
        ]);

        $conversation->update([
            'status' => 'human',
            'ai_paused' => true,
            'assigned_user_id' => $conversation->assigned_user_id ?? $request->user()->id,
        ]);

        return response()->json($escalation, 201);
    }

    public function resumeAi(Request $request, Conversation $conversation): JsonResponse
    {
        $conversation->update([
            'status' => 'bot',
            'ai_paused' => false,
        ]);

        $conversation->escalations()
            ->where('status', 'open')
            ->update([
                'status' => 'resolved',
                'resolved_at' => now(),
                'resolved_by' => $request->user()->id,
            ]);

        return response()->json(
            $conversation->fresh()->load(['customer', 'assignedUser:id,name,email', 'latestMessage'])
        );
    }
}
