import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, FileText, RefreshCw, X } from 'lucide-react';
import { adminApi, ApiError } from '../services/api';
import type { AdminHospital } from '../types';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function HospitalQueue() {
  const [hospitals, setHospitals] = useState<AdminHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await adminApi.getPendingHospitals();
      setHospitals(result);
      setLastUpdated(new Date());
      setError('');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Unable to load the hospital queue.',
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
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function review(hospitalId: string, status: 'VERIFIED' | 'REJECTED') {
    setWorkingId(hospitalId);
    setError('');
    try {
      await adminApi.setVerification(hospitalId, status);
      setHospitals((current) =>
        current.filter((hospital) => hospital.id !== hospitalId),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Review could not be saved.',
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function openDocument(hospital: AdminHospital, documentId: string) {
    const preview = window.open('about:blank', '_blank');
    if (!preview) {
      setError('Allow pop-ups to open a secure document preview.');
      return;
    }
    setOpeningId(documentId);
    try {
      const { url } = await adminApi.getDocumentUrl(hospital.id, documentId);
      preview.opener = null;
      preview.location.replace(url);
    } catch (caught) {
      preview.close();
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The document could not be opened.',
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section className="panel-section" aria-labelledby="queue-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">GOVERNANCE / INTAKE</div>
          <h1 id="queue-title">Hospital verification</h1>
          <p>Review submitted registration details and legal documents.</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={loading ? 'spin' : ''} size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="queue-summary">
        <strong>{hospitals.length}</strong>
        <span>pending review</span>
        {lastUpdated && <small>Updated {formatDate(lastUpdated.toISOString())}</small>}
      </div>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading && hospitals.length === 0 && (
        <div className="empty-state">Loading registrations…</div>
      )}
      {!loading && hospitals.length === 0 && !error && (
        <div className="empty-state">
          <Check size={19} aria-hidden="true" />
          <span>All registrations have been reviewed.</span>
        </div>
      )}

      <div className="queue-list">
        {hospitals.map((hospital) => (
          <article className="queue-card" key={hospital.id}>
            <div className="queue-card-main">
              <div className="hospital-heading">
                <div>
                  <span className="status-dot pending" aria-hidden="true" />
                  <h2>{hospital.name}</h2>
                </div>
                <time dateTime={hospital.createdAt}>{formatDate(hospital.createdAt)}</time>
              </div>
              <p className="hospital-address">{hospital.address}</p>
              <div className="hospital-meta">
                <span>Hotline <a href={`tel:${hospital.hotlinePhone}`}>{hospital.hotlinePhone}</a></span>
                <span>
                  {Number(hospital.latitude).toFixed(4)}, {Number(hospital.longitude).toFixed(4)}
                </span>
              </div>
              <div className="documents">
                {hospital.documents.length ? (
                  hospital.documents.map((document) => (
                    <button
                      className="document-link"
                      key={document.id}
                      disabled={openingId === document.id}
                      onClick={() => void openDocument(hospital, document.id)}
                    >
                      <FileText size={16} aria-hidden="true" />
                      <span>{document.fileName}</span>
                      <small>{(document.fileSize / (1024 * 1024)).toFixed(1)} MB</small>
                      <ExternalLink size={14} aria-hidden="true" />
                    </button>
                  ))
                ) : (
                  <span className="no-documents">No legal documents submitted</span>
                )}
              </div>
            </div>
            <div className="review-actions">
              <button
                className="button button-approve"
                disabled={workingId === hospital.id}
                onClick={() => void review(hospital.id, 'VERIFIED')}
              >
                <Check size={16} aria-hidden="true" />
                Approve
              </button>
              <button
                className="button button-reject"
                disabled={workingId === hospital.id}
                onClick={() => void review(hospital.id, 'REJECTED')}
              >
                <X size={16} aria-hidden="true" />
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
