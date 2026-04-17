import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';
import axios from 'axios';
import './index.css';

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

// ─── Mock Data for Hospital Dashboard ───────────────────────
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
  { type: 'O-', units: 2, min: 25 }, // Critical Shortage
  { type: 'AB+', units: 18, min: 20 },
  { type: 'AB-', units: 5, min: 10 },
];

const REQUESTS = [
  { id: 'REQ-1011', patient: 'Anjali Verma', type: 'O-', units: 4, fulfilled: 1, urgency: 'Critical', time: '10 mins ago', status: 'Tracking Donors' },
  { id: 'REQ-1012', patient: 'Rajesh Khanna', type: 'B-', units: 2, fulfilled: 0, urgency: 'High', time: '1 hr ago', status: 'Broadcasting' },
  { id: 'REQ-1013', patient: 'Sara Mathew', type: 'A+', units: 3, fulfilled: 3, urgency: 'Normal', time: '3 hrs ago', status: 'Fulfilled' }
];

// ─── Icons ───────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  dashboard: "M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5zM4 14a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5zm10-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-7z",
  requests:  "M22 12h-4l-3 9L9 3l-3 9H2",
  inventory: "M18 20V10M12 20V4M6 20v-6",
  plus:      "M12 5v14M5 12h14",
  drop:      "M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  map_pin:   "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  check:     "M20 6L9 17l-5-5",
  navigation:"M3 11l19-9-9 19-2-8-8-2z"
};

// ─── Component: Live Tracking Map ───────────────────────────
function LiveTrackingMap({ donors, hospital }) {
  // Use live donor movement from server or fallback to mock
  const [liveDonors, setLiveDonors] = useState(donors);

  useEffect(() => {
    // Join tracking room
    socket.emit('join_tracking', 'REQ-1011'); // Subscribe to primary request

    const handleUpdate = (data) => {
       setLiveDonors(prev => prev.map(d => 
         d.id === data.donorId ? { ...d, lat: data.lat, lng: data.lng, eta: data.eta } : d
       ));
    };

    socket.on('donor_movement_update', handleUpdate);

    // Fallback simulation if no server pushes
    const interval = setInterval(() => {
      setLiveDonors(prev => prev.map(d => {
        const latDiff = hospital.location[0] - d.lat;
        const lngDiff = hospital.location[1] - d.lng;
        return {
          ...d,
          lat: d.lat + latDiff * 0.05,
          lng: d.lng + lngDiff * 0.05,
          eta: Math.max(1, d.eta - 1)
        };
      }));
    }, 5000); 

    return () => {
      clearInterval(interval);
      socket.off('donor_movement_update', handleUpdate);
    };
  }, [hospital]);

  return (
    <div className="map-wrapper" style={{ height: '100%', minHeight: 400, margin: 0, border: 'none', borderRadius: 'var(--radius-lg)' }}>
      <MapContainer center={hospital.location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {/* Hospital Marker */}
        <Marker position={hospital.location} icon={hospitalIcon}>
          <Popup className="glass-popup">
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon d={icons.map_pin} size={14} color="var(--primary)" /> {hospital.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Destination for Emergency</div>
          </Popup>
        </Marker>
        
        {/* Radar Pulse Effect */}
        <Circle center={hospital.location} radius={2500} pathOptions={{ color: '#e8193c', fillColor: '#e8193c', fillOpacity: 0.05 }} className="pulse-circle" />

        {/* Live Donors */}
        {liveDonors.map(d => (
          <React.Fragment key={d.id}>
            <Marker position={[d.lat, d.lng]} icon={donorIcon}>
              <Popup>
                <strong>{d.name}</strong> ({d.blood}) <br />
                ETA: <span style={{color: 'var(--accent-green)', fontWeight: 'bold'}}>{d.eta} mins</span><br />
                Status: {d.status}
              </Popup>
            </Marker>
            {/* Draw Path */}
            <Polyline positions={[[d.lat, d.lng], hospital.location]} pathOptions={{ color: 'var(--accent-green)', dashArray: '5, 10', weight: 2, opacity: 0.6 }} />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────────────
function RaiseRequestModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ patient: '', blood: 'O+', units: 1, urgency: 'High' });
  const handleSubmit = async () => {
    try {
      const message = `Patient ${form.patient} needs ${form.units} units of ${form.blood} blood. Urgency is ${form.urgency}.`;
      
      const response = await fetch("http://localhost:3000/request-blood", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: message,
          lat: 17.385,
          lng: 78.486
        })
      });

      const data = await response.json();
      console.log("API RESPONSE:", data);

      // Successfully processed request
      onAdd({ 
        ...form, 
        id: 'REQ-' + Math.floor(Math.random() * 9000 + 1000), 
        fulfilled: 0, 
        time: 'Just now', 
        status: 'Broadcasting',
        ai_decision: data.decision // Store the AI justification
      });
      
      // Emit via socket
      socket.emit('emergency_request_raised', { ...form, ai_data: data });

    } catch (err) {
      console.error("API Error:", err);
      // Fallback for UI if API is down
      onAdd({ ...form, id: 'REQ-' + Math.floor(Math.random() * 9000 + 1000), fulfilled: 0, time: 'Just now', status: 'Broadcasting' });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <div style={{ width: 32, height: 32, background: 'rgba(232,25,60,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Icon d={icons.drop} size={18} />
          </div>
          Raise Emergency Request
        </div>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Patient Name</label>
            <input className="form-input" placeholder="e.g. John Doe" value={form.patient} onChange={e => setForm({...form, patient: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Blood Group Needed</label>
            <select className="form-select" value={form.blood} onChange={e => setForm({...form, blood: e.target.value})}>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Units Required</label>
            <input className="form-input" type="number" min="1" max="20" value={form.units} onChange={e => setForm({...form, units: e.target.value})} />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
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
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Simulate Broadcast</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [requests, setRequests] = useState(REQUESTS);
  const [showModal, setShowModal] = useState(false);

  const activeRequest = requests[0]; // Focusing Dashboard on most critical request

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon-wrap" style={{ animation: 'pulse 2s infinite' }}>
            <Icon d={icons.drop} size={18} />
          </div>
          <span className="logo-text"><span>Blood</span>Agent</span>
        </div>

        <div style={{ padding: '0 12px', marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current Facility</div>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginTop: 4 }}>{HOSPITAL_INFO.name}</div>
        </div>

        <span className="nav-section-label">Operations</span>
        <div className={`nav-item ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
          <Icon d={icons.dashboard} size={18} /> Priority Dashboard
        </div>
        <div className={`nav-item ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
          <Icon d={icons.requests} size={18} /> All Requests
          <span className="nav-badge">{requests.filter(r => r.status !== 'Fulfilled').length}</span>
        </div>
        <div className={`nav-item ${tab === 'inventory' ? 'active' : ''}`} onClick={() => setTab('inventory')}>
          <Icon d={icons.inventory} size={18} /> Stock Analytics
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 12px' }}>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowModal(true)}>
            <Icon d={icons.plus} size={16} /> Raise Emergency
          </button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="main-area">
        <div className="topbar">
          <div>
            <div className="page-title">{tab === 'dashboard' ? 'Real-Time Fulfillment Tracking' : tab === 'inventory' ? 'Inventory Prediction' : 'Emergency Requests'}</div>
            <div className="page-subtitle">Tracking inbound donors & mapping supply algorithms</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
             <div className="status-badge" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', padding: '6px 12px', fontSize: '0.8rem' }}>
                <div style={{ width: 8, height: 8, background: 'var(--accent-green)', borderRadius: '50%', animation: 'pulse 1.5s infinite', marginRight: 6 }}></div>
                System Online
             </div>
             <div className="avatar">RS</div>
          </div>
        </div>

        <div className="page-content">
          {tab === 'dashboard' && (
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
              
              {/* Top Urgent Strip */}
              <div className="glass-card" style={{ border: '1px solid rgba(232, 25, 60, 0.3)', background: 'linear-gradient(90deg, rgba(232, 25, 60, 0.05) 0%, transparent 100%)' }}>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }}>
                   <div style={{ background: 'var(--primary)', color: 'white', padding: '12px 20px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>Critical Need</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800 }}>{activeRequest.type}</div>
                   </div>
                   <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>Patient: {activeRequest.patient}</div>
                      <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: 16, fontSize: '0.9rem' }}>
                         <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={icons.clock} size={15} /> {activeRequest.time}</span>
                         <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon d={icons.drop} size={15} color="var(--primary-light)" /> {activeRequest.units} Units Required</span>
                      </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fulfillment Status</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                         <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-green)' }}>{activeRequest.fulfilled}</span>
                         <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>/ {activeRequest.units}</span>
                      </div>
                   </div>
                </div>
              </div>

              {/* Main Split View */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
                {/* Map View */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="card-header" style={{ paddingBottom: 16 }}>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon d={icons.navigation} size={16} color="var(--accent-blue)" /> 
                      AI Prediction Map & Live Tracking
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-green)' }}>Real-Time Data Active</span>
                  </div>
                  <div className="card-body" style={{ flex: 1, padding: '0 24px 24px 24px' }}>
                     <LiveTrackingMap donors={INITIAL_DONORS} hospital={HOSPITAL_INFO} />
                  </div>
                </div>

                {/* Right Sidebar - Donors & System Logic */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="glass-card">
                    <div className="card-header"><span className="card-title">En-Route Donors</span></div>
                    <div className="card-body">
                      {INITIAL_DONORS.map((d, i) => (
                        <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-green)' }}>
                                 <Icon d={icons.map_pin} size={20} />
                              </div>
                              <div>
                                 <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
                                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>ID: {d.id} • {d.phone}</div>
                              </div>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-green)' }}>{d.eta}<span style={{fontSize:'0.8rem', fontWeight:500}}>m</span></div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ETA</div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-card" style={{ flex: 1 }}>
                     <div className="card-header"><span className="card-title">System Insights</span></div>
                     <div className="card-body">
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                           AI Multi-Variate Scoring algorithm has matched 2 optimal donors within a 15km radius. 
                           <br/><br/>
                           Prediction logic has factored in current Delhi traffic patterns to adjust ETA.
                        </div>
                        <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                           <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 8 }}>Recommendation</div>
                           <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Prepare intake bay A for incoming O- priority drops within 14 minutes.</div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'requests' && (
             <div className="animate-in">
                <div style={{ marginBottom: 24, fontSize: '1.1rem', fontWeight: 600 }}>Active Broadcasts & Requests</div>
                <div className="requests-grid" style={{ gridTemplateColumns: 'repeat(1, 1fr)' }}>
                   {requests.map(r => (
                      <div key={r.id} className="glass-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', alignItems: 'center', gap: 20 }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                           <div style={{ width: 50, height: 50, background: r.urgency === 'Critical' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: r.urgency === 'Critical' ? 'white' : 'var(--primary-light)' }}>
                              {r.type}
                           </div>
                           <div>
                              <div style={{ fontWeight: 600 }}>{r.id}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.time}</div>
                           </div>
                         </div>
                         <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Patient / Urgency</div>
                            <div style={{ fontWeight: 600, marginTop: 4 }}>{r.patient} • <span style={{ color: r.urgency === 'Critical' ? 'var(--primary-light)' : 'var(--accent-amber)'}}>{r.urgency}</span></div>
                         </div>
                         <div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Fulfillment</div>
                            <div style={{ fontWeight: 600, marginTop: 4, color: r.fulfilled === r.units ? 'var(--accent-green)' : 'var(--text-primary)' }}>{r.fulfilled} / {r.units} Units</div>
                         </div>
                         <div style={{ textAlign: 'right' }}>
                            <span className="status-badge" style={{ background: r.status === 'Fulfilled' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)', color: r.status === 'Fulfilled' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
                               {r.status}
                            </span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {tab === 'inventory' && (
             <div className="animate-in glass-card">
                 <div className="card-header" style={{ paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                    <span className="card-title">Predictive AI Stock Model</span>
                 </div>
                 <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                    {STOCK.map(s => (
                       <div key={s.type} style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12, border: '1px solid ' + (s.units <= s.min ? 'rgba(232, 25, 60, 0.4)' : 'var(--border)') }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                             <span style={{ fontSize: '1.5rem', fontWeight: 800, color: s.units <= s.min ? 'var(--primary-light)' : 'var(--text-primary)' }}>{s.type}</span>
                             {s.units <= s.min && <span className="status-badge" style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', fontSize: '0.65rem' }}>SHORTAGE</span>}
                          </div>
                          <div style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                             {s.units} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>units</span>
                          </div>
                          <div style={{ marginTop: 16, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                             <div style={{ height: '100%', width: Math.min((s.units / s.min) * 50, 100) + '%', background: s.units <= s.min ? 'var(--primary)' : 'var(--accent-green)' }}></div>
                          </div>
                          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                             Minimum required: {s.min}
                          </div>
                       </div>
                    ))}
                 </div>
             </div>
          )}
        </div>
      </div>

      {showModal && <RaiseRequestModal onClose={() => setShowModal(false)} onAdd={(r) => setRequests([r, ...requests])} />}
    </div>
  );
}
