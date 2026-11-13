import { useEffect, useState, type FormEvent } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Analytics } from './components/Analytics';
import { HospitalQueue } from './components/HospitalQueue';
import { Navbar } from './components/Navbar';
import { SystemAudit } from './components/SystemAudit';
import { adminApi, ApiError } from './services/api';
import type { AdminSection } from './types';

interface AdminSession {
  username: string;
}

function SignIn({
  onSignedIn,
}: {
  onSignedIn: (session: AdminSession) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSignedIn(await adminApi.login(username.trim(), password));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin-shell">
      <section className="signin-card">
        <a className="brand signin-brand" href="/master-medico-admin">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>MEDICO <small>OVERSIGHT</small></span>
        </a>
        <div className="signin-icon"><ShieldCheck size={23} aria-hidden="true" /></div>
        <div className="eyebrow">MASTER ADMIN</div>
        <h1>Platform oversight</h1>
        <p>Sign in to review hospital registrations and platform activity.</p>
        <form className="signin-form" onSubmit={(event) => void submit(event)}>
          <label>
            Username
            <input
              autoComplete="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <button className="button button-primary signin-button" disabled={busy}>
            <LockKeyhole size={16} aria-hidden="true" />
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="signin-note">Authorized administrators only</div>
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [section, setSection] = useState<AdminSection>('queue');
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.location.pathname !== '/master-medico-admin') {
      window.history.replaceState(null, '', '/master-medico-admin');
    }
    let active = true;
    void adminApi.getSession()
      .then((currentSession) => {
        if (active) setSession(currentSession);
      })
      .catch((caught: unknown) => {
        if (active && !(caught instanceof ApiError && caught.status === 401)) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'Unable to reach the admin service.',
          );
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    try {
      await adminApi.logout();
      setSession(null);
      setError('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Sign out could not be confirmed.',
      );
    }
  }

  if (checking) {
    return (
      <main className="loading-screen" aria-live="polite">
        <span className="brand-mark" aria-hidden="true">+</span>
        <span>Checking access…</span>
      </main>
    );
  }

  if (!session) {
    return (
      <>
        {error && <div className="signin-connection-error" role="alert">{error}</div>}
        <SignIn onSignedIn={setSession} />
      </>
    );
  }

  return (
    <div className="admin-shell">
      <Navbar
        activeSection={section}
        username={session.username}
        onNavigate={setSection}
        onSignOut={() => void signOut()}
      />
      <main className="admin-main">
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {section === 'queue' && <HospitalQueue />}
        {section === 'audit' && <SystemAudit />}
        {section === 'analytics' && <Analytics />}
        <footer className="admin-footer">
          <span>MEDICO PLATFORM</span>
          <span>Verification · Integrity · Capacity</span>
        </footer>
      </main>
    </div>
  );
}
