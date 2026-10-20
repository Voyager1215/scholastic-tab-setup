import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" to="/">
            <span className="brand__logo">
              <img src="/scholastic-lockup.jpg" alt="Scholastic Science Academy" />
            </span>
          </Link>
          <nav className="inline-actions" aria-label="Primary">
            <Link className="button button--secondary button--small" to="/admin">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <span>Scholastic Science Academy — study materials, notes, diagrams and video lectures.</span>
          <span>Run entirely on free Cloudflare hosting.</span>
        </div>
      </footer>
    </div>
  );
}
