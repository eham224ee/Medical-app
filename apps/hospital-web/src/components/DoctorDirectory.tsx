import { useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  Phone,
  Plus,
  Search,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import type { Doctor, DoctorInput } from '../types';

interface DoctorDirectoryProps {
  doctors: Doctor[];
  isLoading: boolean;
  onSave: (doctor: DoctorInput) => Promise<boolean>;
}

const emptyDoctor: DoctorInput = {
  name: '',
  specialty: '',
  experienceYears: 0,
  chamberSchedule: '',
  contactPhone: '',
  isAvailable: true,
};

export function DoctorDirectory({
  doctors,
  isLoading,
  onSave,
}: DoctorDirectoryProps) {
  const [query, setQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<DoctorInput>(emptyDoctor);
  const [saving, setSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const filteredDoctors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return doctors;
    return doctors.filter(
      (doctor) =>
        doctor.name.toLowerCase().includes(needle) ||
        doctor.specialty.toLowerCase().includes(needle),
    );
  }, [doctors, query]);

  async function submitDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await onSave({
      ...form,
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      chamberSchedule: form.chamberSchedule.trim(),
      contactPhone: form.contactPhone.trim(),
    });
    setSaving(false);
    if (saved) {
      setForm(emptyDoctor);
      setIsFormOpen(false);
    }
  }

  async function toggleDoctor(doctor: Doctor) {
    setPendingIds((current) => new Set(current).add(doctor.id));
    try {
      await onSave({
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        experienceYears: doctor.experienceYears,
        chamberSchedule: doctor.chamberSchedule,
        contactPhone: doctor.contactPhone,
        isAvailable: !doctor.isAvailable,
      });
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(doctor.id);
        return next;
      });
    }
  }

  return (
    <section
      className="panel-section doctor-section"
      aria-labelledby="doctor-section-title"
    >
      <div className="section-heading doctor-heading">
        <div>
          <div className="eyebrow">CARE TEAM</div>
          <h2 id="doctor-section-title">Doctor directory</h2>
          <p>Keep the on-duty team and their availability up to date.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setIsFormOpen(true)}
        >
          <Plus size={19} aria-hidden="true" />
          Add doctor
        </button>
      </div>

      <div className="directory-toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search doctors or specialties</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or specialty"
          />
        </label>
        <div className="doctor-count">
          <span className="live-dot" />{' '}
          {doctors.filter((doctor) => doctor.isAvailable).length} AVAILABLE
        </div>
      </div>

      {isLoading && doctors.length === 0 ? (
        <div className="loading-panel">
          <Stethoscope className="spin" size={22} aria-hidden="true" />
          <span>Loading care team…</span>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="empty-panel doctor-empty">
          <UserRound size={30} aria-hidden="true" />
          <strong>
            {query ? 'No matching doctors' : 'No doctor profiles yet'}
          </strong>
          <span>
            {query
              ? 'Try another name or specialty.'
              : 'Add a profile to make your roster visible to the team.'}
          </span>
        </div>
      ) : (
        <div className="doctor-list">
          {filteredDoctors.map((doctor) => {
            const pending = pendingIds.has(doctor.id);
            return (
              <article className="doctor-row" key={doctor.id}>
                <div className="doctor-avatar">
                  {doctor.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.slice(0, 1).toUpperCase())
                    .join('')}
                </div>
                <div className="doctor-main">
                  <div className="doctor-name-line">
                    <h3>{doctor.name}</h3>
                    <span
                      className={`doctor-status ${doctor.isAvailable ? 'doctor-status-on' : 'doctor-status-off'}`}
                    >
                      <i className="legend-dot" />
                      {doctor.isAvailable ? 'Available' : 'Away'}
                    </span>
                  </div>
                  <div className="doctor-specialty">{doctor.specialty}</div>
                  <div className="doctor-meta">
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />{' '}
                      {doctor.experienceYears} years
                    </span>
                    <span>
                      <Clock3 size={15} aria-hidden="true" />{' '}
                      {doctor.chamberSchedule}
                    </span>
                    <a href={`tel:${doctor.contactPhone}`}>
                      <Phone size={15} aria-hidden="true" />{' '}
                      {doctor.contactPhone}
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className={`availability-toggle ${doctor.isAvailable ? 'toggle-on' : ''}`}
                  role="switch"
                  aria-checked={doctor.isAvailable}
                  aria-label={`${doctor.isAvailable ? 'Mark' : 'Set'} ${doctor.name} ${doctor.isAvailable ? 'away' : 'available'}`}
                  disabled={pending}
                  onClick={() => void toggleDoctor(doctor)}
                >
                  <span className="toggle-knob">
                    {doctor.isAvailable ? <Check size={13} /> : <X size={13} />}
                  </span>
                  <span className="toggle-text">
                    {pending
                      ? 'Saving'
                      : doctor.isAvailable
                        ? 'On duty'
                        : 'Away'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}

      {isFormOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setIsFormOpen(false);
          }}
        >
          <section
            className="doctor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="doctor-form-title"
          >
            <div className="modal-heading">
              <div>
                <div className="eyebrow">CARE TEAM</div>
                <h2 id="doctor-form-title">Add doctor</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close form"
                disabled={saving}
                onClick={() => setIsFormOpen(false)}
              >
                <X size={21} />
              </button>
            </div>
            <form
              className="doctor-form"
              onSubmit={(event) => void submitDoctor(event)}
            >
              <label>
                Doctor name
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Full name"
                />
              </label>
              <div className="form-two-column">
                <label>
                  Specialty
                  <input
                    required
                    maxLength={120}
                    value={form.specialty}
                    onChange={(event) =>
                      setForm({ ...form, specialty: event.target.value })
                    }
                    placeholder="e.g. Cardiology"
                  />
                </label>
                <label>
                  Years of experience
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    value={form.experienceYears}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        experienceYears: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Chamber schedule
                <input
                  required
                  maxLength={240}
                  value={form.chamberSchedule}
                  onChange={(event) =>
                    setForm({ ...form, chamberSchedule: event.target.value })
                  }
                  placeholder="e.g. Mon–Fri · 09:00–13:00"
                />
              </label>
              <label>
                Contact phone
                <input
                  required
                  type="tel"
                  maxLength={40}
                  value={form.contactPhone}
                  onChange={(event) =>
                    setForm({ ...form, contactPhone: event.target.value })
                  }
                  placeholder="Phone number"
                />
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.isAvailable}
                  onChange={(event) =>
                    setForm({ ...form, isAvailable: event.target.checked })
                  }
                />
                Available for duty
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={saving}
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving}>
                  {saving ? 'Saving profile…' : 'Save doctor'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
