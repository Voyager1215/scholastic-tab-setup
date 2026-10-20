import type { Env } from './types';

export interface ApiErrorBody {
  error: string;
  message: string;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function apiError(status: number, error: string, message: string, headers: Record<string, string> = {}): Response {
  const body: ApiErrorBody = { error, message };
  return json(body, status, headers);
}

export function notFound(message = 'Not found'): Response {
  return apiError(404, 'not_found', message);
}

export function badRequest(message: string): Response {
  return apiError(400, 'bad_request', message);
}

export function methodNotAllowed(allowed: string[]): Response {
  return apiError(405, 'method_not_allowed', `Allowed methods: ${allowed.join(', ')}`, {
    allow: allowed.join(', '),
  });
}

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * CORS is only needed when the frontend is hosted separately from this
 * Worker. When the Worker serves the app too, every request is same origin
 * and no CORS headers are emitted.
 */
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  const allowed = allowedOrigins(env);
  if (!allowed.includes(origin)) return {};

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

export function preflight(request: Request, env: Env): Response {
  const headers = corsHeaders(request, env);
  if (Object.keys(headers).length === 0) {
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204, headers });
}

/**
 * Baseline security headers. Applied to API responses and to the HTML shell
 * that the Worker serves.
 */
export function securityHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
    'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  };

  if (contentType && contentType.includes('text/html')) {
    headers['content-security-policy'] = [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  return headers;
}

/** Reads a JSON body, tolerating an empty body. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
