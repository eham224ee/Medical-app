import { LogOut, ShieldCheck } from 'lucide-react';
import type { AdminSection } from '../types';

interface NavbarProps {
  activeSection: AdminSection;
  username: string;
  onNavigate: (section: AdminSection) => void;
  onSignOut: () => void;
}

const sections: Array<{ id: AdminSection; label: string }> = [
  { id: 'queue', label: 'Verification' },
  { id: 'audit', label: 'Audit log' },
  { id: 'analytics', label: 'Analytics' },
];

export function Navbar({
  activeSection,
  username,
  onNavigate,
  onSignOut,
}: NavbarProps) {
  return (
    <header className="topbar">
      <a className="brand" href="/master-medico-admin" aria-label="Medico oversight home">
        <span className="brand-mark" aria-hidden="true">+</span>
        <span>
          MEDICO <small>OVERSIGHT</small>
        </span>
      </a>
      <nav className="primary-nav" aria-label="Admin sections">
        {sections.map((section) => (
          <button
            key={section.id}
            className={activeSection === section.id ? 'nav-item active' : 'nav-item'}
            aria-current={activeSection === section.id ? 'page' : undefined}
            onClick={() => onNavigate(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <div className="admin-identity">
        <span className="role-pill">
          <ShieldCheck size={14} aria-hidden="true" />
          MASTER ADMIN
        </span>
        <span className="username">{username}</span>
        <button className="icon-button signout" onClick={onSignOut} aria-label="Sign out">
          <LogOut size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
