<?php

namespace App\Http\Controllers\Api;

use App\Domain\AI\Models\AiPrompt;
use App\Domain\AI\Models\AiSetting;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = AiSetting::query()->first();
        $prompt = AiPrompt::query()
            ->where('key', 'system')
            ->where('is_active', true)
            ->orderByDesc('version')
            ->first();

        return response()->json([
            'settings' => $settings,
            'prompt' => $prompt,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', 'string', 'max:32'],
            'model' => ['required', 'string', 'max:64'],
            'temperature' => ['nullable', 'numeric', 'min:0', 'max:2'],
            'tools_enabled' => ['nullable', 'array'],
            'tools_enabled.*' => ['string'],
            'system_prompt' => ['required', 'string'],
        ]);

        $settings = AiSetting::query()->first();

        $payload = [
            'provider' => $data['provider'],
            'model' => $data['model'],
            'temperature' => $data['temperature'] ?? 0.3,
            'tools_enabled' => $data['tools_enabled'] ?? ['products.search', 'knowledge.search', 'escalate'],
        ];

        if ($settings) {
            $settings->update($payload);
        } else {
            $settings = AiSetting::query()->create($payload);
        }

        $prompt = AiPrompt::query()
            ->where('key', 'system')
            ->where('is_active', true)
            ->orderByDesc('version')
            ->first();

        if ($prompt && $prompt->content === $data['system_prompt']) {
            // unchanged
        } elseif ($prompt) {
            $prompt->update(['is_active' => false]);
            $prompt = AiPrompt::query()->create([
                'key' => 'system',
                'content' => $data['system_prompt'],
                'version' => $prompt->version + 1,
                'is_active' => true,
            ]);
        } else {
            $prompt = AiPrompt::query()->create([
                'key' => 'system',
                'content' => $data['system_prompt'],
                'version' => 1,
                'is_active' => true,
            ]);
        }

        return response()->json([
            'settings' => $settings->fresh(),
            'prompt' => $prompt->fresh(),
        ]);
    }
}
