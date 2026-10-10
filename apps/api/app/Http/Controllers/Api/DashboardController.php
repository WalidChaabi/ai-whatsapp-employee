<?php

namespace App\Http\Controllers\Api;

use App\Domain\AI\Models\AiPrompt;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\CRM\Models\Customer;
use App\Domain\Catalog\Models\Product;
use App\Domain\WhatsApp\Models\WhatsappAccount;
use App\Http\Controllers\Controller;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $payload = Cache::remember(
            "tenant:{$this->tenantCacheKey()}:dashboard-stats",
            now()->addSeconds(30),
            fn () => $this->buildStats(),
        );

        return response()->json($payload);
    }

    private function tenantCacheKey(): string
    {
        return TenantContext::uuid() ?? 'none';
    }

    /**
     * @return array{
     *   conversations: int, paused: int, unread: int, customers: int, products: int,
     *   attention: mixed, whatsapp_connected: bool, ai_configured: bool, analytics: array
     * }
     */
    private function buildStats(): array
    {
        $pausedCount = Conversation::query()->where('ai_paused', true)->count();

        $attention = Conversation::query()
            ->with(['customer', 'latestMessage'])
            ->where('ai_paused', true)
            ->orderByDesc('last_message_at')
            ->limit(5)
            ->get();

        $whatsapp = WhatsappAccount::query()->latest()->first();
        $whatsappConnected = $whatsapp
            && $whatsapp->status === 'connected'
            && filled($whatsapp->access_token_encrypted);

        $prompt = AiPrompt::query()
            ->where('is_active', true)
            ->latest('version')
            ->first()
            ?? AiPrompt::query()->latest('version')->first();
        $aiConfigured = $prompt !== null && filled(trim((string) $prompt->content));

        return [
            'conversations' => Conversation::query()->count(),
            'paused' => $pausedCount,
            'unread' => Conversation::query()->unread()->count(),
            'customers' => Customer::query()->count(),
            'products' => Product::query()->count(),
            'attention' => $attention,
            'whatsapp_connected' => $whatsappConnected,
            'ai_configured' => $aiConfigured,
            'analytics' => $this->analytics(),
        ];
    }

    /**
     * @return array{
     *   messages_today: int,
     *   inbound_7d: int,
     *   outbound_7d: int,
     *   by_status: array{bot: int, human: int, paused: int},
     *   by_sender_7d: array{customer: int, ai: int, agent: int},
     *   series_7d: list<array{date: string, label: string, inbound: int, outbound: int, total: int}>
     * }
     */
    private function analytics(): array
    {
        $todayStart = now()->startOfDay();
        $from = now()->subDays(6)->startOfDay();

        $messagesToday = Message::query()
            ->where('created_at', '>=', $todayStart)
            ->count();

        $directionRows = Message::query()
            ->where('created_at', '>=', $from)
            ->select('direction', DB::raw('count(*) as aggregate'))
            ->groupBy('direction')
            ->pluck('aggregate', 'direction');

        $senderRows = Message::query()
            ->where('created_at', '>=', $from)
            ->select('sender_type', DB::raw('count(*) as aggregate'))
            ->groupBy('sender_type')
            ->pluck('aggregate', 'sender_type');

        $dailyRows = Message::query()
            ->where('created_at', '>=', $from)
            ->select(
                DB::raw('DATE(created_at) as day'),
                'direction',
                DB::raw('count(*) as aggregate')
            )
            ->groupBy('day', 'direction')
            ->get();

        $byDay = [];
        foreach ($dailyRows as $row) {
            $day = Carbon::parse($row->day)->toDateString();
            if (! isset($byDay[$day])) {
                $byDay[$day] = ['inbound' => 0, 'outbound' => 0];
            }
            if ($row->direction === 'inbound') {
                $byDay[$day]['inbound'] = (int) $row->aggregate;
            } elseif ($row->direction === 'outbound') {
                $byDay[$day]['outbound'] = (int) $row->aggregate;
            }
        }

        $series = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->subDays($i)->startOfDay();
            $key = $day->toDateString();
            $inbound = $byDay[$key]['inbound'] ?? 0;
            $outbound = $byDay[$key]['outbound'] ?? 0;
            $series[] = [
                'date' => $key,
                'label' => $day->format('D'),
                'inbound' => $inbound,
                'outbound' => $outbound,
                'total' => $inbound + $outbound,
            ];
        }

        return [
            'messages_today' => $messagesToday,
            'inbound_7d' => (int) ($directionRows['inbound'] ?? 0),
            'outbound_7d' => (int) ($directionRows['outbound'] ?? 0),
            'by_status' => [
                'bot' => Conversation::query()->where('status', 'bot')->where('ai_paused', false)->count(),
                'human' => Conversation::query()->where('status', 'human')->count(),
                'paused' => Conversation::query()->where('ai_paused', true)->count(),
            ],
            'by_sender_7d' => [
                'customer' => (int) ($senderRows['customer'] ?? 0),
                'ai' => (int) ($senderRows['ai'] ?? 0),
                'agent' => (int) ($senderRows['agent'] ?? 0),
            ],
            'series_7d' => $series,
        ];
    }
}
