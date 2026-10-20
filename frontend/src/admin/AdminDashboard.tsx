import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, deleteMedia, listAdminMedia, logout, patchMedia, storageStats } from '../api';
import { SUBJECTS, type MediaItem, type StorageStats, type Subject } from '../types';
import { EditDialog } from './EditDialog';
import { ResourceTable } from './ResourceTable';
import { StoragePanel } from './StoragePanel';
import { UploadPanel } from './UploadPanel';

export type StatusFilter = 'all' | 'published' | 'draft';

export function AdminDashboard({
  username,
  onSignedOut,
}: {
  username: string;
  onSignedOut: () => void;
}) {
  const [subjectFilter, setSubjectFilter] = useState<Subject | ''>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);

  // Debounce the search box so every keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const refresh = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const [list, storage] = await Promise.all([
        listAdminMedia({ subject: subjectFilter || undefined, q: query || undefined }),
        storageStats(),
      ]);
      setItems(list);
      setStats(storage);
    } catch (cause) {
      setListError(cause instanceof ApiError ? cause.message : 'Could not load the resource list.');
    } finally {
      setListLoading(false);
    }
  }, [subjectFilter, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    if (statusFilter === 'published') return items.filter((item) => item.published);
    if (statusFilter === 'draft') return items.filter((item) => !item.published);
    return items;
  }, [items, statusFilter]);

  async function togglePublished(item: MediaItem) {
    setBusyId(item.id);
    try {
      await patchMedia(item.id, { published: !item.published });
      await refresh();
    } catch (cause) {
      setListError(cause instanceof ApiError ? cause.message : 'Could not update the resource.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setBusyId(target.id);
    try {
      await deleteMedia(target.id);
      setDeleting(null);
      await refresh();
    } catch (cause) {
      setListError(cause instanceof ApiError ? cause.message : 'Could not delete the resource.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSignOut() {
    await logout().catch(() => undefined);
    onSignedOut();
  }

  return (
    <div className="admin-shell">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Admin dashboard</h1>
          <p className="text-secondary text-small">Signed in as {username}</p>
        </div>
        <button className="button button--secondary button--small" type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>

      {listError ? <p className="notice notice--error">{listError}</p> : null}

      <div className="admin-grid">
        <div className="stack">
          <UploadPanel
            onUploaded={() => {
              setSearch('');
              void refresh();
            }}
          />

          <section className="admin-section">
            <div className="admin-section__head">
              <h2 className="admin-section__title">Resources</h2>
              <span className="text-secondary text-small">
                {visible.length} shown
              </span>
            </div>

            <div className="toolbar">
              <div className="toolbar__search">
                <label className="visually-hidden" htmlFor="admin-search">
                  Search resources
                </label>
                <input
                  id="admin-search"
                  className="input"
                  type="search"
                  placeholder="Search by title or description"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="visually-hidden" htmlFor="admin-subject">
                  Subject
                </label>
                <select
                  id="admin-subject"
                  className="select"
                  value={subjectFilter}
                  onChange={(event) => setSubjectFilter(event.target.value as Subject | '')}
                >
                  <option value="">All subjects</option>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group" role="group" aria-label="Filter by status">
                {(['all', 'published', 'draft'] as StatusFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className="filter-chip"
                    aria-pressed={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {value === 'all' ? 'All' : value === 'published' ? 'Published' : 'Drafts'}
                  </button>
                ))}
              </div>
            </div>

            {listLoading ? (
              <div className="loading-row">
                <span className="spinner" aria-hidden="true" />
                Loading resources…
              </div>
            ) : visible.length === 0 ? (
              <div className="empty-state">
                <h3 className="empty-state__title">No resources yet</h3>
                <p>Upload the first resource using the form above.</p>
              </div>
            ) : (
              <ResourceTable
                items={visible}
                busyId={busyId}
                onTogglePublished={togglePublished}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            )}
          </section>
        </div>

        <StoragePanel stats={stats} />
      </div>

      {editing ? (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setDeleting(null)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="dialog__title" id="delete-title">
              Delete “{deleting.title}”?
            </h2>
            <p className="text-secondary">
              The stored file is removed as well. This cannot be undone.
            </p>
            <div className="dialog__actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
              <button
                className="button button--danger"
                type="button"
                onClick={confirmDelete}
                disabled={busyId === deleting.id}
              >
                {busyId === deleting.id ? 'Deleting…' : 'Delete resource'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
