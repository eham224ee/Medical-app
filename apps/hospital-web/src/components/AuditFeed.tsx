import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  X,
} from "lucide-react";
import type { AuditLog } from "../types";

const PAGE_SIZE = 10;

interface AuditFeedProps {
  entries: AuditLog[];
  isLoading: boolean;
  onFetchPage: (offset: number, limit: number) => Promise<AuditLog[]>;
}

function payloadFor(entry: AuditLog): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(entry.payload);
    return typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function description(entry: AuditLog) {
  const payload = payloadFor(entry);
  const category = typeof payload.category === "string" ? payload.category : "";
  const department =
    typeof payload.department === "string" ? payload.department : "";
  const specialty =
    typeof payload.specialty === "string" ? payload.specialty : "";

  if (entry.actionType === "BED_INVENTORY_UPDATED") {
    const count =
      typeof payload.availableCount === "number"
        ? payload.availableCount
        : "updated";
    const bedLabel = [category, department].filter(Boolean).join(" · ");
    return `${bedLabel || "Bed inventory"} set to ${count} available`;
  }
  if (entry.actionType === "DOCTOR_CREATED") {
    return `New ${specialty || "doctor"} added to the roster`;
  }
  if (entry.actionType === "DOCTOR_UPDATED") {
    return `${specialty || "Doctor"} profile or availability updated`;
  }
  return entry.actionType.replaceAll("_", " ").toLowerCase();
}

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function AuditEntries({ entries }: { entries: AuditLog[] }) {
  return (
    <ol className="audit-list">
      {entries.map((entry) => (
        <li className="audit-entry" key={entry.id}>
          <span
            className={`audit-marker ${entry.actionType.startsWith("BED_") ? "audit-marker-bed" : "audit-marker-doctor"}`}
          />
          <div className="audit-copy">
            <strong>{description(entry)}</strong>
            <span>{entry.actorId}</span>
          </div>
          <time dateTime={entry.createdAt}>{timeAgo(entry.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}

export function AuditFeed({ entries, isLoading, onFetchPage }: AuditFeedProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEntries, setModalEntries] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(0);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isModalOpen]);

  async function loadPage(nextPage: number) {
    setIsPageLoading(true);
    setPageError(null);
    try {
      const result = await onFetchPage(nextPage * PAGE_SIZE, PAGE_SIZE + 1);
      setModalEntries(result);
      setPage(nextPage);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to load audit logs.",
      );
    } finally {
      setIsPageLoading(false);
    }
  }

  function openModal() {
    setIsModalOpen(true);
    setModalEntries([]);
    setPage(0);
    void loadPage(0);
  }

  return (
    <section className="audit-panel" aria-labelledby="audit-title">
      <div className="audit-heading">
        <div>
          <div className="eyebrow">ACCOUNTABILITY</div>
          <h2 id="audit-title">Recent activity</h2>
        </div>
        <RefreshCw
          className={isLoading ? "spin" : ""}
          size={17}
          aria-label={isLoading ? "Refreshing activity" : undefined}
        />
      </div>

      {entries.length === 0 ? (
        <div className="audit-empty">
          <ClipboardList size={23} aria-hidden="true" />
          <span>No staff activity recorded yet.</span>
        </div>
      ) : (
        <>
          <AuditEntries entries={entries.slice(0, 3)} />
          {entries.length > 3 && (
            <button type="button" className="audit-more" onClick={openModal}>
              More activity
            </button>
          )}
        </>
      )}
      <div className="audit-footer">Updates are recorded automatically</div>

      {isModalOpen && (
        <div
          className="modal-backdrop audit-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false);
          }}
        >
          <section
            className="audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">ACCOUNTABILITY</div>
                <h2 id="audit-modal-title">All activity</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close activity log"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={21} />
              </button>
            </div>
            {pageError ? (
              <div className="audit-page-error" role="alert">
                {pageError}
                <button
                  type="button"
                  className="audit-retry"
                  onClick={() => void loadPage(page)}
                >
                  Try again
                </button>
              </div>
            ) : isPageLoading && modalEntries.length === 0 ? (
              <div className="audit-page-status" role="status">
                Loading activity…
              </div>
            ) : modalEntries.length === 0 ? (
              <div className="audit-page-status">No activity recorded yet.</div>
            ) : (
              <div className="audit-modal-list">
                <AuditEntries entries={modalEntries.slice(0, PAGE_SIZE)} />
              </div>
            )}
            <div className="audit-pagination">
              <button
                type="button"
                className="button button-outline"
                disabled={page === 0 || isPageLoading}
                onClick={() => void loadPage(page - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                type="button"
                className="button button-outline"
                disabled={isPageLoading || modalEntries.length <= PAGE_SIZE}
                onClick={() => void loadPage(page + 1)}
              >
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
