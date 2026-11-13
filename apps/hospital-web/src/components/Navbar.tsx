import { ArrowLeftRight, Building2 } from 'lucide-react';
import type { Hospital } from '../types';

interface NavbarProps {
  hospital: Hospital | null;
  staffName: string;
  hasSyncError: boolean;
  onSwitchHospital: () => void;
}

export function Navbar({
  hospital,
  staffName,
  hasSyncError,
  onSwitchHospital,
}: NavbarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Medico operations home">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="brand-word">
          MEDICO <b>OPS</b>
        </span>
      </a>

      <div className="topbar-divider" />

      <div className="hospital-identity">
        <span className="hospital-icon">
          <Building2 size={20} aria-hidden="true" />
        </span>
        <div>
          <span className="identity-label">ACTIVE HOSPITAL</span>
          <strong>{hospital?.name ?? 'Loading hospital…'}</strong>
        </div>
        {hospital && (
          <span
            className={`verification-badge verification-${hospital.verificationStatus.toLowerCase()}`}
            title={`Hospital verification: ${hospital.verificationStatus}`}
          >
            <span className="badge-dot" />
            {hospital.verificationStatus}
          </span>
        )}
      </div>

      <div className="topbar-spacer" />

      <div
        className={`connection-status ${hasSyncError ? 'connection-error' : ''}`}
      >
        <span className={hasSyncError ? 'connection-dot' : 'live-dot'} />
        <span>{hasSyncError ? 'SYNC ISSUE' : 'LIVE SYNC'}</span>
      </div>

      <div className="staff-chip" title={`Signed in as ${staffName}`}>
        <span className="staff-avatar">
          {staffName.slice(0, 1).toUpperCase()}
        </span>
        <span className="staff-label">{staffName}</span>
      </div>

      <button
        className="button button-outline switch-button"
        onClick={onSwitchHospital}
      >
        <ArrowLeftRight size={17} aria-hidden="true" />
        <span>Switch hospital</span>
      </button>
    </header>
  );
}
