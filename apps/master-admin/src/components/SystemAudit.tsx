import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { adminApi, ApiError } from '../services/api';
import type { AdminAuditLog } from '../types';

function describeAction(action: string) {
  const labels: Record<string, string> = {
    BED_INVENTORY_UPDATED: 'Bed inventory updated',
    DOCTOR_CREATED: 'Doctor added',
    DOCTOR_UPDATED: 'Doctor profile updated',
    HOSPITAL_VERIFICATION_UPDATED: 'Hospital verification changed',
  };
  return labels[action] ?? action.replaceAll('_', ' ').toLowerCase();
}

function payloadSummary(value: string) {
  try {
    const payload: unknown = JSON.parse(value);
    if (typeof payload !== 'object' || payload === null) return '';
    const details = payload as Record<string, unknown>;
    if (typeof details.category === 'string') {
      return `${details.category}${typeof details.department === 'string' ? ` · ${details.department}` : ''}`;
    }
    if (typeof details.status === 'string') return `Status: ${details.status}`;
    if (typeof details.specialty === 'string') return details.specialty;
    return '';
  } catch {
    return '';
  }
}

export function SystemAudit() {
  const [entries, setEntries] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await adminApi.getAuditLogs());
      setLastUpdated(new Date());
      setError('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to load audit activity.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="panel-section" aria-labelledby="audit-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">INTEGRITY / ACTIVITY</div>
          <h1 id="audit-title">System audit</h1>
          <p>Latest platform changes, across verified and pending hospitals.</p>
        </div>
        <button className="button button-outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="audit-meta">
        <span><Activity size={15} aria-hidden="true" /> Latest 50 events</span>
        {lastUpdated && <small>Checked {lastUpdated.toLocaleTimeString()}</small>}
      </div>
      {loading && entries.length === 0 && <div className="empty-state">Loading activity…</div>}
      {!loading && entries.length === 0 && !error && (
        <div className="empty-state">No audit activity has been recorded.</div>
      )}
      <ol className="audit-list">
        {entries.map((entry) => (
          <li className="audit-entry" key={entry.id}>
            <span className="audit-marker" aria-hidden="true" />
            <div className="audit-copy">
              <div className="audit-title-row">
                <strong>{describeAction(entry.actionType)}</strong>
                <time dateTime={entry.createdAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(entry.createdAt))}
                </time>
              </div>
              <span>{entry.hospitalName}</span>
              <small>
                {entry.actorId}
                {payloadSummary(entry.payload) && ` · ${payloadSummary(entry.payload)}`}
              </small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
