import { formatBytes, type StorageStats } from '../types';

export function StoragePanel({ stats }: { stats: StorageStats | null }) {
  if (!stats) {
    return (
      <section className="admin-section">
        <h2 className="admin-section__title">Storage</h2>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          Loading usage…
        </div>
      </section>
    );
  }

  const percent = Math.min(100, stats.usedPercent);
  const meterClass =
    percent >= 90 ? 'storage-meter__fill storage-meter__fill--full' : percent >= 70 ? 'storage-meter__fill storage-meter__fill--warn' : 'storage-meter__fill';

  return (
    <section className="admin-section">
      <h2 className="admin-section__title">Storage</h2>

      <div className="stack">
        <div>
          <div className="storage-meter" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={meterClass} style={{ width: `${percent}%` }} />
          </div>
          <p className="text-secondary text-small" style={{ marginTop: 'var(--space-1)' }}>
            {formatBytes(stats.usedBytes)} of {formatBytes(stats.quotaBytes)} free-tier storage used ({percent}%)
          </p>
        </div>

        <ul className="storage-rows">
          <li className="storage-rows__row">
            <dt>Files</dt>
            <dd>{stats.fileCount}</dd>
          </li>
          <li className="storage-rows__row">
            <dt>Published</dt>
            <dd>{stats.publishedCount}</dd>
          </li>
          <li className="storage-rows__row">
            <dt>Drafts</dt>
            <dd>{stats.unpublishedCount}</dd>
          </li>
        </ul>

        <ul className="storage-rows">
          {stats.bySubject.map((entry) => (
            <li className="storage-rows__row" key={entry.subject}>
              <dt>{entry.subject}</dt>
              <dd>
                {entry.count} · {formatBytes(entry.bytes)}
              </dd>
            </li>
          ))}
        </ul>

        {percent >= 70 ? (
          <p className="notice notice--warning">
            Storage is above 70% of the free R2 allowance. Archive old videos before adding more.
          </p>
        ) : null}
      </div>
    </section>
  );
}
