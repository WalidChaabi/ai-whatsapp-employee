<?php

namespace App\Http\Controllers\Api;

use App\Domain\Knowledge\Models\KnowledgeArticle;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KnowledgeArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $articles = KnowledgeArticle::query()
            ->when($request->string('q')->toString(), function ($q, $search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('body', 'like', "%{$search}%");
                });
            })
            ->when($request->string('status')->toString(), function ($q, $status) {
                $q->where('status', $status);
            })
            ->latest()
            ->paginate(30);

        return response()->json($articles);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:20000'],
            'status' => ['nullable', 'in:active,draft'],
        ]);

        $article = KnowledgeArticle::query()->create([
            'title' => $data['title'],
            'body' => $data['body'],
            'status' => $data['status'] ?? 'active',
        ]);

        return response()->json($article, 201);
    }

    public function show(KnowledgeArticle $knowledge_article): JsonResponse
    {
        return response()->json($knowledge_article);
    }

    public function update(Request $request, KnowledgeArticle $knowledge_article): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'body' => ['sometimes', 'string', 'max:20000'],
            'status' => ['nullable', 'in:active,draft'],
        ]);

        $knowledge_article->update($data);

        return response()->json($knowledge_article->fresh());
    }

    public function destroy(KnowledgeArticle $knowledge_article): JsonResponse
    {
        $knowledge_article->delete();

        return response()->json(null, 204);
    }
}
