import type { MediaItem, MediaTypeFilter, StorageStats, Subject, UploadSession } from './types';

/**
 * Base URL of the API. Empty by default because the Worker serves the built
 * app itself, so the browser only ever talks to one origin.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/* ------------------------------------------------------------ public API */

export async function listPublishedMedia(params: {
  subject?: Subject;
  q?: string;
  type?: MediaTypeFilter | '';
}): Promise<MediaItem[]> {
  const body = await request<{ items: MediaItem[] }>(
    `/api/media${query({
      subject: params.subject,
      q: params.q,
      type: params.type || undefined,
    })}`,
  );
  return body.items;
}

export async function getPublishedMedia(id: string): Promise<MediaItem> {
  const body = await request<{ item: MediaItem }>(`/api/media/${encodeURIComponent(id)}`);
  return body.item;
}

/* ------------------------------------------------------------- admin API */

export async function login(username: string, password: string): Promise<void> {
  await request('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function logout(): Promise<void> {
  await request('/api/admin/logout', { method: 'POST' });
}

export async function currentSession(): Promise<string | null> {
  try {
    const body = await request<{ admin: { username: string } }>('/api/admin/session');
    return body.admin.username;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function listAdminMedia(params: {
  subject?: Subject;
  q?: string;
  status?: 'uploading' | 'ready' | '';
}): Promise<MediaItem[]> {
  const body = await request<{ items: MediaItem[] }>(
    `/api/admin/media${query({
      subject: params.subject,
      q: params.q,
      status: params.status || undefined,
    })}`,
  );
  return body.items;
}

export async function patchMedia(
  id: string,
  changes: { title?: string; description?: string; subject?: Subject; published?: boolean },
): Promise<MediaItem> {
  const body = await request<{ item: MediaItem }>(`/api/admin/media/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(changes),
  });
  return body.item;
}

export async function deleteMedia(id: string): Promise<void> {
  await request(`/api/admin/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function storageStats(): Promise<StorageStats> {
  return request<StorageStats>('/api/admin/storage');
}

export async function startUpload(payload: {
  title: string;
  description: string;
  subject: Subject;
  fileName: string;
  fileSize: number;
  mimeType: string;
  published: boolean;
}): Promise<UploadSession> {
  return request<UploadSession>('/api/admin/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function completeUpload(mediaId: string, parts: Array<{ partNumber: number; etag: string }>): Promise<MediaItem> {
  const body = await request<{ item: MediaItem }>(
    `/api/admin/uploads/${encodeURIComponent(mediaId)}/complete`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ parts }),
    },
  );
  return body.item;
}

export async function abortUpload(mediaId: string): Promise<void> {
  await request(`/api/admin/uploads/${encodeURIComponent(mediaId)}`, { method: 'DELETE' });
}
