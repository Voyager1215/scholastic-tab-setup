import {
  currentAdmin,
  clearedSessionCookie,
  login,
  loginResponse,
  logout,
  requireAdmin,
} from './auth';
import { isSubject } from './constants';
import {
  apiError,
  badRequest,
  corsHeaders,
  json,
  methodNotAllowed,
  notFound,
  preflight,
  readJson,
  securityHeaders,
} from './http';
import {
  deliverMedia,
  getMediaRow,
  getPublishedMediaRow,
  listMedia,
  storageStats,
  toItem,
} from './media';
import {
  abortUpload,
  cleanupAbandonedUploads,
  completeUpload,
  createUpload,
  putPart,
  putSingleFile,
  type CompletedPart,
  type CreateUploadRequest,
} from './uploads';
import type { Env, MediaRow } from './types';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      if (request.method === 'OPTIONS') {
        return preflight(request, env);
      }

      if (path === '/api/health') {
        return withCors(json({ ok: true, service: 'edu-media-portal' }), request, env);
      }

      if (path.startsWith('/api/')) {
        const response = await handleApi(request, env, url);
        return withCors(response, request, env);
      }

      if (path.startsWith('/media/')) {
        const response = await handleMedia(request, env, url);
        return withCors(response, request, env);
      }

      // Everything else is the React app (static assets + SPA fallback).
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      for (const [key, value] of Object.entries(securityHeaders(headers.get('content-type') ?? ''))) {
        headers.set(key, value);
      }
      return new Response(asset.body, { status: asset.status, headers });
    } catch (error) {
      console.error('Unhandled error', error);
      return withCors(
        apiError(500, 'internal_error', 'Something went wrong handling that request.'),
        request,
        env,
      );
    }
  },

  /**
   * Nightly cleanup: aborts multipart uploads that were never completed and
   * removes their metadata rows.
   */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const removed = await cleanupAbandonedUploads(env);
        console.log(`Cleaned up ${removed} abandoned upload(s)`);
      })(),
    );
  },
};

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** True when the request arrived over HTTPS (always the case in production). */
function isHttps(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

function withCors(response: Response, request: Request, env: Env): Response {
  const cors = corsHeaders(request, env);
  if (Object.keys(cors).length === 0) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const segs = segments(url.pathname);
  const [, area, ...rest] = segs;

  if (area === 'media') {
    if (rest.length === 0 && request.method === 'GET') {
      const subject = url.searchParams.get('subject') ?? undefined;
      if (subject && !isSubject(subject)) {
        return badRequest('Unknown subject.');
      }
      const items = await listMedia(env, {
        subject,
        publishedOnly: true,
        status: 'ready',
        q: url.searchParams.get('q') ?? undefined,
        type: (url.searchParams.get('type') as never) ?? undefined,
      });
      return json({ items: items.map(toItem) });
    }

    if (rest.length === 1 && request.method === 'GET') {
      const row = await getPublishedMediaRow(env, rest[0]);
      if (!row) return notFound('Resource not found.');
      return json({ item: toItem(row) });
    }

    return methodNotAllowed(['GET']);
  }

  if (area === 'admin') {
    return handleAdmin(request, env, url, rest);
  }

  return notFound('Unknown endpoint.');
}

async function handleAdmin(request: Request, env: Env, url: URL, rest: string[]): Promise<Response> {
  const [resource, id, sub, extra] = rest;

  // --- Unauthenticated endpoints -----------------------------------------
  if (resource === 'login' && request.method === 'POST') {
    const payload = await readJson<{ username?: string; password?: string }>(request);
    const username = typeof payload?.username === 'string' ? payload.username.trim() : '';
    const password = typeof payload?.password === 'string' ? payload.password : '';
    if (!username || !password) return badRequest('Username and password are required.');

    const result = await login(env, request, username, password);
    if (!result.ok) return result.response as Response;
    return loginResponse(result.token as string, result.admin as { id: string; username: string }, env, isHttps(request));
  }

  if (resource === 'logout' && request.method === 'POST') {
    await logout(env, request);
    return json({ ok: true }, 200, { 'set-cookie': clearedSessionCookie(isHttps(request)) });
  }

  if (resource === 'session' && request.method === 'GET') {
    const admin = await currentAdmin(env, request);
    if (!admin) return apiError(401, 'unauthorized', 'Not signed in.');
    return json({ admin: { username: admin.username } });
  }

  // --- Authenticated endpoints --------------------------------------------
  const guard = await requireAdmin(env, request);
  if ('response' in guard) return guard.response;

  if (resource === 'storage' && request.method === 'GET') {
    return json(await storageStats(env));
  }

  if (resource === 'media' && rest.length === 1 && request.method === 'GET') {
    const subject = url.searchParams.get('subject') ?? undefined;
    if (subject && !isSubject(subject)) return badRequest('Unknown subject.');
    const rows = await listMedia(env, {
      subject,
      q: url.searchParams.get('q') ?? undefined,
      type: (url.searchParams.get('type') as never) ?? undefined,
      status: (url.searchParams.get('status') as never) ?? undefined,
    });
    return json({ items: rows.map(toItem) });
  }

  if (resource === 'media' && rest.length === 2 && request.method === 'GET') {
    const row = await getMediaRow(env, id);
    if (!row) return notFound('Resource not found.');
    return json({ item: toItem(row) });
  }

  if (resource === 'media' && rest.length === 2 && request.method === 'PATCH') {
    const payload = await readJson<{
      title?: unknown;
      description?: unknown;
      subject?: unknown;
      published?: unknown;
    }>(request);
    if (!payload) return badRequest('A JSON body is required.');

    const row = await getMediaRow(env, id);
    if (!row) return notFound('Resource not found.');

    const title = typeof payload.title === 'string' ? payload.title.trim() : row.title;
    if (!title) return badRequest('The title cannot be empty.');

    const description =
      typeof payload.description === 'string' ? payload.description.trim() : (row.description ?? '');

    let subject = row.subject;
    if (typeof payload.subject === 'string') {
      if (!isSubject(payload.subject)) return badRequest('Unknown subject.');
      subject = payload.subject;
    }

    let published = row.published;
    if (typeof payload.published === 'boolean') published = payload.published ? 1 : 0;

    await env.DB.prepare(
      `UPDATE media
          SET title = ?, description = ?, subject = ?, published = ?, updated_at = datetime('now')
        WHERE id = ?`,
    )
      .bind(title, description || null, subject, published, id)
      .run();

    const updated = await getMediaRow(env, id);
    return json({ item: toItem(updated as MediaRow) });
  }

  if (resource === 'media' && rest.length === 2 && request.method === 'DELETE') {
    const row = await getMediaRow(env, id);
    if (!row) return notFound('Resource not found.');

    try {
      await env.MEDIA_BUCKET.delete(row.object_key);
    } catch {
      // The object may already be gone; the row still has to go.
    }
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  if (resource === 'media' && rest.length === 3 && sub === 'preview' && request.method === 'GET') {
    const row = await getMediaRow(env, id);
    if (!row) return notFound('Resource not found.');
    return deliverMedia(env, row, request, { private: true });
  }

  if (resource === 'uploads' && rest.length === 1 && request.method === 'POST') {
    const payload = await readJson<CreateUploadRequest>(request);
    if (!payload) return badRequest('A JSON body is required.');

    const created = await createUpload(env, payload);
    if (created instanceof Response) return created;

    return json({
      mediaId: created.session.mediaId,
      mode: created.session.mode,
      partSize: created.session.partSize,
      partCount: created.session.partCount,
      item: toItem(created.row),
    });
  }

  if (resource === 'uploads' && rest.length === 3 && sub === 'file' && request.method === 'PUT') {
    const result = await putSingleFile(env, id, request);
    if (result instanceof Response) return result;
    return json({ item: result });
  }

  if (resource === 'uploads' && rest.length === 4 && sub === 'parts' && request.method === 'PUT') {
    const partNumber = Number.parseInt(extra ?? '', 10);
    const result = await putPart(env, id, partNumber, request);
    if (result instanceof Response) return result;
    return json(result);
  }

  if (resource === 'uploads' && rest.length === 3 && sub === 'complete' && request.method === 'POST') {
    const payload = await readJson<{ parts?: CompletedPart[] }>(request);
    if (!payload) return badRequest('A JSON body is required.');

    const result = await completeUpload(env, id, payload.parts ?? []);
    if (result instanceof Response) return result;
    return json({ item: result });
  }

  if (resource === 'uploads' && rest.length === 2 && request.method === 'DELETE') {
    return abortUpload(env, id);
  }

  return notFound('Unknown admin endpoint.');
}

async function handleMedia(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  const id = segments(url.pathname)[1];
  if (!id) return notFound('Unknown media id.');

  const row = await getPublishedMediaRow(env, id);
  if (!row) return notFound('Resource not found.');

  return deliverMedia(env, row, request);
}
