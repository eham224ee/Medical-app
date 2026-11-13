import { useMemo, useState } from 'react';
import { BedDouble, Minus, Plus, RefreshCw } from 'lucide-react';
import type { BedInventory, BedStatus } from '../types';

interface BedMatrixProps {
  beds: BedInventory[];
  isLoading: boolean;
  onAdjust: (
    bedId: string,
    operation: 'increment' | 'decrement',
  ) => Promise<boolean>;
}

const statusCopy: Record<BedStatus, string> = {
  HIGH_AVAILABILITY: 'Available',
  LIMITED: 'Limited',
  FULL: 'Full',
  UNVERIFIED: 'Unverified',
};

function statusFor(bed: BedInventory): BedStatus {
  if (bed.statusCode === 'UNVERIFIED') return 'UNVERIFIED';
  if (bed.availableCount === 0) return 'FULL';
  if (bed.availableCount / Math.max(bed.totalCount, 1) <= 0.2) return 'LIMITED';
  return 'HIGH_AVAILABILITY';
}

function formatUpdated(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return `Updated ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function BedMatrix({ beds, isLoading, onAdjust }: BedMatrixProps) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const groupedBeds = useMemo(() => {
    const groups = new Map<string, BedInventory[]>();
    for (const bed of beds) {
      const current = groups.get(bed.department) ?? [];
      current.push(bed);
      groups.set(bed.department, current);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [beds]);

  async function adjust(
    bed: BedInventory,
    operation: 'increment' | 'decrement',
  ) {
    setPendingIds((current) => new Set(current).add(bed.id));
    try {
      await onAdjust(bed.id, operation);
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(bed.id);
        return next;
      });
    }
  }

  const totalAvailable = beds.reduce((sum, bed) => sum + bed.availableCount, 0);
  const totalBeds = beds.reduce((sum, bed) => sum + bed.totalCount, 0);

  return (
    <section className="panel-section" aria-labelledby="bed-section-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CAPACITY CONTROL</div>
          <h2 id="bed-section-title">Bed inventory</h2>
          <p>Update availability as patients are admitted or discharged.</p>
        </div>
        <div className="capacity-summary">
          <div>
            <strong>{totalAvailable}</strong>
            <span>AVAILABLE</span>
          </div>
          <span className="summary-slash">/</span>
          <div>
            <strong>{totalBeds}</strong>
            <span>TOTAL BEDS</span>
          </div>
        </div>
      </div>

      {isLoading && beds.length === 0 ? (
        <div className="loading-panel">
          <RefreshCw className="spin" size={22} aria-hidden="true" />
          <span>Loading bed inventory…</span>
        </div>
      ) : beds.length === 0 ? (
        <div className="empty-panel">
          <BedDouble size={30} aria-hidden="true" />
          <strong>No bed inventory yet</strong>
          <span>
            Inventory records will appear here when added by your administrator.
          </span>
        </div>
      ) : (
        <div className="department-list">
          {groupedBeds.map(([department, departmentBeds]) => (
            <div className="department-group" key={department}>
              <div className="department-heading">
                <span>{department}</span>
                <span>
                  {departmentBeds.length}{' '}
                  {departmentBeds.length === 1 ? 'unit' : 'units'}
                </span>
              </div>
              <div className="bed-grid">
                {departmentBeds.map((bed) => {
                  const status = statusFor(bed);
                  const pending = pendingIds.has(bed.id);
                  const canIncrease = bed.availableCount < bed.totalCount;
                  const canDecrease = bed.availableCount > 0;
                  return (
                    <article
                      className={`bed-card bed-card-${status.toLowerCase()}`}
                      key={bed.id}
                    >
                      <div className="bed-card-top">
                        <div>
                          <span className="bed-category">{bed.category}</span>
                          <span
                            className={`availability-pill availability-${status.toLowerCase()}`}
                          >
                            <i className="legend-dot" />
                            {statusCopy[status]}
                          </span>
                        </div>
                        {pending && (
                          <RefreshCw
                            className="sync-icon spin"
                            size={17}
                            aria-label="Syncing update"
                          />
                        )}
                      </div>

                      <div className="bed-counter">
                        <span className="counter-value" aria-live="polite">
                          {bed.availableCount}
                        </span>
                        <span className="counter-total">
                          / {bed.totalCount} beds free
                        </span>
                      </div>

                      <div className="bed-controls">
                        <button
                          className="count-button count-decrease"
                          aria-label={`Decrease ${bed.category} ${department} available beds`}
                          disabled={pending || !canDecrease}
                          onClick={() => void adjust(bed, 'decrement')}
                        >
                          <Minus
                            size={24}
                            strokeWidth={2.8}
                            aria-hidden="true"
                          />
                        </button>
                        <span className="count-instruction">ADJUST COUNT</span>
                        <button
                          className="count-button count-increase"
                          aria-label={`Increase ${bed.category} ${department} available beds`}
                          disabled={pending || !canIncrease}
                          onClick={() => void adjust(bed, 'increment')}
                        >
                          <Plus
                            size={24}
                            strokeWidth={2.8}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      <div className="bed-updated">
                        {formatUpdated(bed.lastUpdatedAt)}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
