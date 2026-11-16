import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, MapPin, Phone, RefreshCw, Search } from 'lucide-react';
import { publicApi, ApiError } from '../services/api';
import type { Coordinates, PublicHospital } from '../types';

interface EmergencyFeedProps {
  coordinates: Coordinates;
  onSelectHospital: (hospitalId: string) => void;
}

type Freshness = 'fresh' | 'moderate' | 'stale';

function haversineDistance(from: Coordinates, hospital: PublicHospital) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitude = Number(hospital.latitude);
  const longitude = Number(hospital.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return Infinity;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(latitude - from.latitude);
  const longitudeDelta = radians(longitude - from.longitude);
  const term =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(term), Math.sqrt(1 - term));
}

function lastUpdated(hospital: PublicHospital) {
  const bedTimes = hospital.beds
    .map((bed) => new Date(bed.lastUpdatedAt).getTime())
    .filter(Number.isFinite);
  return bedTimes.length
    ? Math.max(...bedTimes)
    : new Date(hospital.updatedAt).getTime();
}

function freshness(timestamp: number, now: number): Freshness {
  if (!Number.isFinite(timestamp)) return 'moderate';
  const minutes = Math.max(0, now - timestamp) / 60_000;
  if (minutes < 15) return 'fresh';
  if (minutes < 120) return 'moderate';
  return 'stale';
}

function freshnessLabel(timestamp: number, now: number) {
  if (!Number.isFinite(timestamp)) return 'Update time unavailable';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'Updated just now';
  return `Updated ${minutes} min ago`;
}

function bedTotals(hospital: PublicHospital) {
  return hospital.beds.reduce(
    (totals, bed) => {
      const category = bed.category.toLowerCase();
      if (category.includes('icu')) totals.icu += bed.availableCount;
      if (category.includes('general')) totals.general += bed.availableCount;
      if (category.includes('cabin')) totals.cabin += bed.availableCount;
      return totals;
    },
    { icu: 0, general: 0, cabin: 0 },
  );
}

function bedLabel(count: number) {
  if (count === 0) return 'Full';
  if (count <= 5) return '1-5';
  return '>5';
}

function bedStatusClass(count: number) {
  if (count === 0) return 'bed-status-full';
  if (count <= 5) return 'bed-status-high-demand';
  return 'bed-status-available';
}

export function EmergencyFeed({
  coordinates,
  onSelectHospital,
}: EmergencyFeedProps) {
  const [hospitals, setHospitals] = useState<PublicHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    try {
      setHospitals(await publicApi.getHospitals());
      setError('');
      setNow(Date.now());
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not load nearby hospitals.',
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
    const onOnline = () => void refresh();
    const updateTime = window.setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(updateTime);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  const nearby = [...hospitals].sort(
    (first, second) =>
      haversineDistance(coordinates, first) -
      haversineDistance(coordinates, second),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredHospitals = normalizedQuery
    ? nearby.filter((hospital) =>
        [hospital.name, hospital.address].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : nearby;

  return (
    <section className="feed-section" aria-labelledby="emergency-title">
      <div className="page-heading">
        <div>
          <h1 id="emergency-title">Hospitals near you</h1>
          <p>Availability can change; call ahead before travelling.</p>
        </div>
        <button
          className="refresh-icon"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh hospital availability"
          title="Refresh"
        >
          <RefreshCw className={loading ? 'spin' : ''} size={17} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="offline-notice" role="status">
          <span>{error}</span>
          {hospitals.length > 0 && <small>Saved hospital data may be out of date.</small>}
        </div>
      )}
      {loading && hospitals.length === 0 && (
        <div className="feed-empty">Finding verified hospitals…</div>
      )}
      {!loading && hospitals.length === 0 && !error && (
        <div className="feed-empty">No verified hospitals are listed yet.</div>
      )}
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search hospitals by name or area</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search hospitals or area"
        />
      </label>
      <div className="hospital-feed">
        {filteredHospitals.map((hospital) => {
          const updatedAt = lastUpdated(hospital);
          const status = freshness(updatedAt, now);
          const totals = bedTotals(hospital);
          const distance = haversineDistance(coordinates, hospital);
          return (
            <article className="hospital-card" key={hospital.id}>
              <button
                className="hospital-card-main"
                onClick={() => onSelectHospital(hospital.id)}
                aria-label={`View ${hospital.name} details`}
              >
                <span className="hospital-card-heading">
                  <strong>{hospital.name}</strong>
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
                <span className="hospital-location">
                  <MapPin size={14} aria-hidden="true" />
                  {hospital.address}
                </span>
                <span className="hospital-subheading">
                  <span className="hospital-distance">
                    {Number.isFinite(distance) ? `${distance.toFixed(1)} km away` : 'Distance unavailable'}
                  </span>
                  <span className={`freshness freshness-${status}`}>
                    {freshnessLabel(updatedAt, now)}
                  </span>
                </span>
                <span className="bed-summary" aria-label="Bed availability">
                  {([
                    ['ICU', totals.icu],
                    ['General', totals.general],
                    ['Cabin', totals.cabin],
                  ] as const).map(([label, count]) => (
                    <span className={bedStatusClass(count)} key={label}>
                      {label}: <b>{bedLabel(count)}</b>
                    </span>
                  ))}
                </span>
                <span className="card-cta">
                  View Beds &amp; Call
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
              <div className="hospital-card-footer">
                <a className="call-link" href={`tel:${hospital.hotlinePhone}`}>
                  <Phone size={15} aria-hidden="true" />
                  Call Reception
                </a>
              </div>
              {status === 'stale' && (
                <p className="stale-warning">Stale data — tap to call hospital directly</p>
              )}
            </article>
          );
        })}
        {!loading && hospitals.length > 0 && filteredHospitals.length === 0 && (
          <div className="feed-empty">No hospitals match your search.</div>
        )}
      </div>
    </section>
  );
}
