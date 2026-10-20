import type { Subject } from '../types';

interface IconProps {
  size?: number;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Line icons for the four subjects. */
export function SubjectIcon({ subject, size = 32 }: { subject: Subject } & IconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const };

  switch (subject) {
    case 'Physics':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.6" {...base} />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" {...base} />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" {...base} />
          <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" {...base} />
        </svg>
      );
    case 'Chemistry':
      return (
        <svg {...common}>
          <path d="M9 3h6" {...base} />
          <path d="M10 3v6.4L4.9 18a2 2 0 0 0 1.7 3h10.8a2 2 0 0 0 1.7-3L14 9.4V3" {...base} />
          <path d="M7.4 15h9.2" {...base} />
        </svg>
      );
    case 'Biology':
      return (
        <svg {...common}>
          <path d="M5 19c0-8 5-13 14-14 0 10-5 14-11 14H5Z" {...base} />
          <path d="M5 19c4-4 7-6 11-7" {...base} />
        </svg>
      );
    case 'Mathematics':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2.5" {...base} />
          <path d="M8 7.5h8" {...base} />
          <path d="M8 12h2M14 12h2M8 16.5h2M14 16.5h2" {...base} />
        </svg>
      );
    default:
      return null;
  }
}

/** Small document-type glyph used on resource cards. */
export function KindIcon({ kind, size = 24 }: { kind: string; size?: number } & IconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const };

  switch (kind) {
    case 'pdf':
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" {...base} />
          <path d="M14 3v5h5" {...base} />
        </svg>
      );
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" {...base} />
          <circle cx="8.5" cy="9.5" r="1.6" {...base} />
          <path d="m4 17 4.5-4.5 3.5 3.5L15 13l5 5" {...base} />
        </svg>
      );
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" {...base} />
          <path d="m16 11 5-3v8l-5-3Z" {...base} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" {...base} />
          <path d="M14 3v5h5" {...base} />
        </svg>
      );
  }
}
