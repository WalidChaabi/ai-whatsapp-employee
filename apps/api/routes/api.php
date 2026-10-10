<?php

use App\Http\Controllers\Api\AiSettingsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\KnowledgeArticleController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\WhatsappAccountController;
use App\Http\Middleware\EnsureTenantAccess;
use App\Http\Middleware\EnsureTenantRole;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::post('accept-invite', [TeamController::class, 'acceptInvite']);
        });
    });

    Route::middleware(['auth:sanctum', EnsureTenantAccess::class])->group(function () {
        Route::get('dashboard/stats', [DashboardController::class, 'stats']);

        Route::apiResource('products', ProductController::class);
        Route::apiResource('categories', CategoryController::class);
        Route::apiResource('knowledge-articles', KnowledgeArticleController::class);

        Route::get('customers', [CustomerController::class, 'index']);
        Route::get('customers/{customer}', [CustomerController::class, 'show']);
        Route::put('customers/{customer}', [CustomerController::class, 'update']);

        Route::get('conversations/meta', [ConversationController::class, 'meta']);
        Route::post('conversations/bulk', [ConversationController::class, 'bulk']);
        Route::get('conversations', [ConversationController::class, 'index']);
        Route::get('conversations/{conversation}', [ConversationController::class, 'show']);
        Route::get('conversations/{conversation}/messages', [ConversationController::class, 'messages']);
        Route::post('conversations/{conversation}/messages', [ConversationController::class, 'reply']);
        Route::post('conversations/{conversation}/escalate', [ConversationController::class, 'escalate']);
        Route::post('conversations/{conversation}/resume-ai', [ConversationController::class, 'resumeAi']);
        Route::post('conversations/{conversation}/read', [ConversationController::class, 'markRead']);
        Route::post('conversations/{conversation}/assign', [ConversationController::class, 'assign']);

        Route::get('whatsapp-account', [WhatsappAccountController::class, 'show']);
        Route::get('ai-settings', [AiSettingsController::class, 'show']);
        Route::get('team/members', [TeamController::class, 'members']);

        Route::middleware(EnsureTenantRole::class.':owner')->group(function () {
            Route::put('whatsapp-account', [WhatsappAccountController::class, 'upsert']);
            Route::put('ai-settings', [AiSettingsController::class, 'update']);

            Route::get('team/invitations', [TeamController::class, 'invitations']);
            Route::post('team/invitations', [TeamController::class, 'invite']);
            Route::delete('team/invitations/{invitation}', [TeamController::class, 'cancelInvitation']);
            Route::patch('team/members/{userId}', [TeamController::class, 'updateMember']);
            Route::delete('team/members/{userId}', [TeamController::class, 'removeMember']);
        });
    });
});
