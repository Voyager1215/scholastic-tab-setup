import { R2_FREE_STORAGE_BYTES, SUBJECTS } from './constants';
import { notFound } from './http';
import type { Env, MediaItem, MediaRow, Subject } from './types';

/** Converts a SQLite `datetime('now')` value into an ISO 8601 string. */
export function toIso(value: string): string {
  if (!value) return new Date().toISOString();
  if (value.includes('T')) return value;
  return `${value.replace(' ', 'T')}Z`;
}

export function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    subject: row.subject,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    published: row.published === 1,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    url: `/media/${row.id}`,
    previewUrl: `/api/admin/media/${row.id}/preview`,
  };
}

export interface ListOptions {
  subject?: string;
  /** Only published items (public catalogue). */
  publishedOnly?: boolean;
  status?: 'uploading' | 'ready';
  /** Free text search over title and description. */
  q?: string;
  /** Coarse file type filter. */
  type?: 'pdf' | 'image' | 'video' | 'audio' | 'document' | 'other';
  limit?: number;
}

export async function listMedia(env: Env, options: ListOptions = {}): Promise<MediaRow[]> {
  const where: string[] = [];
  const params: string[] = [];

  if (options.subject) {
    where.push('subject = ?');
    params.push(options.subject);
  }
  if (options.publishedOnly) {
    where.push('published = 1');
  }
  if (options.status) {
    where.push('status = ?');
    params.push(options.status);
  }
  if (options.q) {
    where.push('(title LIKE ? COLLATE NOCASE OR IFNULL(description, \'\') LIKE ? COLLATE NOCASE)');
    const needle = `%${options.q.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    params.push(needle, needle);
  }

  switch (options.type) {
    case 'pdf':
      where.push("mime_type = 'application/pdf'");
      break;
    case 'image':
      where.push("mime_type LIKE 'image/%'");
      break;
    case 'video':
      where.push("mime_type LIKE 'video/%'");
      break;
    case 'audio':
      where.push("mime_type LIKE 'audio/%'");
      break;
    case 'document':
      where.push(
        "mime_type LIKE 'text/%' OR mime_type LIKE 'application/msword' OR mime_type LIKE 'application/vnd.%'",
      );
      break;
    case 'other':
      // Everything that is not a PDF, image, video, audio or document.
      where.push(
        "mime_type NOT LIKE 'image/%' AND mime_type NOT LIKE 'video/%' AND mime_type NOT LIKE 'audio/%'" +
          " AND mime_type NOT LIKE 'text/%' AND mime_type != 'application/pdf'" +
          " AND mime_type NOT LIKE 'application/msword' AND mime_type NOT LIKE 'application/vnd.%'",
      );
      break;
    default:
      break;
  }

  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const statement = env.DB.prepare(
    `SELECT * FROM media ${clause} ORDER BY created_at DESC, title COLLATE NOCASE ASC LIMIT ?`,
  );

  const result = await statement.bind(...params, limit).all<MediaRow>();
  return result.results ?? [];
}

export async function getMediaRow(env: Env, id: string): Promise<MediaRow | null> {
  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<MediaRow>();
  return row ?? null;
}

export async function getPublishedMediaRow(env: Env, id: string): Promise<MediaRow | null> {
  const row = await env.DB.prepare('SELECT * FROM media WHERE id = ? AND published = 1').bind(id).first<MediaRow>();
  return row ?? null;
}

export interface StorageStats {
  usedBytes: number;
  fileCount: number;
  publishedCount: number;
  unpublishedCount: number;
  quotaBytes: number;
  usedPercent: number;
  bySubject: Array<{ subject: Subject; count: number; bytes: number }>;
}

export async function storageStats(env: Env): Promise<StorageStats> {
  const totals = await env.DB.prepare(
    `SELECT IFNULL(SUM(file_size), 0) AS bytes,
            COUNT(*) AS count,
            SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) AS published,
            SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) AS unpublished
       FROM media WHERE status = 'ready'`,
  ).first<{ bytes: number; count: number; published: number; unpublished: number }>();

  const rows = await env.DB.prepare(
    `SELECT subject, COUNT(*) AS count, IFNULL(SUM(file_size), 0) AS bytes
       FROM media WHERE status = 'ready' GROUP BY subject`,
  ).all<{ subject: Subject; count: number; bytes: number }>();

  const bySubject = SUBJECTS.map((subject) => {
    const found = (rows.results ?? []).find((row) => row.subject === subject);
    return {
      subject,
      count: found?.count ?? 0,
      bytes: found?.bytes ?? 0,
    };
  });

  const usedBytes = Number(totals?.bytes ?? 0);
  return {
    usedBytes,
    fileCount: Number(totals?.count ?? 0),
    publishedCount: Number(totals?.published ?? 0),
    unpublishedCount: Number(totals?.unpublished ?? 0),
    quotaBytes: R2_FREE_STORAGE_BYTES,
    usedPercent: Math.min(100, Math.round((usedBytes / R2_FREE_STORAGE_BYTES) * 100)),
    bySubject,
  };
}

export type ParsedRange = { start: number; end: number } | 'invalid' | null;

/**
 * Parses a single-range `Range: bytes=...` header against a known size.
 *
 * - `null`   → no range, serve the whole object with 200.
 * - `invalid` → unsatisfiable, answer 416.
 */
export function parseRange(header: string | null, size: number): ParsedRange {
  if (!header) return null;

  const match = /^bytes=(.+)$/i.exec(header.trim());
  if (!match) return 'invalid';

  const spec = match[1].trim();
  // Multi-range requests are answered with the full object.
  if (spec.includes(',')) return null;

  const parts = /^(\d*)-(\d*)$/.exec(spec);
  if (!parts) return 'invalid';

  const [, rawStart, rawEnd] = parts;
  if (rawStart === '' && rawEnd === '') return 'invalid';

  if (rawStart === '') {
    // Suffix range: last N bytes.
    const suffix = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  if (!Number.isFinite(start) || start >= size) return 'invalid';

  if (rawEnd === '') {
    return { start, end: size - 1 };
  }

  const end = Number.parseInt(rawEnd, 10);
  if (!Number.isFinite(end) || end < start) return 'invalid';

  return { start, end: Math.min(end, size - 1) };
}

export interface MediaDeliveryOptions {
  /** Preview deliveries are private and never cached. */
  private?: boolean;
}

/**
 * Delivers a stored object with HTTP Range support so video seeking works in
 * the kiosk browser.
 */
export async function deliverMedia(
  env: Env,
  row: MediaRow,
  request: Request,
  options: MediaDeliveryOptions = {},
): Promise<Response> {
  const object = await env.MEDIA_BUCKET.get(row.object_key);
  if (!object) return notFound('The stored file is missing from object storage.');

  const size = object.size;
  const range = parseRange(request.headers.get('range'), size);

  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: {
        'content-range': `bytes */${size}`,
        'accept-ranges': 'bytes',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const baseHeaders: Record<string, string> = {
    'content-type': row.mime_type || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    'cache-control': options.private ? 'private, no-store' : 'public, max-age=3600',
    etag: object.httpEtag,
  };
  if (object.uploaded) {
    baseHeaders['last-modified'] = object.uploaded.toUTCString();
  }

  if (!range) {
    return new Response(object.body, { status: 200, headers: { ...baseHeaders, 'content-length': String(size) } });
  }

  const length = range.end - range.start + 1;
  const ranged = await env.MEDIA_BUCKET.get(row.object_key, {
    range: { offset: range.start, length },
  });

  if (!ranged) return notFound('The stored file is missing from object storage.');

  return new Response(ranged.body, {
    status: 206,
    headers: {
      ...baseHeaders,
      'content-length': String(length),
      'content-range': `bytes ${range.start}-${range.end}/${size}`,
    },
  });
}
