import { useState, type FormEvent } from 'react';
import { ApiError, hospitalApi } from '../services/api';
import type { HospitalPanelSession } from '../types';

interface AuthGateProps {
  onAuthenticated: (session: HospitalPanelSession) => void;
}

function savedHospitalId(): string {
  try {
    return localStorage.getItem('medico-hospital-id') ?? '';
  } catch {
    return '';
  }
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [hospitalId, setHospitalId] = useState(savedHospitalId);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const submittedSession: HospitalPanelSession = {
      hospitalId: hospitalId.trim(),
      staffName: '',
      staffPassword: password,
    };

    try {
      const verifiedSession =
        await hospitalApi.validateSession(submittedSession);
      const session = {
        ...submittedSession,
        staffName: verifiedSession.staffName,
      };
      localStorage.setItem('medico-hospital-id', session.hospitalId);
      sessionStorage.setItem('medico-hospital-staff', session.staffName);
      sessionStorage.setItem(
        'medico-hospital-password',
        session.staffPassword,
      );
      onAuthenticated(session);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Unable to open this hospital workspace.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="gate-title">
        <div className="auth-brand">
          MEDICO <b>OPS</b>
        </div>

        <div className="auth-intro">
          <h1 id="gate-title">Staff sign in</h1>
          <p>Use your hospital ID and password to continue.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="hospital-id">
            Hospital ID
          </label>
          <input
            id="hospital-id"
            autoComplete="organization"
            value={hospitalId}
            onChange={(event) => setHospitalId(event.target.value)}
            placeholder="Enter hospital ID"
            required
          />

          <label className="field-label" htmlFor="staff-password">
            Password
          </label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            minLength={12}
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            required
          />

          {error && (
            <div className="form-error" role="alert">
              <span>{error}</span>
            </div>
          )}

          <button
            className="button button-primary auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
