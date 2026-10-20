import { KIND_LABELS, formatBytes, formatDate, mediaKind, type MediaItem } from '../types';

export function ResourceTable({
  items,
  busyId,
  onTogglePublished,
  onEdit,
  onDelete,
}: {
  items: MediaItem[];
  busyId: string | null;
  onTogglePublished: (item: MediaItem) => void;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Subject</th>
            <th scope="col">Type</th>
            <th scope="col">Size</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const kind = mediaKind(item.mimeType);
            const busy = busyId === item.id;
            return (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>
                  {item.description ? (
                    <div className="text-secondary text-small">{item.description}</div>
                  ) : null}
                </td>
                <td>{item.subject}</td>
                <td>{KIND_LABELS[kind]}</td>
                <td>{formatBytes(item.fileSize)}</td>
                <td>
                  {item.published ? (
                    <span className="badge badge--published">Published</span>
                  ) : (
                    <span className="badge badge--draft">Draft</span>
                  )}
                  {item.status === 'uploading' ? (
                    <span className="badge badge--muted">Uploading</span>
                  ) : null}
                </td>
                <td className="text-secondary text-small">{formatDate(item.updatedAt)}</td>
                <td>
                  <div className="data-table__actions">
                    <a
                      className="button button--secondary button--small"
                      href={item.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>
                    <button
                      className="button button--soft button--small"
                      type="button"
                      onClick={() => onTogglePublished(item)}
                      disabled={busy}
                    >
                      {item.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() => onEdit(item)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      className="button button--danger button--small"
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
