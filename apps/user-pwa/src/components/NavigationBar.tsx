import { Activity, Bot, Hospital, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppTab } from '../types';

interface NavigationBarProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

const tabs: Array<{ id: AppTab; label: string; Icon: LucideIcon }> = [
  { id: 'emergency', label: 'Emergency', Icon: Hospital },
  { id: 'doctors', label: 'Doctors', Icon: Activity },
  { id: 'ai', label: 'Triage', Icon: Bot },
  { id: 'profile', label: 'Settings', Icon: UserRound },
];

export function NavigationBar({ activeTab, onChange }: NavigationBarProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={activeTab === id ? 'tab-button active' : 'tab-button'}
          aria-current={activeTab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={19} strokeWidth={activeTab === id ? 2.3 : 1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
