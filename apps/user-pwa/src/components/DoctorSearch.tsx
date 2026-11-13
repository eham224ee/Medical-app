import { useEffect, useMemo, useState } from 'react';
import { Phone, Search, UserRound } from 'lucide-react';
import { publicApi, ApiError } from '../services/api';
import type { PublicDoctor } from '../types';

interface DoctorSearchProps {
  onSelectHospital: (hospitalId: string) => void;
}

export function DoctorSearch({ onSelectHospital }: DoctorSearchProps) {
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void publicApi.getDoctors()
      .then((result) => {
        if (active) setDoctors(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'Doctor directory is unavailable.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return doctors;
    return doctors.filter((doctor) =>
      [doctor.name, doctor.specialty, doctor.hospitalName, doctor.hospitalAddress]
        .some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [doctors, query]);

  return (
    <section className="directory-page" aria-labelledby="doctor-search-title">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SPECIALIST DIRECTORY</div>
          <h1 id="doctor-search-title">Find a doctor</h1>
          <p>Search by name, specialty, or hospital.</p>
        </div>
      </div>
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search doctors and specialties</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cardiology, doctor, hospital…"
        />
      </label>
      {error && <div className="offline-notice" role="status">{error}</div>}
      {loading && <div className="feed-empty">Loading specialists…</div>}
      {!loading && filtered.length === 0 && (
        <div className="feed-empty">
          {doctors.length ? 'No matching doctors found.' : 'No verified doctors are listed yet.'}
        </div>
      )}
      <div className="directory-list">
        {filtered.map((doctor) => (
          <article className="directory-card" key={doctor.id}>
            <div className="doctor-avatar"><UserRound size={19} aria-hidden="true" /></div>
            <button className="directory-main" onClick={() => onSelectHospital(doctor.hospitalId)}>
              <strong>{doctor.name}</strong>
              <span>{doctor.specialty} · {doctor.experienceYears} years</span>
              <small>{doctor.hospitalName} · {doctor.hospitalAddress}</small>
              <small>{doctor.chamberSchedule}</small>
            </button>
            <a className="doctor-call" href={`tel:${doctor.contactPhone}`} aria-label={`Call ${doctor.name}`}>
              <Phone size={17} aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
