<?php

namespace Tests\Feature;

use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantRoleAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private function authHeaders(User $user, Tenant $tenant): array
    {
        return [
            'Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken,
            'X-Tenant-ID' => $tenant->uuid,
        ];
    }

    public function test_agent_cannot_connect_whatsapp_or_change_ai_settings(): void
    {
        $agent = User::factory()->create();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Tenant A',
            'slug' => 'tenant-a',
            'status' => 'active',
        ]);

        $tenant->users()->attach($agent->id, ['role' => 'agent', 'status' => 'active']);

        $headers = $this->authHeaders($agent, $tenant);

        $this->withHeaders($headers)
            ->putJson('/api/v1/whatsapp-account', [
                'phone_number_id' => '123456',
                'access_token' => 'secret-token',
            ])
            ->assertForbidden();

        $this->withHeaders($headers)
            ->putJson('/api/v1/ai-settings', [
                'provider' => 'openai',
                'model' => 'gpt-4.1-mini',
                'system_prompt' => 'You are a helpful assistant.',
            ])
            ->assertForbidden();

        $this->withHeaders($headers)
            ->postJson('/api/v1/team/invitations', ['email' => 'new@example.com', 'role' => 'agent'])
            ->assertForbidden();
    }

    public function test_owner_can_connect_whatsapp_and_change_ai_settings(): void
    {
        $owner = User::factory()->create();

        $tenant = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Tenant A',
            'slug' => 'tenant-a',
            'status' => 'active',
        ]);

        $tenant->users()->attach($owner->id, ['role' => 'owner', 'status' => 'active']);

        $headers = $this->authHeaders($owner, $tenant);

        $this->withHeaders($headers)
            ->putJson('/api/v1/whatsapp-account', [
                'phone_number_id' => '123456',
                'access_token' => 'secret-token',
            ])
            ->assertOk();

        $this->withHeaders($headers)
            ->putJson('/api/v1/ai-settings', [
                'provider' => 'openai',
                'model' => 'gpt-4.1-mini',
                'system_prompt' => 'You are a helpful assistant.',
            ])
            ->assertOk();
    }
}
