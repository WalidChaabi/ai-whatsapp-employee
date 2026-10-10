<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_settings', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('provider', 32)->default('openai');
            $table->string('model')->default('gpt-4.1-mini');
            $table->float('temperature')->default(0.3);
            $table->json('tools_enabled')->nullable();
            $table->json('handoff_rules')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_prompts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('key', 64);
            $table->longText('content');
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'key', 'version']);
            $table->index(['tenant_id', 'key', 'is_active']);
        });

        Schema::create('tool_runs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->string('tool');
            $table->json('input')->nullable();
            $table->json('output')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_runs');
        Schema::dropIfExists('ai_prompts');
        Schema::dropIfExists('ai_settings');
    }
};
