import { abortUpload, completeUpload, startUpload } from './api';
import type { MediaItem, Subject, UploadSession } from './types';

export interface UploadProgress {
  /** Bytes transferred so far, across all parts. */
  loaded: number;
  /** Total bytes of the file. */
  total: number;
  /** 0-100. */
  percent: number;
  /** Human readable status, e.g. "Part 3 of 12". */
  label: string;
}

export interface UploadRequest {
  title: string;
  description: string;
  subject: Subject;
  published: boolean;
}

const PART_RETRIES = 3;

interface XhrResult {
  status: number;
  text: string;
}

/**
 * XMLHttpRequest is used instead of fetch because it reports upload progress,
 * which matters for multi-hundred-megabyte videos on a tablet.
 */
function xhrRequest(
  url: string,
  method: string,
  body: Blob,
  onProgress?: (loaded: number) => void,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url, true);
    request.withCredentials = true;
    request.setRequestHeader('content-type', 'application/octet-stream');

    request.upload.onprogress = (event) => {
      if (onProgress) onProgress(event.loaded);
    };

    request.onload = () => resolve({ status: request.status, text: request.responseText });
    request.onerror = () => reject(new Error('Network error while uploading.'));
    request.onabort = () => reject(new Error('Upload cancelled.'));

    request.send(body);
  });
}

function parseError(text: string, fallback: string): string {
  try {
    const body = JSON.parse(text) as { message?: string };
    return body?.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Uploads a file, using a single request for small files and a resumable
 * multipart upload with per-part retry for large ones.
 */
export async function uploadFile(
  request: UploadRequest,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<MediaItem> {
  const session: UploadSession = await startUpload({
    title: request.title,
    description: request.description,
    subject: request.subject,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    published: request.published,
  });

  try {
    if (session.mode === 'single') {
      return await uploadSingle(session, file, onProgress);
    }
    return await uploadMultipart(session, file, onProgress);
  } catch (error) {
    // Remove the half-finished upload so it does not pin storage.
    await abortUpload(session.mediaId).catch(() => undefined);
    throw error;
  }
}

async function uploadSingle(
  session: UploadSession,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<MediaItem> {
  const result = await xhrRequest(`/api/admin/uploads/${session.mediaId}/file`, 'PUT', file, (loaded) => {
    onProgress({ loaded, total: file.size, percent: percent(loaded, file.size), label: 'Uploading' });
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(parseError(result.text, `Upload failed (${result.status}).`));
  }

  const body = JSON.parse(result.text) as { item: MediaItem };
  onProgress({ loaded: file.size, total: file.size, percent: 100, label: 'Finalising' });
  return body.item;
}

async function uploadMultipart(
  session: UploadSession,
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<MediaItem> {
  const partSize = session.partSize;
  const total = file.size;
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let uploadedBefore = 0;

  for (let index = 0; index < session.partCount; index += 1) {
    const partNumber = index + 1;
    const start = index * partSize;
    const end = Math.min(start + partSize, total);
    const blob = file.slice(start, end);

    const etag = await uploadPartWithRetry(session.mediaId, partNumber, blob, (loaded) => {
      onProgress({
        loaded: uploadedBefore + loaded,
        total,
        percent: percent(uploadedBefore + loaded, total),
        label: `Part ${partNumber} of ${session.partCount}`,
      });
    });

    parts.push({ partNumber, etag });
    uploadedBefore += blob.size;
  }

  onProgress({ loaded: total, total, percent: 100, label: 'Finalising' });
  return completeUpload(session.mediaId, parts);
}

async function uploadPartWithRetry(
  mediaId: string,
  partNumber: number,
  blob: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  let lastError = '';

  for (let attempt = 1; attempt <= PART_RETRIES; attempt += 1) {
    try {
      const result = await xhrRequest(
        `/api/admin/uploads/${mediaId}/parts/${partNumber}`,
        'PUT',
        blob,
        onProgress,
      );

      if (result.status >= 200 && result.status < 300) {
        const body = JSON.parse(result.text) as { etag: string };
        return body.etag;
      }

      lastError = parseError(result.text, `Part ${partNumber} failed (${result.status}).`);
      // 4xx errors will not fix themselves.
      if (result.status >= 400 && result.status < 500) break;
    } catch (error) {
      lastError = (error as Error).message;
    }

    if (attempt < PART_RETRIES) {
      await delay(500 * attempt);
    }
  }

  throw new Error(lastError || `Part ${partNumber} could not be uploaded.`);
}

function percent(loaded: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
