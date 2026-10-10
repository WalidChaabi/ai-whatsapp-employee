<?php

namespace Database\Seeders;

use App\Domain\AI\Models\AiPrompt;
use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\Product;
use App\Domain\Tenant\Models\Tenant;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'owner@awe.test'],
            [
                'name' => 'Demo Owner',
                'password' => Hash::make('password'),
            ]
        );

        $tenant = Tenant::query()->firstOrCreate(
            ['slug' => 'demo-shop'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Demo Shop',
                'status' => 'trialing',
                'timezone' => 'UTC',
                'locale' => 'en',
            ]
        );

        if (! $tenant->users()->where('users.id', $user->id)->exists()) {
            $tenant->users()->attach($user->id, [
                'role' => 'owner',
                'status' => 'active',
            ]);
        }

        TenantContext::set($tenant);

        $tenant->aiSettings()->firstOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'provider' => 'openai',
                'model' => 'gpt-4.1-mini',
                'temperature' => 0.3,
                'tools_enabled' => ['products.search', 'knowledge.search', 'escalate'],
            ]
        );

        AiPrompt::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'key' => 'system',
                'version' => 1,
            ],
            [
                'content' => 'You are the AI WhatsApp employee for Demo Shop. Answer FAQs, search products with tools, and escalate to a human when asked.',
                'is_active' => true,
            ]
        );

        $footwear = Category::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'slug' => 'footwear',
            ],
            [
                'name' => 'Footwear',
                'sort_order' => 1,
            ]
        );

        $accessories = Category::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'slug' => 'accessories',
            ],
            [
                'name' => 'Accessories',
                'sort_order' => 2,
            ]
        );

        Product::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'sku' => 'SNK-BLU-01',
            ],
            [
                'category_id' => $footwear->id,
                'name' => 'Blue Sneakers',
                'description' => 'Comfortable blue sneakers for everyday wear.',
                'price' => 79.99,
                'currency' => 'USD',
                'stock_qty' => 25,
                'status' => 'active',
            ]
        );

        Product::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'sku' => 'HAT-BLK-01',
            ],
            [
                'category_id' => $accessories->id,
                'name' => 'Black Cap',
                'description' => 'Classic black baseball cap.',
                'price' => 24.50,
                'currency' => 'USD',
                'stock_qty' => 100,
                'status' => 'active',
            ]
        );

        // Attach categories to existing demo products if they were seeded earlier without one.
        Product::query()->where('sku', 'SNK-BLU-01')->whereNull('category_id')->update(['category_id' => $footwear->id]);
        Product::query()->where('sku', 'HAT-BLK-01')->whereNull('category_id')->update(['category_id' => $accessories->id]);

        // Demo chat seed removed — Inbox should only show real WhatsApp conversations.

        TenantContext::clear();
    }
}
