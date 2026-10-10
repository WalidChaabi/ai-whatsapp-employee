<?php

namespace App\Http\Controllers\Api;

use App\Domain\WhatsApp\Models\WhatsappAccount;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WhatsappAccountController extends Controller
{
    public function show(): JsonResponse
    {
        $account = WhatsappAccount::query()->latest()->first();

        if (! $account) {
            return response()->json(['account' => null]);
        }

        return response()->json([
            'account' => $this->present($account),
        ]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string', 'max:64'],
            'waba_id' => ['nullable', 'string', 'max:64'],
            'display_phone' => ['nullable', 'string', 'max:32'],
            'access_token' => ['nullable', 'string'],
            'status' => ['nullable', 'in:pending,connected,disabled'],
        ]);

        $account = WhatsappAccount::query()->latest()->first();

        $payload = [
            'phone_number_id' => $data['phone_number_id'],
            'waba_id' => $data['waba_id'] ?? null,
            'display_phone' => $data['display_phone'] ?? null,
            'status' => $data['status'] ?? 'connected',
        ];

        if (! empty($data['access_token'])) {
            $payload['access_token_encrypted'] = $data['access_token'];
        }

        if ($account) {
            $account->update($payload);
        } else {
            if (empty($data['access_token'])) {
                return response()->json([
                    'message' => 'The access token field is required when connecting WhatsApp.',
                    'errors' => ['access_token' => ['The access token field is required.']],
                ], 422);
            }

            $account = WhatsappAccount::query()->create($payload);
        }

        return response()->json([
            'account' => $this->present($account->fresh()),
        ]);
    }

    private function present(WhatsappAccount $account): array
    {
        return [
            'uuid' => $account->uuid,
            'phone_number_id' => $account->phone_number_id,
            'waba_id' => $account->waba_id,
            'display_phone' => $account->display_phone,
            'status' => $account->status,
            'has_token' => filled($account->access_token_encrypted),
            'updated_at' => $account->updated_at,
        ];
    }
}
