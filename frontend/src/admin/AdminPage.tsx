import { useEffect, useState } from 'react';
import { currentSession } from '../api';
import { AdminDashboard } from './AdminDashboard';
import { AdminLogin } from './AdminLogin';

export function AdminPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    currentSession()
      .then((name) => {
        if (active) setUsername(name);
      })
      .catch(() => {
        if (active) setUsername(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="loading-row">
        <span className="spinner" aria-hidden="true" />
        Checking the session…
      </div>
    );
  }

  if (!username) {
    return <AdminLogin onSignedIn={setUsername} />;
  }

  return <AdminDashboard username={username} onSignedOut={() => setUsername(null)} />;
}
