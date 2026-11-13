import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Phone, UserRound } from 'lucide-react';
import { publicApi, ApiError } from '../services/api';
import type { HospitalDetails } from '../types';

interface HospitalDetailProps {
  hospitalId: string;
  onClose: () => void;
}

export function HospitalDetail({ hospitalId, onClose }: HospitalDetailProps) {
  const [hospital, setHospital] = useState<HospitalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setHospital(null);
    setError('');
    setLoading(true);
    void publicApi.getHospital(hospitalId)
      .then((result) => {
        if (active) setHospital(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError ? caught.message : 'Hospital details are unavailable.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hospitalId]);

  return (
    <section className="detail-page" aria-labelledby="detail-title">
      <button className="back-button" onClick={onClose}>
        <ArrowLeft size={17} aria-hidden="true" />
        Nearby hospitals
      </button>
      {loading && <div className="feed-empty">Loading hospital details…</div>}
      {error && <div className="offline-notice" role="alert">{error}</div>}
      {hospital && (
        <>
          <div className="detail-heading">
            <div className="eyebrow">VERIFIED HOSPITAL</div>
            <h1 id="detail-title">{hospital.name}</h1>
            <p><MapPin size={15} aria-hidden="true" />{hospital.address}</p>
          </div>
          <a className="emergency-call" href={`tel:${hospital.hotlinePhone}`}>
            <Phone size={22} aria-hidden="true" />
            <span>
              <small>CALL HOSPITAL HOTLINE</small>
              <strong>{hospital.hotlinePhone}</strong>
            </span>
          </a>

          <section className="detail-block" aria-labelledby="beds-title">
            <div className="detail-section-title">
              <h2 id="beds-title">Available beds</h2>
              <span>Last updated by hospital staff</span>
            </div>
            {hospital.beds.length ? (
              <div className="bed-matrix">
                {hospital.beds.map((bed) => (
                  <article className="bed-row" key={bed.id}>
                    <div>
                      <strong>{bed.category}</strong>
                      <span>{bed.department}</span>
                    </div>
                    <b className={bed.availableCount > 0 ? 'bed-count available' : 'bed-count'}>
                      {bed.availableCount}
                      <small> / {bed.totalCount}</small>
                    </b>
                  </article>
                ))}
              </div>
            ) : (
              <div className="detail-empty">No bed inventory has been shared.</div>
            )}
          </section>

          <section className="detail-block" aria-labelledby="doctors-title">
            <div className="detail-section-title">
              <h2 id="doctors-title">Available doctors</h2>
              <span>{hospital.doctors.length} listed</span>
            </div>
            {hospital.doctors.length ? (
              <div className="doctor-list">
                {hospital.doctors.map((doctor) => (
                  <article className="doctor-card" key={doctor.id}>
                    <div className="doctor-avatar"><UserRound size={18} aria-hidden="true" /></div>
                    <div className="doctor-copy">
                      <strong>{doctor.name}</strong>
                      <span>{doctor.specialty} · {doctor.experienceYears} years</span>
                      <small>{doctor.chamberSchedule}</small>
                    </div>
                    <a className="doctor-call" href={`tel:${doctor.contactPhone}`} aria-label={`Call ${doctor.name}`}>
                      <Phone size={17} aria-hidden="true" />
                    </a>
                  </article>
                ))}
              </div>
            ) : (
              <div className="detail-empty">No doctors are currently listed.</div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
