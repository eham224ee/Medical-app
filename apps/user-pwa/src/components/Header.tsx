import { MapPin, WifiOff } from 'lucide-react';
import type { LocationStatus } from '../types';

interface HeaderProps {
  locationStatus: LocationStatus;
  isOnline: boolean;
}

export function Header({
  locationStatus,
  isOnline,
}: HeaderProps) {
  const locationLabel =
    locationStatus === 'requesting'
      ? 'Finding your location'
      : locationStatus === 'live'
        ? 'Near your location'
        : 'Dhaka area';

  return (
    <header className={isOnline ? 'app-header' : 'app-header offline'}>
      <a className="user-brand" href="/" aria-label="Medico emergency home">
        <span className="brand-mark" aria-hidden="true">+</span>
        <span>
          MEDICO
          <small>EMERGENCY CARE</small>
        </span>
      </a>
      <div className="header-status">
        <span className="location-status" aria-label={locationLabel}>
          <MapPin size={15} aria-hidden="true" />
          <span title={locationLabel}>{locationLabel}</span>
        </span>
        {!isOnline && (
          <span
            className="network-status offline"
            title="Offline; saved information may be out of date."
            aria-label="Offline"
            role="status"
          >
            <WifiOff size={14} aria-hidden="true" />
            <span>Offline</span>
          </span>
        )}
      </div>
    </header>
  );
}
