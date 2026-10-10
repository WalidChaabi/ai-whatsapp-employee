<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyN8nHmac
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('services.n8n.hmac_secret');

        if (! $secret) {
            return response()->json([
                'message' => 'n8n HMAC secret is not configured.',
                'code' => 'misconfigured',
            ], 500);
        }

        $signature = $request->header('X-N8n-Signature');
        $timestamp = $request->header('X-N8n-Timestamp');

        if (! $signature || ! $timestamp) {
            return response()->json([
                'message' => 'Missing n8n signature headers.',
                'code' => 'unauthorized',
            ], 401);
        }

        if (abs(time() - (int) $timestamp) > 300) {
            return response()->json([
                'message' => 'n8n signature timestamp expired.',
                'code' => 'unauthorized',
            ], 401);
        }

        $payload = $timestamp.'.'.$request->getContent();
        $expected = hash_hmac('sha256', $payload, $secret);

        if (! hash_equals($expected, $signature)) {
            return response()->json([
                'message' => 'Invalid n8n signature.',
                'code' => 'unauthorized',
            ], 401);
        }

        return $next($request);
    }
}
