import type { Subject } from './types';

/** The only four subjects the portal supports. */
export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];

export function isSubject(value: string): value is Subject {
  return (SUBJECTS as string[]).includes(value);
}

/** MIME types the portal is willing to store. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp4',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
] as const;

/** Fallback MIME type for uploads whose browser type is not in the allow list. */
export const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * R2 requires every multipart part except the last one to be at least 5 MiB.
 * 8 MiB keeps us comfortably above that and keeps retry cost low.
 */
export const PART_SIZE = 8 * 1024 * 1024;

/** Files at or below this size are sent in a single request. */
export const SINGLE_UPLOAD_LIMIT = PART_SIZE;

/** Hard ceiling on the number of parts in one multipart upload. */
export const MAX_PARTS = 10_000;

/** Longest title / description we accept. */
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2_000;

/** Session cookie name. */
export const SESSION_COOKIE = 'portal_session';

/** Login throttling. */
export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_ATTEMPTS = 10;

export const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

/** R2 free tier: 10 GB-month of Standard storage. */
export const R2_FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
