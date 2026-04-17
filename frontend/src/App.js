import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import './index.css';
import LoginPage from './LoginPage';
import AIInsights from './components/AIInsights';
import { Icon, icons } from './components/Icons';

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling'],
  reconnection: true
});

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;

// Custom Icons for Map
const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const donorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Mock Data
const HOSPITAL_INFO = {
  id: 'HOSP-001',
  name: 'AIIMS Emergency Wing',
  location: [28.5672, 77.2100],
  city: 'New Delhi'
};

const INITIAL_DONORS = [
  { id: 'D-012', name: 'Ravi Kumar', blood: 'O-', lat: 28.5450, lng: 77.1900, eta: 14, status: 'In Transit', phone: '+91 98765 43210' },
  { id: 'D-045', name: 'Priya Rangan', blood: 'O-', lat: 28.5900, lng: 77.2300, eta: 22, status: 'En Route', phone: '+91 91234 56789' }
];

const STOCK = [
  { type: 'A+', units: 42, min: 50 },
  { type: 'A-', units: 12, min: 20 },
  { type: 'B+', units: 35, min: 40 },
  { type: 'B-', units: 8, min: 15 },
  { type: 'O+', units: 68, min: 80 },
  { type: 'O-', units: 2, min: 25 },
  { type: 'AB+', units: 18, min: 20 },
  { type: 'AB-', units: 5, min: 10 },
];

const REQUESTS = [
  { id: 'REQ-1011', patient: 'Anjali Verma', type: 'O-', units: 4, fulfilled: 1, urgency: 'Critical', time: '10 mins ago', status: 'Tracking Donors' },
  { id: 'REQ-1012', patient: 'Rajesh Khanna', type: 'B-', units: 2, fulfilled: 0, urgency: 'High', time: '1 hr ago', status: 'Broadcasting' },
  { id: 'REQ-1013', patient: 'Sara Mathew', type: 'A+', units: 3, fulfilled: 3, urgency: 'Normal', time: '3 hrs ago', status: 'Fulfilled' }
];

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
    <div className="map-wrapper" style={{ height: '100%', minHeight: 400 }}>
      <MapContainer center={hospital.location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <Marker position={hospital.location} icon={hospitalIcon}>
          <Popup><strong>{hospital.name}</strong></Popup>
        </Marker>
        {liveDonors.map(d => (
          <React.Fragment key={d.id}>
            <Marker position={[d.lat, d.lng]} icon={donorIcon}>
              <Popup><strong>{d.name}</strong> ({d.blood})</Popup>
            </Marker>
            <Polyline positions={[[d.lat, d.lng], hospital.location]} pathOptions={{ color: 'var(--donor-green)', dashArray: '5, 10' }} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

function RaiseRequestModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ patient: '', blood: 'O+', units: 1, urgency: 'High' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    if (!form.patient.trim()) newErrors.patient = 'Patient name is required';
    if (!form.blood) newErrors.blood = 'Blood type is required';
    if (!form.units || form.units < 1 || form.units > 20) newErrors.units = 'Units must be between 1 and 20';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const messageText = `Patient ${form.patient} needs ${form.units} units of ${form.blood} blood.`;
      const response = await fetch("http://localhost:3000/request-blood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText, lat: 17.385, lng: 78.486 })
      });
      const data = await response.json();
      onAdd({ ...form, id: 'REQ-' + Math.floor(Math.random() * 9000 + 1000), fulfilled: 0, time: 'Just now', status: 'Broadcasting', ai_data: data });
      socket.emit('emergency_request_raised', { ...form, ai_data: data });
    } catch (err) {
      console.error("API Error:", err);
      onAdd({ ...form, id: 'REQ-' + Math.floor(Math.random() * 9000 + 1000), fulfilled: 0, time: 'Just now', status: 'Broadcasting' });
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <div style={{ width: 32, height: 32, background: 'rgba(232,25,60,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Icon d={icons.drop} size={18} />
          </div>
          Raise Emergency Request
        </div>
        <div className="form-grid">
           <div className="form-group">
             <label className="form-label">Patient Name *</label>
             <input className={`form-input ${errors.patient ? 'error' : ''}`} placeholder="e.g. John Doe" value={form.patient} onChange={e => setForm({...form, patient: e.target.value})} />
             {errors.patient && <span className="error-message">{errors.patient}</span>}
           </div>
           <div className="form-group">
             <label className="form-label">Blood Type *</label>
             <select className={`form-select ${errors.blood ? 'error' : ''}`} value={form.blood} onChange={e => setForm({...form, blood: e.target.value})}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => <option key={b}>{b}</option>)}
             </select>
             {errors.blood && <span className="error-message">{errors.blood}</span>}
           </div>
           <div className="form-group">
             <label className="form-label">Units Required *</label>
             <input className={`form-input ${errors.units ? 'error' : ''}`} type="number" min="1" max="20" value={form.units} onChange={e => setForm({...form, units: parseInt(e.target.value) || 1})} />
             {errors.units && <span className="error-message">{errors.units}</span>}
           </div>
           <div className="form-group">
             <label className="form-label">Urgency Level</label>
             <div style={{ display: 'flex', gap: 10 }}>
               {['Normal', 'High', 'Critical'].map(level => (
                 <button key={level} className={`btn ${form.urgency === level ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setForm({...form, urgency: level})} style={{ flex: 1, justifyContent: 'center' }}>
                   {level}
                 </button>
               ))}
             </div>
           </div>
        </div>
        <div className="modal-actions">
           <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
           <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Broadcasting...' : 'Broadcast'}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('hospital');
  const [tab, setTab] = useState('dashboard');
  const [requests, setRequests] = useState(REQUESTS);
  const [showModal, setShowModal] = useState(false);
  const [myLocation, setMyLocation] = useState([28.5450, 77.1900]);

  useEffect(() => {
    // Check if user is already logged in (from localStorage)
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setRole(userData.role);
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (selectedRole, email) => {
    setRole(selectedRole);
    setUser({ email, role: selectedRole });
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setRole('hospital');
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const activeRequest = requests[0];

  return (
    <div className={`app-shell theme-${role}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Icon d={icons.drop} size={18} />
          <span className="logo-text"><span>Blood</span>Agent</span>
        </div>

        <div className="role-switcher">
          {['hospital', 'donor', 'requestor'].map(r => (
            <div key={r} className={`role-tab ${role === r ? 'active' : ''}`} onClick={() => setRole(r)}>
              {r.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>

        {role === 'hospital' && (
          <>
            <div className={`nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
              <Icon d={icons.dashboard} size={18} /> Dashboard
            </div>
            <div className={`nav-item ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
              <Icon d={icons.requests} size={18} /> Requests
            </div>
            <div className={`nav-item ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
              <Icon d={icons.inventory} size={18} /> Stock
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Request</button>
          </>
        )}

        {role === 'donor' && (
          <>
            <div className="nav-item active">
              <Icon d={icons.requests} size={18} /> Match Pipeline
            </div>
            <div className="nav-item">
              <Icon d={icons.clock} size={18} /> History
            </div>
          </>
        )}
      </aside>

      <div className="main-area">
        <div className="topbar">
          <div className="page-title">{role.toUpperCase()} PORTAL</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {user?.email}
            </div>
            <button className="btn btn-ghost btn-small" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="page-content">
          {role === 'hospital' && tab === 'dashboard' && (
            <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, height: '100%' }}>
              <div className="glass-panel"><LiveTrackingMap donors={INITIAL_DONORS} hospital={HOSPITAL_INFO} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <AIInsights activeRequest={activeRequest} stock={STOCK} />
              </div>
            </div>
          )}

          {role === 'hospital' && tab === 'requests' && (
             <div className="animate-in glass-panel">
                <table style={{ width: '100%', padding: 20 }}>
                   <thead><tr><th>ID</th><th>Patient</th><th>Type</th><th>Urgency</th></tr></thead>
                   <tbody>
                      {requests.map(r => <tr key={r.id}><td>{r.id}</td><td>{r.patient}</td><td>{r.type}</td><td>{r.urgency}</td></tr>)}
                   </tbody>
                </table>
             </div>
          )}

          {role === 'donor' && (
            <div className="animate-in glass-panel" style={{ padding: 40, textAlign: 'center' }}>
               <h2>Ready to Save a Life?</h2>
               <p>2 matches found for your O- blood group.</p>
               <button className="btn" style={{ background: 'var(--donor-green)', color: 'white' }}>Accept Match</button>
            </div>
          )}

          {role === 'requestor' && (
            <div className="animate-in" style={{ textAlign: 'center' }}>
               <div className="glass-panel" style={{ padding: 40 }}>
                  <h1>Tracking Your Request</h1>
                  <p>AI is matching donors in your area...</p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
                     {['Broadcasting', 'Matching', 'En Route'].map(s => <div key={s} className="glass-panel" style={{ padding: 10 }}>{s}</div>)}
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>

      {showModal && <RaiseRequestModal onClose={() => setShowModal(false)} onAdd={(r) => setRequests([r, ...requests])} />}
    </div>
  );
}
