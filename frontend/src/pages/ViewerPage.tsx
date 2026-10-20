import { Link, useParams } from 'react-router-dom';
import { getPublishedMedia } from '../api';
import { PdfViewer } from '../components/PdfViewer';
import { useAsync } from '../hooks/useAsync';
import { isKioskWebView } from '../kiosk';
import { KIND_LABELS, formatBytes, mediaKind, subjectSlug } from '../types';

export function ViewerPage() {
  const { id = '' } = useParams();
  const { data: item, error, loading } = useAsync(() => getPublishedMedia(id), [id]);
  const kiosk = isKioskWebView();

  if (loading) {
    return (
      <div className="loading-row">
        <span className="spinner" aria-hidden="true" />
        Opening resource…
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="empty-state">
        <h1 className="empty-state__title">Resource unavailable</h1>
        <p>{error ?? 'This resource could not be found.'}</p>
        <p style={{ marginTop: 'var(--space-3)' }}>
          <Link className="button button--soft" to="/">
            Back to home
          </Link>
        </p>
      </div>
    );
  }

  const kind = mediaKind(item.mimeType);
  const backTo = `/subject/${subjectSlug(item.subject)}`;

  return (
    <div className="viewer">
      <div>
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumbs__separator" aria-hidden="true">
            /
          </span>
          <Link to={backTo}>{item.subject}</Link>
          <span className="breadcrumbs__separator" aria-hidden="true">
            /
          </span>
          <span aria-current="page">{item.title}</span>
        </nav>
        <h1 className="viewer__title">{item.title}</h1>
      </div>

      <div className="viewer__meta">
        <span className="badge">{KIND_LABELS[kind]}</span>
        <span>{formatBytes(item.fileSize)}</span>
        <span>{item.subject}</span>
      </div>

      {item.description ? <p className="text-secondary">{item.description}</p> : null}

      {kind === 'pdf' && kiosk ? (
        <PdfViewer url={item.url} title={item.title} />
      ) : (
        <div className="viewer__stage">
          {kind === 'pdf' ? (
            <iframe src={item.url} title={item.title} />
          ) : kind === 'image' ? (
            <img src={item.url} alt={item.title} />
          ) : kind === 'video' ? (
            <video src={item.url} controls preload="metadata" playsInline>
              Your browser cannot play this video.
            </video>
          ) : kind === 'audio' ? (
            <video src={item.url} controls preload="metadata" />
          ) : (
            <div className="stack" style={{ textAlign: 'center' }}>
              <p>This file type opens in a separate viewer.</p>
              <a className="button" href={item.url} download>
                Open {KIND_LABELS[kind].toLowerCase()}
              </a>
            </div>
          )}
        </div>
      )}

      <div className="inline-actions">
        <Link className="button button--secondary" to={backTo}>
          ← Back to {item.subject}
        </Link>
        <a className="button button--soft" href={item.url} download>
          Download
        </a>
      </div>
    </div>
  );
}
