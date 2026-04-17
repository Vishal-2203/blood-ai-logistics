import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import './index.css';

// ─── Configuration & Initialization ──────────────────────────
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true
});

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const donorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// ─── Data Constants ──────────────────────────────────────────
const HOSPITAL_INFO = { id: 'HOSP-001', name: 'AIIMS Emergency Wing', location: [28.5672, 77.2100] };
const STOCK_STATUS = [
  { type: 'O-', units: 4, status: 'Critical', color: 'var(--primary)' },
  { type: 'O+', units: 45, status: 'Optimal', color: 'var(--accent-green)' },
  { type: 'B-', units: 8, status: 'Low', color: 'var(--accent-amber)' },
  { type: 'A+', units: 32, status: 'Optimal', color: 'var(--accent-green)' }
];

const INITIAL_REQUESTS = [
  { id: 'REQ-1011', patient: 'Anjali Verma', type: 'O-', units: 4, fulfilled: 1, urgency: 'Critical', status: 'In Transit', time: '10m ago' },
  { id: 'REQ-1012', patient: 'Rajesh Khanna', type: 'B-', units: 2, fulfilled: 0, urgency: 'High', status: 'Matching', time: '1h ago' }
];

const INITIAL_DONORS = [
  { id: 'D-012', name: 'Ravi Kumar', blood: 'O-', lat: 28.5450, lng: 77.1900, eta: 14 },
  { id: 'D-045', name: 'Priya Rangan', blood: 'O-', lat: 28.5900, lng: 77.2300, eta: 22 }
];

// ─── Helper Components ───────────────────────────────────────
const Icon = ({ d, size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  drop: "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z",
  dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  requests: "M22 12h-4l-3 9L9 3l-3 9H2",
  history: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  plus: "M12 5v14M5 12h14"
};

// ─── Module: Specialized Portals ──────────────────────────────

function HospitalDashboard({ requests, donors }) {
  return (
    <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Statistics & Stock */}
        <div className="glass-panel" style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
           {STOCK_STATUS.map(s => (
             <div key={s.type} style={{ textAlign: 'center', padding: 16, borderRight: s.type !== 'A+' ? '1px solid var(--border)' : 'none' }}>
                <div style={{ color: s.color, fontSize: '1.8rem', fontWeight: 800 }}>{s.type}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.units} Units</div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: s.color, marginTop: 4 }}>{s.status}</div>
             </div>
           ))}
        </div>
        
        {/* Main Map Content */}
        <div className="glass-panel" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
           <div className="card-header" style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000, background: 'rgba(15,15,26,0.8)', padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Real-Time Logistics Map</div>
           </div>
           <LiveTrackingMap donors={donors} hospital={HOSPITAL_INFO} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
         {/* Urgent Requests Sidebar */}
         <div className="glass-panel" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, marginBottom: 20 }}>Priority Requests</div>
            {requests.map(r => (
              <div key={r.id} style={{ marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid ' + (r.urgency === 'Critical' ? 'rgba(232,25,60,0.3)' : 'var(--border)') }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary-light)' }}>{r.type}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>{r.status}</span>
                 </div>
                 <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.patient}</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: 4 }}>{r.fulfilled} / {r.units} Units</div>
              </div>
            ))}
         </div>

         {/* AI Dispatch Status */}
         <div className="glass-panel" style={{ padding: 24, flex: 1, background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 100%)' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--accent-blue)' }}>AI Operational Insight</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
               Routing engine has identified <strong>2 optimal matches</strong> for Request REQ-1011. 
               Predicted fulfillment: <span style={{ color: 'var(--accent-green)' }}>100% within 25 min</span>.
            </p>
         </div>
      </div>
    </div>
  );
}

function DonorPortal({ requests }) {
  return (
    <div className="animate-in" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: 32, marginBottom: 24, background: 'linear-gradient(90deg, rgba(16,185,129,0.1) 0%, transparent 100%)' }}>
         <div style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>Good Morning, Rahul</div>
         <p style={{ color: 'var(--text-secondary)' }}>You have a reliability score of <strong>98.4%</strong>. You are in the top 1% of donors this month.</p>
      </div>
      
      <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Available Opportunities</div>
      <div className="requests-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
         {requests.filter(r => r.type === 'O-').map(r => (
           <div key={r.id} className="glass-panel" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                 <div style={{ background: 'var(--primary)', color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: '1.5rem', fontWeight: 900 }}>{r.type}</div>
                 <div className="status-badge" style={{ background: 'rgba(232,25,60,0.1)', color: 'var(--primary)' }}>CRITICAL</div>
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>AIIMS Emergency Wing</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>Distance: 3.2 km • Est. ETA: 12 mins</div>
              <button className="btn" style={{ width: '100%', background: 'var(--accent-green)', color: 'white' }}>Accept & Start Mission</button>
           </div>
         ))}
      </div>
    </div>
  );
}

function RequestorPortal() {
  return (
    <div className="animate-in" style={{ maxWidth: 700, margin: '60px auto', textAlign: 'center' }}>
       <div className="glass-panel" style={{ padding: 48 }}>
          <div className="pulse-glow" style={{ width: 80, height: 80, background: 'rgba(59,130,246,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', color: 'var(--accent-blue)' }}>
             <Icon d={icons.requests} size={40} />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 16 }}>Seeking Donors...</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: 40 }}>Our AI is currently auditing local banks and alerting high-reliability donors for your request.</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
             {['Broadcasting', 'Matching', 'Verified', 'Dispatched'].map((s, i) => (
                <div key={s} style={{ padding: '12px 20px', borderRadius: 12, background: i < 2 ? 'rgba(59,130,246,0.15)' : 'var(--bg-card)', border: '1px solid ' + (i < 2 ? 'var(--accent-blue)' : 'var(--border)'), transition: 'all 0.5s' }}>
                   <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: i < 2 ? 'var(--accent-blue)' : 'var(--text-muted)' }}>Phase {i+1}</div>
                   <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s}</div>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}

// ─── Main Application Logic ─────────────────────────────────

function LiveTrackingMap({ donors, hospital }) {
  const [liveDonors, setLiveDonors] = useState(donors);
  useEffect(() => {
    socket.emit('join_tracking', 'REQ-1011');
    const handleUpdate = (data) => {
       setLiveDonors(prev => prev.map(d => 
         d.id === data.donorId ? { ...d, lat: data.lat, lng: data.lng, eta: data.eta } : d
       ));
    };
    socket.on('donor_movement_update', handleUpdate);
    return () => socket.off('donor_movement_update', handleUpdate);
  }, [hospital]);

  return (
    <MapContainer center={hospital.location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <Marker position={hospital.location} icon={hospitalIcon} />
      {liveDonors.map(d => (
        <React.Fragment key={d.id}>
          <Marker position={[d.lat, d.lng]} icon={donorIcon} />
          <Polyline positions={[[d.lat, d.lng], hospital.location]} pathOptions={{ color: 'var(--accent-green)', dashArray: '5, 12', weight: 2, opacity: 0.6 }} />
        </React.Fragment>
      ))}
    </MapContainer>
  );
}

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
  const [role, setRole] = useState('hospital');
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className={`app-shell theme-${role}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon-wrap"><Icon d={icons.drop} color="var(--primary)" /></div>
          <span className="logo-text"><span>Blood</span>Agent</span>
        </div>

        <div className="role-switcher" style={{ marginBottom: 30 }}>
          {['hospital', 'donor', 'requestor'].map(r => (
            <div key={r} className={`role-tab ${role === r ? 'active' : ''}`} onClick={() => setRole(r)} style={{ transition: 'all 0.3s' }}>
              {r.charAt(0).toUpperCase()}
            </div>
          ))}
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
          <div className="status-badge" style={{ background: 'var(--accent-glow)', color: 'var(--accent-role)' }}>
             <div className="pulse-glow" style={{ width: 8, height: 8, background: 'var(--accent-role)', borderRadius: '50%', marginRight: 8 }}></div>
             Live Cloud Sync
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
