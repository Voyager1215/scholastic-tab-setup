import { Link } from 'react-router-dom';
import { KIND_LABELS, formatBytes, mediaKind, type MediaItem } from '../types';
import { KindIcon } from './icons';

export function ResourceCard({ item }: { item: MediaItem }) {
  const kind = mediaKind(item.mimeType);

  return (
    <article className="resource-card">
      <div className="resource-card__head">
        <h3 className="resource-card__title">{item.title}</h3>
        <span className="badge" title={item.mimeType}>
          <KindIcon kind={kind} size={16} />
          {KIND_LABELS[kind]}
        </span>
      </div>

      {item.description ? <p className="resource-card__description">{item.description}</p> : <span />}

      <div className="resource-card__meta">
        <span>{item.subject}</span>
        <span aria-hidden="true">•</span>
        <span>{formatBytes(item.fileSize)}</span>
      </div>

      <Link className="button button--soft button--small" to={`/view/${item.id}`}>
        {kind === 'video' ? 'Play' : kind === 'image' ? 'View' : 'Open'}
      </Link>
    </article>
  );
}
