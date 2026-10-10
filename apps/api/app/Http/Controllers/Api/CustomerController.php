<?php

namespace App\Http\Controllers\Api;

use App\Domain\CRM\Models\Customer;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $customers = Customer::query()
            ->withCount('conversations')
            ->when($request->string('q')->toString(), function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('wa_id', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('updated_at')
            ->paginate(30);

        return response()->json($customers);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json(
            $customer->load(['conversations' => fn ($q) => $q->orderByDesc('last_message_at')])
        );
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:160'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:160'],
        ]);

        $customer->update($data);

        return response()->json($customer->fresh());
    }
}
