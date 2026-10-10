<?php

namespace Tests\Feature;

use App\Domain\Chat\Models\Conversation;
use App\Domain\CRM\Models\Customer;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ConversationTenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function makeTenant(string $slug): Tenant
    {
        return Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => $slug,
            'slug' => $slug,
            'status' => 'active',
        ]);
    }

    private function makeConversationFor(Tenant $tenant): Conversation
    {
        TenantContext::set($tenant);

        $customer = Customer::query()->create([
            'wa_id' => '1'.random_int(100000000, 999999999),
        ]);

        $conversation = Conversation::query()->create([
            'customer_id' => $customer->id,
            'status' => 'bot',
            'ai_paused' => false,
            'last_message_at' => now(),
        ]);

        TenantContext::clear();

        return $conversation;
    }

    /**
     * A user who is only a member of tenant A, authenticated with the tenant A
     * header, must not be able to resolve a conversation UUID that belongs to
     * tenant B via implicit route-model binding.
     */
    public function test_cannot_view_another_tenants_conversation_by_uuid(): void
    {
        $user = User::factory()->create();

        $tenantA = $this->makeTenant('tenant-a');
        $tenantB = $this->makeTenant('tenant-b');

        $tenantA->users()->attach($user->id, ['role' => 'owner', 'status' => 'active']);

        $foreignConversation = $this->makeConversationFor($tenantB);

        $token = $user->createToken('test')->plainTextToken;
        $headers = [
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-ID' => $tenantA->uuid,
        ];

        $this->withHeaders($headers)
            ->getJson("/api/v1/conversations/{$foreignConversation->uuid}")
            ->assertNotFound();

        $this->withHeaders($headers)
            ->getJson("/api/v1/conversations/{$foreignConversation->uuid}/messages")
            ->assertNotFound();

        $this->withHeaders($headers)
            ->postJson("/api/v1/conversations/{$foreignConversation->uuid}/messages", ['body' => 'hi'])
            ->assertNotFound();

        $this->withHeaders($headers)
            ->postJson("/api/v1/conversations/{$foreignConversation->uuid}/escalate")
            ->assertNotFound();

        $this->withHeaders($headers)
            ->postJson("/api/v1/conversations/{$foreignConversation->uuid}/resume-ai")
            ->assertNotFound();

        $this->withHeaders($headers)
            ->postJson("/api/v1/conversations/{$foreignConversation->uuid}/assign")
            ->assertNotFound();

        $this->assertDatabaseHas('conversations', [
            'id' => $foreignConversation->id,
            'tenant_id' => $tenantB->id,
        ]);
    }
}
