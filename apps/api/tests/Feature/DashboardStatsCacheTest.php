<?php

namespace Tests\Feature;

use App\Domain\Catalog\Models\Product;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardStatsCacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_stats_cache_does_not_leak_product_counts_across_tenants(): void
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
        Product::query()->create(['sku' => 'A-1', 'name' => 'A Product', 'price' => 10, 'status' => 'active']);
        TenantContext::clear();

        TenantContext::set($tenantB);
        foreach (range(1, 3) as $i) {
            Product::query()->create(['sku' => "B-{$i}", 'name' => "B Product {$i}", 'price' => 10, 'status' => 'active']);
        }
        TenantContext::clear();

        $token = $user->createToken('test')->plainTextToken;

        $statsFor = fn (Tenant $tenant) => $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
            'X-Tenant-ID' => $tenant->uuid,
        ])->getJson('/api/v1/dashboard/stats')->json();

        $this->assertSame(1, $statsFor($tenantA)['products']);
        $this->assertSame(3, $statsFor($tenantB)['products']);
        // Re-fetch tenant A to make sure tenant B's cached entry wasn't reused.
        $this->assertSame(1, $statsFor($tenantA)['products']);
    }
}
