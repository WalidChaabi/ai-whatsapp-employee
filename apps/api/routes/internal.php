<?php

use App\Http\Controllers\Internal\IngressController;
use App\Http\Controllers\Internal\ToolController;
use App\Http\Middleware\VerifyN8nHmac;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware([VerifyN8nHmac::class])->group(function () {
    Route::get('health', [ToolController::class, 'health']);
    Route::post('ingress/message', [IngressController::class, 'message']);
    Route::get('tools/products/search', [ToolController::class, 'searchProducts']);
    Route::get('tools/knowledge/search', [ToolController::class, 'searchKnowledge']);
    Route::post('tools/escalate', [ToolController::class, 'escalate']);
    Route::post('egress/message', [ToolController::class, 'egress']);
});
