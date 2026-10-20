/**
 * Shared types for the portal Worker.
 *
 * The API contract between this Worker and the React frontend lives here so
 * both sides stay in sync. The frontend mirrors these shapes in
 * `frontend/src/types.ts`.
 */

export interface Env {
  /** D1 database holding media metadata, admins and sessions. */
  DB: D1Database;
  /** Private R2 bucket holding the actual files. */
  MEDIA_BUCKET: R2Bucket;
  /** Static assets (the built React app). */
  ASSETS: Fetcher;
  /** Optional bootstrap administrator, used only while the admins table is empty. */
  ADMIN_BOOTSTRAP_USER?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  /** Maximum accepted upload size in bytes. */
  MAX_UPLOAD_BYTES?: string;
  /** Session lifetime in days. */
  SESSION_TTL_DAYS?: string;
  /** Extra origins allowed to call the API (comma separated). */
  ALLOWED_ORIGINS?: string;
}

export type Subject = 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics';

export type MediaStatus = 'uploading' | 'ready';

export interface MediaRow {
  id: string;
  title: string;
  description: string | null;
  subject: Subject;
  object_key: string;
  mime_type: string;
  file_size: number;
  published: number;
  status: MediaStatus;
  r2_upload_id: string | null;
  original_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned to the browser. */
export interface MediaItem {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  mimeType: string;
  fileSize: number;
  published: boolean;
  status: MediaStatus;
  createdAt: string;
  updatedAt: string;
  /** Public delivery URL, served with HTTP Range support. */
  url: string;
  /** Admin-only delivery URL, works for unpublished items as well. */
  previewUrl: string;
}

export interface AdminUser {
  id: string;
  username: string;
}

export interface UploadSession {
  mediaId: string;
  mode: 'single' | 'multipart';
  partSize: number;
  partCount: number;
  /** R2 multipart upload id, only present in multipart mode. */
  uploadId: string | null;
}
