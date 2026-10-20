import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="empty-state">
      <h1 className="empty-state__title">Page not found</h1>
      <p>The page you were looking for is not part of the portal.</p>
      <p style={{ marginTop: 'var(--space-3)' }}>
        <Link className="button button--soft" to="/">
          Back to home
        </Link>
      </p>
    </div>
  );
}
