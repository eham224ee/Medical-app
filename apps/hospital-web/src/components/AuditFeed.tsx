import { ClipboardList, RefreshCw } from 'lucide-react';
import type { AuditLog } from '../types';

interface AuditFeedProps {
  entries: AuditLog[];
  isLoading: boolean;
}

function payloadFor(entry: AuditLog): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(entry.payload);
    return typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function description(entry: AuditLog) {
  const payload = payloadFor(entry);
  const category = typeof payload.category === 'string' ? payload.category : '';
  const department =
    typeof payload.department === 'string' ? payload.department : '';
  const specialty =
    typeof payload.specialty === 'string' ? payload.specialty : '';

  if (entry.actionType === 'BED_INVENTORY_UPDATED') {
    const count =
      typeof payload.availableCount === 'number'
        ? payload.availableCount
        : 'updated';
    const bedLabel = [category, department].filter(Boolean).join(' · ');
    return `${bedLabel || 'Bed inventory'} set to ${count} available`;
  }
  if (entry.actionType === 'DOCTOR_CREATED') {
    return `New ${specialty || 'doctor'} added to the roster`;
  }
  if (entry.actionType === 'DOCTOR_UPDATED') {
    return `${specialty || 'Doctor'} profile or availability updated`;
  }
  return entry.actionType.replaceAll('_', ' ').toLowerCase();
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function AuditFeed({ entries, isLoading }: AuditFeedProps) {
  return (
    <section className="audit-panel" aria-labelledby="audit-title">
      <div className="audit-heading">
        <div>
          <div className="eyebrow">ACCOUNTABILITY</div>
          <h2 id="audit-title">Recent activity</h2>
        </div>
        <RefreshCw
          className={isLoading ? 'spin' : ''}
          size={17}
          aria-label={isLoading ? 'Refreshing activity' : undefined}
        />
      </div>

      {entries.length === 0 ? (
        <div className="audit-empty">
          <ClipboardList size={23} aria-hidden="true" />
          <span>No staff activity recorded yet.</span>
        </div>
      ) : (
        <ol className="audit-list">
          {entries.map((entry) => (
            <li className="audit-entry" key={entry.id}>
              <span
                className={`audit-marker ${entry.actionType.startsWith('BED_') ? 'audit-marker-bed' : 'audit-marker-doctor'}`}
              />
              <div className="audit-copy">
                <strong>{description(entry)}</strong>
                <span>{entry.actorId}</span>
              </div>
              <time dateTime={entry.createdAt}>{timeAgo(entry.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
      <div className="audit-footer">Updates are recorded automatically</div>
    </section>
  );
}
