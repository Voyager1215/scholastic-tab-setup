import { useState, type FormEvent } from 'react';
import { ApiError, login } from '../api';

export function AdminLogin({ onSignedIn }: { onSignedIn: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      onSignedIn(username.trim());
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login">
      <img
        className="admin-login__logo"
        src="/scholastic-lockup.jpg"
        alt="Scholastic Science Academy"
      />
      <h1 className="admin-login__title">Administrator sign in</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="admin-username">
            Username
          </label>
          <input
            id="admin-username"
            className="input"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="admin-password">
            Password
          </label>
          <input
            id="admin-password"
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error ? <p className="notice notice--error">{error}</p> : null}

        <button className="button" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
