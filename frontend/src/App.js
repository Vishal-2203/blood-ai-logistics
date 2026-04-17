import React, { useState, useEffect } from 'react';
import './index.css';
import LoginPage from './LoginPage';
import HospitalDashboard from './components/HospitalDashboard';
import DonorPortal from './components/DonorPortal';
import RequestorPortal from './components/RequestorPortal';
import { Icon, icons } from './components/Icons';

// ─── Configuration & Initialization ──────────────────────────

// ─── Data Constants ──────────────────────────────────────────
const INITIAL_REQUESTS = [
  { id: 'REQ-1011', patient: 'Anjali Verma', type: 'O-', units: 4, fulfilled: 1, urgency: 'Critical', status: 'In Transit', time: '10m ago' },
  { id: 'REQ-1012', patient: 'Rajesh Khanna', type: 'B-', units: 2, fulfilled: 0, urgency: 'High', status: 'Matching', time: '1h ago' }
];

const INITIAL_DONORS = [
  { id: 'D-012', name: 'Ravi Kumar', blood: 'O-', lat: 28.5450, lng: 77.1900, eta: 14 },
  { id: 'D-045', name: 'Priya Rangan', blood: 'O-', lat: 28.5900, lng: 77.2300, eta: 22 }
];

// ─── Modal Component: RaiseRequestModal ──────────────────────

function RaiseRequestModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ patient: '', blood: 'O-', units: 1, urgency: 'Critical' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/request-blood", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `Emergency: ${form.blood} for ${form.patient}`, lat: 28.567, lng: 77.210 })
      });
      const data = await response.json();
      onAdd({ ...form, id: 'REQ-' + Date.now().toString().slice(-4), status: 'Broadcasting', time: 'Just now', fulfilled: 0, ai_data: data });
    } catch (err) {
      onAdd({ ...form, id: 'REQ-' + Date.now().toString().slice(-4), status: 'Broadcasting', time: 'Just now', fulfilled: 0 });
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass-panel" onClick={e => e.stopPropagation()} style={{ borderTop: '4px solid var(--primary)' }}>
        <div className="modal-title"><Icon d={icons.plus} color="var(--primary)" /> Raise AI Broadcast</div>
        <div className="form-group" style={{ marginBottom: 16 }}>
           <label className="form-label">Patient Full Name</label>
           <input className="form-input" placeholder="e.g. John Doe" value={form.patient} onChange={e => setForm({...form, patient: e.target.value})} />
        </div>
        <div className="form-grid" style={{ marginBottom: 24 }}>
           <div className="form-group">
              <label className="form-label">Blood Group</label>
              <select className="form-select" value={form.blood} onChange={e => setForm({...form, blood: e.target.value})}>
                 {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(b => <option key={b}>{b}</option>)}
              </select>
           </div>
           <div className="form-group">
              <label className="form-label">Units (350ml)</label>
              <input className="form-input" type="number" min="1" value={form.units} onChange={e => setForm({...form, units: parseInt(e.target.value)})} />
           </div>
        </div>
        <div className="modal-actions">
           <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
           <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Processing...' : 'Broadcast Emergency'}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('hospital');
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [showModal, setShowModal] = useState(false);

  // Check for existing authentication on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setRole(userData.role);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (selectedRole, email) => {
    setRole(selectedRole);
    setUser({ email, role: selectedRole });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setRole('hospital');
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className={`app-shell theme-${role}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon-wrap"><Icon d={icons.drop} color="var(--primary)" /></div>
          <span className="logo-text"><span>Blood</span>Agent</span>
        </div>

        <div className="role-switcher" style={{ marginBottom: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['hospital', 'donor', 'requestor'].map(r => {
            const roleNames = { hospital: 'Hospital', donor: 'Donor', requestor: 'Requestor' };
            return (
              <div 
                key={r} 
                className={`role-tab ${role === r ? 'active' : ''}`} 
                onClick={() => setRole(r)} 
                style={{ 
                  background: role === r ? 'rgba(79, 172, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: role === r ? '1.5px solid #4fac fe' : '1.5px solid rgba(255, 255, 255, 0.1)',
                  color: role === r ? '#4fac fe' : '#fff',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: role === r ? 600 : 500,
                  fontSize: '13px',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (role !== r) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.borderColor = 'rgba(79, 172, 254, 0.5)';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (role !== r) {
                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {roleNames[r]}
              </div>
            );
          })}
        </div>

        {role === 'hospital' && (
           <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="nav-item active"><Icon d={icons.dashboard} /> Control Center</div>
              <div className="nav-item"><Icon d={icons.requests} /> Dispatch History</div>
              <div className="nav-item"><Icon d={icons.history} /> Bio-Metrics</div>
              <div style={{ marginTop: 20 }}>
                 <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowModal(true)}>+ New Request</button>
              </div>
           </nav>
        )}

        {role === 'donor' && (
           <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="nav-item active"><Icon d={icons.requests} /> Active Missions</div>
              <div className="nav-item"><Icon d={icons.history} /> Reward Points</div>
           </nav>
        )}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="page-title">{role === 'hospital' ? 'Facility Command' : role === 'donor' ? 'Life-Saver Hub' : 'Track Your Request'}</div>
            <div className="page-subtitle">{role === 'hospital' ? 'AI-driven emergency routing active' : 'Next match prediction: 85% probability'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-role)' }}>
               <div className="pulse-glow" style={{ width: 8, height: 8, background: 'var(--accent-role)', borderRadius: '50%', marginRight: 8 }}></div>
               Live Cloud Sync
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
              <div style={{ fontSize: '0.9rem', textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{user?.email || 'User'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{role.charAt(0).toUpperCase() + role.slice(1)}</div>
              </div>
              <button 
                onClick={handleLogout}
                style={{ 
                  background: 'rgba(232,25,60,0.1)', 
                  color: 'var(--primary)', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.3s'
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(232,25,60,0.2)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(232,25,60,0.1)'}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="page-content">
          {role === 'hospital' && <HospitalDashboard requests={requests} donors={INITIAL_DONORS} />}
          {role === 'donor' && <DonorPortal requests={requests} />}
          {role === 'requestor' && <RequestorPortal />}
        </section>
      </main>

      {showModal && <RaiseRequestModal onClose={() => setShowModal(false)} onAdd={(r) => setRequests([r, ...requests])} />}
    </div>
  );
}
