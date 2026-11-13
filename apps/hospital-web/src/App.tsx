import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { AuditFeed } from './components/AuditFeed';
import { AuthGate } from './components/AuthGate';
import { BedMatrix } from './components/BedMatrix';
import { DoctorDirectory } from './components/DoctorDirectory';
import { Navbar } from './components/Navbar';
import { useHospitalData } from './hooks/useHospitalData';
import type { HospitalPanelSession } from './types';

function readSession(): HospitalPanelSession | null {
  try {
    const hospitalId = localStorage.getItem('medico-hospital-id');
    const staffName = sessionStorage.getItem('medico-hospital-staff');
    const staffPassword = sessionStorage.getItem('medico-hospital-password');
    if (!hospitalId || !staffName || !staffPassword) return null;
    return {
      hospitalId,
      staffName,
      staffPassword,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<HospitalPanelSession | null>(
    readSession,
  );

  useEffect(() => {
    if (session && !sessionStorage.getItem('medico-hospital-password')) {
      setSession(null);
    }
  }, [session]);

  function switchHospital() {
    sessionStorage.removeItem('medico-hospital-staff');
    sessionStorage.removeItem('medico-hospital-password');
    setSession(null);
  }

  if (!session) {
    return <AuthGate onAuthenticated={setSession} />;
  }

  return <Dashboard session={session} onSwitchHospital={switchHospital} />;
}

interface DashboardProps {
  session: HospitalPanelSession;
  onSwitchHospital: () => void;
}

function Dashboard({ session, onSwitchHospital }: DashboardProps) {
  const data = useHospitalData(session);
  const [activeTab, setActiveTab] = useState<'beds' | 'doctors'>('beds');

  return (
    <div className="app-shell">
      <Navbar
        hospital={data.hospital}
        staffName={session.staffName}
        hasSyncError={Boolean(data.error)}
        onSwitchHospital={onSwitchHospital}
      />

      <main className="dashboard">
        <div className="dashboard-title">
          <div>
            <div className="eyebrow">EMERGENCY DESK / OPERATIONS</div>
            <h1>Good shift, {session.staffName.split(/\s+/)[0]}.</h1>
            <p>
              Keep availability current. Every update is shared with your care
              team.
            </p>
          </div>
          <button
            className="button button-outline refresh-button"
            onClick={() => void data.refresh()}
            disabled={data.isLoading}
          >
            <RefreshCw
              className={data.isLoading ? 'spin' : ''}
              size={17}
              aria-hidden="true"
            />
            Refresh data
          </button>
        </div>

        {data.error && (
          <div className="warning-banner" role="alert">
            <span className="warning-icon">
              <WifiOff size={19} aria-hidden="true" />
            </span>
            <div>
              <strong>Connection needs attention</strong>
              <span>
                {data.error} Your last confirmed data is still on screen.
              </span>
            </div>
            <button
              className="warning-action"
              onClick={() => void data.refresh()}
            >
              Try again
            </button>
          </div>
        )}

        {data.hospital?.verificationStatus !== 'VERIFIED' && data.hospital && (
          <div className="verification-warning">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              This hospital is{' '}
              <strong>{data.hospital.verificationStatus.toLowerCase()}</strong>.
              Public availability listings are enabled after verification.
            </span>
          </div>
        )}

        <div
          className="mobile-tabs"
          role="tablist"
          aria-label="Operations sections"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'beds'}
            className={
              activeTab === 'beds' ? 'mobile-tab active' : 'mobile-tab'
            }
            id="beds-tab"
            aria-controls="beds-panel"
            onClick={() => setActiveTab('beds')}
          >
            Bed inventory
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'doctors'}
            className={
              activeTab === 'doctors' ? 'mobile-tab active' : 'mobile-tab'
            }
            id="doctors-tab"
            aria-controls="doctors-panel"
            onClick={() => setActiveTab('doctors')}
          >
            Doctor directory
          </button>
        </div>

        <div className="operations-layout">
          <div
            id="beds-panel"
            role="tabpanel"
            aria-labelledby="beds-tab"
            className={`primary-column ${activeTab === 'doctors' ? 'mobile-hidden' : ''}`}
          >
            <BedMatrix
              beds={data.beds}
              isLoading={data.isLoading}
              onAdjust={data.updateBed}
            />
          </div>
          <div
            id="doctors-panel"
            role="tabpanel"
            aria-labelledby="doctors-tab"
            className={`side-column ${activeTab === 'beds' ? 'mobile-hidden' : ''}`}
          >
            <DoctorDirectory
              doctors={data.doctors}
              isLoading={data.isLoading}
              onSave={data.saveDoctor}
            />
            <AuditFeed entries={data.auditLogs} isLoading={data.isLoading} />
          </div>
        </div>
        <footer className="dashboard-footer">
          <span>MEDICO OPS</span>
          <span>Emergency capacity coordination · Staff workspace</span>
        </footer>
      </main>
    </div>
  );
}
