import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { EmergencyFeed } from './components/EmergencyFeed';
import { HospitalDetail } from './components/HospitalDetail';
import { DoctorSearch } from './components/DoctorSearch';
import { AITriageChat } from './components/AITriageChat';
import { NavigationBar } from './components/NavigationBar';
import type { AppTab, Coordinates, LocationStatus } from './types';

const DHAKA_COORDINATES: Coordinates = {
  latitude: 23.8103,
  longitude: 90.4125,
};

function ProfileView({
  locationStatus,
  isOnline,
}: {
  locationStatus: LocationStatus;
  isOnline: boolean;
}) {
  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="eyebrow">APP SETTINGS</div>
      <h1 id="profile-title">Settings</h1>
      <div className="profile-card">
        <div className="profile-row">
          <span>Privacy</span>
          <strong>No account needed</strong>
        </div>
        <div className="profile-row">
          <span>Location</span>
          <strong>
            {locationStatus === 'live' ? 'Using current location' : 'Dhaka fallback'}
          </strong>
        </div>
        <div className="profile-row">
          <span>Connection</span>
          <strong>{isOnline ? 'Online' : 'Offline'}</strong>
        </div>
      </div>
      <p className="profile-note">
        Hospital availability is shared by hospital staff. Call before travelling.
      </p>
    </section>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('emergency');
  const [coordinates, setCoordinates] = useState(DHAKA_COORDINATES);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('requesting');
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('The offline service worker could not be registered.', error);
      });
    }

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    if (!navigator.geolocation) {
      setLocationStatus('fallback');
      return () => {
        window.removeEventListener('online', updateOnline);
        window.removeEventListener('offline', updateOnline);
      };
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('live');
      },
      () => setLocationStatus('fallback'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  function navigate(tab: AppTab) {
    setActiveTab(tab);
    setSelectedHospitalId(null);
  }

  function openHospital(hospitalId: string) {
    setActiveTab('emergency');
    setSelectedHospitalId(hospitalId);
  }

  return (
    <div className="user-app">
      <Header
        locationStatus={locationStatus}
        isOnline={isOnline}
      />
      <main className="user-main">
        {activeTab === 'emergency' &&
          (selectedHospitalId ? (
            <HospitalDetail
              hospitalId={selectedHospitalId}
              onClose={() => setSelectedHospitalId(null)}
            />
          ) : (
            <EmergencyFeed
              coordinates={coordinates}
              onSelectHospital={openHospital}
            />
          ))}
        {activeTab === 'doctors' && (
          <DoctorSearch onSelectHospital={openHospital} />
        )}
        {activeTab === 'ai' && <AITriageChat />}
        {activeTab === 'profile' && (
          <ProfileView
            locationStatus={locationStatus}
            isOnline={isOnline}
          />
        )}
      </main>
      <NavigationBar activeTab={activeTab} onChange={navigate} />
    </div>
  );
}
