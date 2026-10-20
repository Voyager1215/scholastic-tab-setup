export type Subject = 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics';

export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Biology', 'Mathematics'];

export type MediaTypeFilter = 'pdf' | 'image' | 'video' | 'audio' | 'document' | 'other';

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  subject: Subject;
  mimeType: string;
  fileSize: number;
  published: boolean;
  status: 'uploading' | 'ready';
  createdAt: string;
  updatedAt: string;
  url: string;
  previewUrl: string;
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

export interface UploadSession {
  mediaId: string;
  mode: 'single' | 'multipart';
  partSize: number;
  partCount: number;
  item: MediaItem;
}

export function subjectSlug(subject: string): string {
  return subject.toLowerCase();
}

export function subjectFromSlug(slug: string): Subject | null {
  const found = SUBJECTS.find((subject) => subjectSlug(subject) === slug.toLowerCase());
  return found ?? null;
}

/** Human readable file type from a MIME type. */
export function mediaKind(mimeType: string): 'pdf' | 'image' | 'video' | 'audio' | 'document' | 'other' {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/') || mimeType.includes('word') || mimeType.includes('pdf') || mimeType.includes('officedocument')) {
    return 'document';
  }
  return 'other';
}

export const KIND_LABELS: Record<ReturnType<typeof mediaKind>, string> = {
  pdf: 'PDF',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  other: 'File',
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
