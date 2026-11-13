import { useState, type FormEvent } from 'react';
import { ArrowRight, Bot, Phone, UserRound } from 'lucide-react';
import { publicApi, ApiError } from '../services/api';
import type { TriageResult } from '../types';

export function AITriageChat() {
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await publicApi.triage({
          symptoms: symptoms.split(/[,\n]/).map((value) => value.trim()).filter(Boolean),
          age: Number(age),
          gender,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Department routing is unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="triage-page" aria-labelledby="triage-title">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DEPARTMENT ROUTING</div>
          <h1 id="triage-title">Find the right department</h1>
          <p>Share a few details to see matching verified hospitals.</p>
        </div>
      </div>
      <div className="triage-disclaimer" role="note">
        This AI provides department routing only and does not offer medical diagnoses or treatment.
      </div>
      <form className="triage-form" onSubmit={(event) => void submit(event)}>
        <label className="symptom-label">
          What symptoms are you experiencing?
          <textarea
            value={symptoms}
            onChange={(event) => setSymptoms(event.target.value)}
            placeholder="For example: chest discomfort, fever"
            rows={3}
            required
          />
          <small>Separate symptoms with a comma.</small>
        </label>
        <div className="triage-fields">
          <label>
            Age
            <input
              type="number"
              min="0"
              max="130"
              inputMode="numeric"
              value={age}
              onChange={(event) => setAge(event.target.value)}
              required
            />
          </label>
          <label>
            Sex
            <select value={gender} onChange={(event) => setGender(event.target.value)} required>
              <option value="" disabled>Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="prefer not to say">Prefer not to say</option>
            </select>
          </label>
        </div>
        <button className="triage-submit" disabled={loading}>
          <Bot size={17} aria-hidden="true" />
          {loading ? 'Checking departments…' : 'Find departments'}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
      {error && <div className="offline-notice" role="alert">{error}</div>}
      {result && (
        <div className="triage-results" aria-live="polite">
          <div className="result-intro">
            <span className="bot-avatar"><Bot size={18} aria-hidden="true" /></span>
            <div>
              <strong>Suggested departments</strong>
              <span>{result.specialties.join(' · ')}</span>
            </div>
          </div>
          {result.hospitals.length === 0 ? (
            <div className="detail-empty">
              No matching verified hospitals were found. Call your local emergency service if this is urgent.
            </div>
          ) : (
            <div className="triage-hospitals">
              {result.hospitals.map((hospital) => (
                <article className="triage-hospital-card" key={hospital.id}>
                  <div>
                    <strong>{hospital.name}</strong>
                    <span>{hospital.address}</span>
                    <small>
                      {hospital.beds.length
                        ? [...new Set(hospital.beds.map((bed) => bed.department))].join(' · ')
                        : 'Department availability not listed'}
                    </small>
                    {hospital.doctors.map((doctor) => (
                      <span className="triage-doctor" key={doctor.id}>
                        <UserRound size={14} aria-hidden="true" />
                        {doctor.name} · {doctor.specialty} · {doctor.chamberSchedule}
                      </span>
                    ))}
                  </div>
                  <a className="doctor-call" href={`tel:${hospital.hotlinePhone}`} aria-label={`Call ${hospital.name}`}>
                    <Phone size={17} aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
          )}
          <small className="triage-notice">{result.notice}</small>
        </div>
      )}
    </section>
  );
}
