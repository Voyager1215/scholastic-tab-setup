import {
  ALLOWED_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DEFAULT_MIME_TYPE,
  MAX_DESCRIPTION_LENGTH,
  MAX_PARTS,
  MAX_TITLE_LENGTH,
  PART_SIZE,
  SINGLE_UPLOAD_LIMIT,
  isSubject,
} from './constants';
import { badRequest, json, notFound } from './http';
import { getMediaRow, toItem } from './media';
import type { Env, MediaItem, MediaRow, Subject, UploadSession } from './types';

const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

export interface CreateUploadRequest {
  title?: unknown;
  description?: unknown;
  subject?: unknown;
  fileName?: unknown;
  fileSize?: unknown;
  mimeType?: unknown;
  published?: unknown;
}

function maxUploadBytes(env: Env): number {
  const parsed = Number.parseInt(env.MAX_UPLOAD_BYTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

/** Derives a safe MIME type from the browser type, then from the extension. */
export function resolveMimeType(requested: unknown, fileName: string): string {
  const candidate = typeof requested === 'string' ? requested.split(';')[0].trim().toLowerCase() : '';
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(candidate)) return candidate;

  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  const byExtension = EXTENSION_TYPES[extension];
  if (byExtension) return byExtension;

  return DEFAULT_MIME_TYPE;
}

/** Builds the object key. The client never controls it. */
export function buildObjectKey(subject: Subject, id: string, fileName: string): string {
  const extension = (fileName.toLowerCase().split('.').pop() ?? '').replace(/[^a-z0-9]/g, '').slice(0, 8);
  const suffix = extension ? `.${extension}` : '';
  return `${subject.toLowerCase()}/${id}${suffix}`;
}

export interface CreatedUpload {
  session: UploadSession;
  row: MediaRow;
}

/**
 * Creates the metadata row and, for large files, the R2 multipart upload.
 */
export async function createUpload(env: Env, payload: CreateUploadRequest): Promise<CreatedUpload | Response> {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) return badRequest('A title is required.');
  if (title.length > MAX_TITLE_LENGTH) {
    return badRequest(`The title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return badRequest(`The description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);
  }

  const subject = typeof payload.subject === 'string' ? payload.subject : '';
  if (!isSubject(subject)) {
    return badRequest('Subject must be one of: Physics, Chemistry, Biology, Mathematics.');
  }

  const fileName = typeof payload.fileName === 'string' && payload.fileName.trim() ? payload.fileName.trim() : 'resource';
  const fileSize = typeof payload.fileSize === 'number' ? Math.floor(payload.fileSize) : Number.NaN;
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return badRequest('A file size is required.');
  }

  const limit = maxUploadBytes(env);
  if (fileSize > limit) {
    return badRequest(`The file is larger than the ${formatBytes(limit)} upload limit.`);
  }

  const mimeType = resolveMimeType(payload.mimeType, fileName);
  const published = payload.published === true ? 1 : 0;

  const id = crypto.randomUUID();
  const objectKey = buildObjectKey(subject, id, fileName);
  const multipart = fileSize > SINGLE_UPLOAD_LIMIT;
  const partCount = multipart ? Math.ceil(fileSize / PART_SIZE) : 1;

  if (partCount > MAX_PARTS) {
    return badRequest('The file has too many parts to upload.');
  }

  let uploadId: string | null = null;
  if (multipart) {
    const created = await env.MEDIA_BUCKET.createMultipartUpload(objectKey, {
      httpMetadata: { contentType: mimeType },
    });
    uploadId = created.uploadId;
  }

  await env.DB.prepare(
    `INSERT INTO media (id, title, description, subject, object_key, mime_type, file_size,
                        published, status, r2_upload_id, original_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      title,
      description || null,
      subject,
      objectKey,
      mimeType,
      0,
      published,
      'uploading',
      uploadId,
      fileName,
    )
    .run();

  const row = await getMediaRow(env, id);
  if (!row) return badRequest('Could not create the upload record.');

  return {
    session: {
      mediaId: id,
      mode: multipart ? 'multipart' : 'single',
      partSize: multipart ? PART_SIZE : 0,
      partCount,
      uploadId,
    },
    row,
  };
}

/** Stores a small file in one request and finalises the metadata row. */
export async function putSingleFile(env: Env, mediaId: string, request: Request): Promise<MediaItem | Response> {
  const row = await getMediaRow(env, mediaId);
  if (!row) return notFound('Upload session not found.');
  if (row.status !== 'uploading') return badRequest('This upload has already been completed.');

  const body = request.body;
  if (!body) return badRequest('The request body is empty.');

  const contentType = request.headers.get('content-type')?.split(';')[0].trim();
  const mimeType = contentType && contentType !== 'application/octet-stream' ? contentType : row.mime_type;

  await env.MEDIA_BUCKET.put(row.object_key, body, {
    httpMetadata: { contentType: mimeType },
  });

  const head = await env.MEDIA_BUCKET.head(row.object_key);
  const size = head?.size ?? row.file_size;

  await env.DB.prepare(
    `UPDATE media
        SET file_size = ?, mime_type = ?, status = 'ready', updated_at = datetime('now')
      WHERE id = ?`,
  )
    .bind(size, mimeType, mediaId)
    .run();

  const updated = await getMediaRow(env, mediaId);
  return toItem(updated as MediaRow);
}

/** Stores one part of a multipart upload. */
export async function putPart(
  env: Env,
  mediaId: string,
  partNumber: number,
  request: Request,
): Promise<{ partNumber: number; etag: string } | Response> {
  const row = await getMediaRow(env, mediaId);
  if (!row) return notFound('Upload session not found.');
  if (row.status !== 'uploading' || !row.r2_upload_id) {
    return badRequest('This upload is not accepting parts.');
  }
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_PARTS) {
    return badRequest('Invalid part number.');
  }
  if (!request.body) return badRequest('The request body is empty.');

  const upload = env.MEDIA_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
  const part = await upload.uploadPart(partNumber, request.body);

  return { partNumber: part.partNumber, etag: part.etag };
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

/** Completes a multipart upload and marks the resource as ready. */
export async function completeUpload(
  env: Env,
  mediaId: string,
  parts: CompletedPart[],
): Promise<MediaItem | Response> {
  const row = await getMediaRow(env, mediaId);
  if (!row) return notFound('Upload session not found.');
  if (row.status !== 'uploading') return badRequest('This upload has already been completed.');
  if (!row.r2_upload_id) return badRequest('This upload is not a multipart upload.');

  if (!Array.isArray(parts) || parts.length === 0) {
    return badRequest('A list of uploaded parts is required.');
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  for (const part of sorted) {
    if (!Number.isInteger(part.partNumber) || part.partNumber < 1 || typeof part.etag !== 'string') {
      return badRequest('Invalid part description.');
    }
  }
  if (sorted.length !== new Set(sorted.map((part) => part.partNumber)).size) {
    return badRequest('Duplicate part numbers.');
  }

  try {
    const upload = env.MEDIA_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
    await upload.complete(sorted.map((part) => ({ partNumber: part.partNumber, etag: part.etag })));
  } catch (error) {
    return badRequest(`Could not finalise the upload: ${(error as Error).message}`);
  }

  const head = await env.MEDIA_BUCKET.head(row.object_key);
  const size = head?.size ?? 0;
  if (size === 0) {
    return badRequest('The uploaded file is empty.');
  }

  await env.DB.prepare(
    `UPDATE media
        SET file_size = ?, status = 'ready', r2_upload_id = NULL, updated_at = datetime('now')
      WHERE id = ?`,
  )
    .bind(size, mediaId)
    .run();

  const updated = await getMediaRow(env, mediaId);
  return toItem(updated as MediaRow);
}

/** Cancels an upload and removes every trace of it. */
export async function abortUpload(env: Env, mediaId: string): Promise<Response> {
  const row = await getMediaRow(env, mediaId);
  if (!row) return notFound('Upload session not found.');

  if (row.r2_upload_id) {
    try {
      const upload = env.MEDIA_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
      await upload.abort();
    } catch {
      // The upload may already be gone; the row cleanup below still applies.
    }
  }
  try {
    await env.MEDIA_BUCKET.delete(row.object_key);
  } catch {
    // Nothing stored yet.
  }

  await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(mediaId).run();
  return json({ ok: true });
}

/**
 * Cron job: removes uploads that were started but never finished, so an
 * interrupted session cannot pin storage forever.
 */
export async function cleanupAbandonedUploads(env: Env, maxAgeHours = 24): Promise<number> {
  const stale = await env.DB.prepare(
    "SELECT id, object_key, r2_upload_id FROM media WHERE status = 'uploading' AND created_at < datetime('now', '-' || ? || ' hours')",
  )
    .bind(String(maxAgeHours))
    .all<{ id: string; object_key: string; r2_upload_id: string | null }>();

  const rows = stale.results ?? [];
  for (const row of rows) {
    if (row.r2_upload_id) {
      try {
        const upload = env.MEDIA_BUCKET.resumeMultipartUpload(row.object_key, row.r2_upload_id);
        await upload.abort();
      } catch {
        // Already gone.
      }
    }
    try {
      await env.MEDIA_BUCKET.delete(row.object_key);
    } catch {
      // Nothing stored.
    }
    await env.DB.prepare('DELETE FROM media WHERE id = ?').bind(row.id).run();
  }

  return rows.length;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
