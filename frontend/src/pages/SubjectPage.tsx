import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { listPublishedMedia } from '../api';
import { ResourceCard } from '../components/ResourceCard';
import { TypeFilters } from '../components/TypeFilters';
import { useAsync } from '../hooks/useAsync';
import { subjectFromSlug, type MediaTypeFilter } from '../types';

export function SubjectPage() {
  const { slug = '' } = useParams();
  const subject = subjectFromSlug(slug);
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const type = (searchParams.get('type') ?? '') as MediaTypeFilter | '';

  const [searchText, setSearchText] = useState(query);
  useEffect(() => {
    setSearchText(query);
  }, [query]);

  // Keep the URL in sync so the browser back button works.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (searchText) next.set('q', searchText);
      else next.delete('q');
      if (searchText === query) return;
      setSearchParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, query, searchParams, setSearchParams]);

  const { data, error, loading } = useAsync(
    () => listPublishedMedia({ subject: subject ?? undefined, q: query, type }),
    [subject, query, type],
  );

  if (!subject) {
    return (
      <div className="empty-state">
        <h1 className="empty-state__title">Subject not found</h1>
        <p>Pick one of the four subjects from the home page.</p>
        <p style={{ marginTop: 'var(--space-3)' }}>
          <Link className="button button--soft" to="/">
            Back to home
          </Link>
        </p>
      </div>
    );
  }

  const items = data ?? [];

  return (
    <>
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="breadcrumbs__separator" aria-hidden="true">
          /
        </span>
        <span aria-current="page">{subject}</span>
      </nav>

      <div className="page-head">
        <h1 className="page-head__title">{subject}</h1>
        <p className="text-secondary text-small">
          {loading ? 'Loading…' : `${items.length} resource${items.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="toolbar">
        <div className="toolbar__search">
          <label className="visually-hidden" htmlFor="resource-search">
            Search resources
          </label>
          <input
            id="resource-search"
            className="input"
            type="search"
            placeholder={`Search ${subject.toLowerCase()} resources`}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <TypeFilters
          value={type}
          onChange={(next) => {
            const params = new URLSearchParams(searchParams);
            if (next) params.set('type', next);
            else params.delete('type');
            setSearchParams(params, { replace: true });
          }}
        />
      </div>

      {error ? (
        <p className="notice notice--error">Could not load resources: {error}</p>
      ) : loading ? (
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          Loading resources…
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2 className="empty-state__title">Nothing here yet</h2>
          <p>No published resources match this filter. New material appears as soon as it is published.</p>
        </div>
      ) : (
        <div className="resource-grid">
          {items.map((item) => (
            <ResourceCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p style={{ marginTop: 'var(--space-4)' }}>
        <Link className="button button--secondary button--small" to="/">
          ← All subjects
        </Link>
      </p>
    </>
  );
}
