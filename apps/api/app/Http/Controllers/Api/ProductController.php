<?php

namespace App\Http\Controllers\Api;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\Product;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $products = Product::query()
            ->with('category')
            ->when($request->string('q')->toString(), function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                });
            })
            ->when($request->string('category_uuid')->toString(), function ($q, $categoryUuid) {
                $q->whereHas('category', fn ($category) => $category->where('uuid', $categoryUuid));
            })
            ->latest()
            ->paginate(20);

        return response()->json($products);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer'],
            'category_uuid' => ['nullable', 'uuid'],
            'sku' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'stock_qty' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,draft,archived'],
            'attributes' => ['nullable', 'array'],
        ]);

        $data['category_id'] = $this->resolveCategoryId($data);
        unset($data['category_uuid']);

        $product = Product::query()->create($data);

        return response()->json($product->load('category'), 201);
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('category', 'media'));
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer'],
            'category_uuid' => ['nullable', 'uuid'],
            'sku' => ['sometimes', 'string', 'max:64'],
            'name' => ['sometimes', 'string', 'max:160'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'stock_qty' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:active,draft,archived'],
            'attributes' => ['nullable', 'array'],
        ]);

        if (array_key_exists('category_uuid', $data) || array_key_exists('category_id', $data)) {
            $data['category_id'] = $this->resolveCategoryId($data);
        }
        unset($data['category_uuid']);

        $product->update($data);

        return response()->json($product->fresh()->load('category'));
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->delete();

        return response()->json(null, 204);
    }

    private function resolveCategoryId(array $data): ?int
    {
        if (! empty($data['category_uuid'])) {
            return Category::query()->where('uuid', $data['category_uuid'])->value('id');
        }

        if (array_key_exists('category_id', $data)) {
            return $data['category_id'];
        }

        return null;
    }
}
