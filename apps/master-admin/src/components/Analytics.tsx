import { useCallback, useEffect, useState } from 'react';
import { Activity, BedDouble, Building2, RefreshCw } from 'lucide-react';
import { adminApi, ApiError } from '../services/api';
import type { PlatformAnalytics } from '../types';

export function Analytics() {
  const [metrics, setMetrics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setMetrics(await adminApi.getAnalytics());
      setError('');
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Unable to load platform metrics.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void refresh();
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="panel-section" aria-labelledby="analytics-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CAPACITY / PLATFORM HEALTH</div>
          <h1 id="analytics-title">Platform analytics</h1>
          <p>Current verified hospital capacity and API query response.</p>
        </div>
        <button className="button button-outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={loading ? 'spin' : ''} size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-icon"><Building2 size={19} aria-hidden="true" /></span>
          <span className="metric-label">Active hospitals</span>
          <strong>{metrics?.activeHospitals ?? '—'}</strong>
          <small>Verified and public</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><BedDouble size={19} aria-hidden="true" /></span>
          <span className="metric-label">Available ICU beds</span>
          <strong>{metrics?.availableIcuBeds ?? '—'}</strong>
          <small>Across active hospitals</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><BedDouble size={19} aria-hidden="true" /></span>
          <span className="metric-label">Available general beds</span>
          <strong>{metrics?.availableGeneralBeds ?? '—'}</strong>
          <small>Across active hospitals</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon"><Activity size={19} aria-hidden="true" /></span>
          <span className="metric-label">API query response</span>
          <strong>{metrics ? `${metrics.responseLatencyMs} ms` : '—'}</strong>
          <small>Latest aggregate query</small>
        </article>
      </div>
      {loading && !metrics && <div className="empty-state">Loading platform metrics…</div>}
    </section>
  );
}
