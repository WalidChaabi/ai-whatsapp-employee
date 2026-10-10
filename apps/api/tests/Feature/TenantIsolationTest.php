<?php

namespace Tests\Feature;

use App\Domain\Catalog\Models\Product;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_list_does_not_leak_across_tenants(): void
    {
        $user = User::factory()->create();

        $tenantA = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Tenant A',
            'slug' => 'tenant-a',
            'status' => 'active',
        ]);
        $tenantB = Tenant::query()->create([
            'uuid' => (string) Str::uuid(),
            'name' => 'Tenant B',
            'slug' => 'tenant-b',
            'status' => 'active',
        ]);

        $tenantA->users()->attach($user->id, ['role' => 'owner', 'status' => 'active']);
        $tenantB->users()->attach($user->id, ['role' => 'owner', 'status' => 'active']);

        TenantContext::set($tenantA);
        Product::query()->create([
            'sku' => 'A-1',
            'name' => 'Secret A',
            'price' => 10,
            'status' => 'active',
        ]);
        TenantContext::clear();

        TenantContext::set($tenantB);
        Product::query()->create([
            'sku' => 'B-1',
            'name' => 'Secret B',
            'price' => 20,
            'status' => 'active',
        ]);
        TenantContext::clear();

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-ID' => $tenantA->uuid,
        ])->getJson('/api/v1/products');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name');
        $this->assertTrue($names->contains('Secret A'));
        $this->assertFalse($names->contains('Secret B'));
    }
}
