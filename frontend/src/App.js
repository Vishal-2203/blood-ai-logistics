import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import LoginPage from './LoginPage';
import HospitalDashboard from './components/HospitalDashboard';
import DonorPortal from './components/DonorPortal';
import RequestorPortal from './components/RequestorPortal';
import { Icon, icons } from './components/Icons';
import { apiJson, getRealtimeBaseUrl } from './api';

const DEFAULT_LOCATION = {
  location: 'AIIMS Emergency Wing',
  lat: 28.567,
  lng: 77.21
};

const INITIAL_REQUESTS = [
  {
    id: 'REQ-1011',
    patient: 'Anjali Verma',
    blood: 'O-',
    units: 4,
    fulfilled: 1,
    urgency: 'Critical',
    status: 'In Transit',
    time: '10m ago',
    donorStatus: 'accepted',
    ...DEFAULT_LOCATION
  },
  {
    id: 'REQ-1012',
    patient: 'Rajesh Khanna',
    blood: 'B-',
    units: 2,
    fulfilled: 0,
    urgency: 'High',
    status: 'Matching',
    time: '1h ago',
    donorStatus: 'pending',
    ...DEFAULT_LOCATION,
    location: 'North Block Coordination Hub',
    lat: 28.617,
    lng: 77.213
  }
];

const INITIAL_DONORS = [
  { id: 'D-012', name: 'Ravi Kumar', blood: 'O-', lat: 28.545, lng: 77.19, eta: 14, status: 'Ready' },
  { id: 'D-045', name: 'Priya Rangan', blood: 'O-', lat: 28.59, lng: 77.23, eta: 22, status: 'Preparing' },
  { id: 'D-113', name: 'Aman Joshi', blood: 'B-', lat: 28.571, lng: 77.181, eta: 11, status: 'Queued' }
];

const INITIAL_STOCK = [
  { type: 'A+', units: 42, min: 50 },
  { type: 'A-', units: 12, min: 20 },
  { type: 'B+', units: 35, min: 40 },
  { type: 'B-', units: 8, min: 15 },
  { type: 'O+', units: 68, min: 80 },
  { type: 'O-', units: 2, min: 25 },
  { type: 'AB+', units: 18, min: 20 },
  { type: 'AB-', units: 5, min: 10 }
];

const STORAGE_KEY = 'blood-agent-state-v1';
const AUTH_STORAGE_KEY = 'blood-agent-auth-v1';

function readStoredAppState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    return rawState ? JSON.parse(rawState) : null;
  } catch (err) {
    console.warn('Unable to restore saved app state.', err);
    return null;
  }
}

function readStoredAuthState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawAuthState = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return rawAuthState ? JSON.parse(rawAuthState) : null;
  } catch (err) {
    console.warn('Unable to restore saved auth state.', err);
    return null;
  }
}

function getInitialRequests() {
  const storedState = readStoredAppState();
  return Array.isArray(storedState?.requests) ? storedState.requests : INITIAL_REQUESTS;
}

function getInitialDonors() {
  const storedState = readStoredAppState();
  return Array.isArray(storedState?.donors) ? storedState.donors : INITIAL_DONORS;
}

function getInitialStock() {
  const storedState = readStoredAppState();
  return Array.isArray(storedState?.stock) ? storedState.stock : INITIAL_STOCK;
}

function getInitialActiveRequestId() {
  const storedState = readStoredAppState();
  if (storedState?.activeRequestId) {
    return storedState.activeRequestId;
  }

  if (Array.isArray(storedState?.requests)) {
    return storedState.requests[0]?.id || null;
  }

  return INITIAL_REQUESTS[0]?.id || null;
}

function buildRoleSubtitle(view, requests, activeRequest) {
  if (view === 'hospital') {
    return `Monitoring ${requests.length} live request${requests.length === 1 ? '' : 's'} across the network.`;
  }

  if (view === 'donor') {
    return activeRequest
      ? `Next priority mission: ${activeRequest.blood} for ${activeRequest.patient}.`
      : 'Stand by for nearby donation opportunities.';
  }

  return activeRequest
    ? `Current stage: ${activeRequest.status}. ${activeRequest.fulfilled}/${activeRequest.units} units secured.`
    : 'AI request tracking is ready when the next emergency is raised.';
}

function sortRequests(requests) {
  return [...requests].sort((left, right) => {
    const rightTimestamp = Date.parse(right.updatedAt || 0);
    const leftTimestamp = Date.parse(left.updatedAt || 0);
    return rightTimestamp - leftTimestamp;
  });
}

function upsertRequest(currentRequests, incomingRequest) {
  return sortRequests([
    incomingRequest,
    ...currentRequests.filter((request) => request.id !== incomingRequest.id)
  ]);
}

function upsertDonor(currentDonors, incomingDonor) {
  const nextDonors = [
    incomingDonor,
    ...currentDonors.filter((donor) => donor.id !== incomingDonor.id)
  ];

  return nextDonors.sort((left, right) => left.name.localeCompare(right.name));
}

function upsertStock(currentStock, incomingStock) {
  const stockOrder = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  return [
    incomingStock,
    ...currentStock.filter((item) => item.type !== incomingStock.type)
  ].sort((left, right) => stockOrder.indexOf(left.type) - stockOrder.indexOf(right.type));
}

function RaiseRequestModal({ authToken, onClose, onAdd, onError }) {
  const [form, setForm] = useState({
    patient: '',
    blood: 'O-',
    units: 1,
    urgency: 'Critical'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiJson('/request-blood', {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({
          patient: form.patient.trim(),
          bloodGroup: form.blood,
          units: form.units,
          urgency: form.urgency,
          location: DEFAULT_LOCATION.location,
          lat: DEFAULT_LOCATION.lat,
          lng: DEFAULT_LOCATION.lng,
          text: `${form.urgency} request for ${form.units} unit${form.units > 1 ? 's' : ''} of ${form.blood} blood for ${form.patient.trim() || 'a patient'} at ${DEFAULT_LOCATION.location}`
        })
      });

      onAdd(data.request);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      onError?.(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal glass-panel"
        onClick={(event) => event.stopPropagation()}
        style={{ borderTop: '4px solid var(--primary)' }}
      >
        <div className="modal-title"><Icon d={icons.plus} color="var(--primary)" /> Raise AI Broadcast</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="request-patient-name">Patient Full Name</label>
            <input
              id="request-patient-name"
              className="form-input"
              placeholder="e.g. John Doe"
              value={form.patient}
              onChange={(event) => setForm({ ...form, patient: event.target.value })}
            />
          </div>

          <div className="form-grid" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="request-blood-group">Blood Group</label>
              <select
                id="request-blood-group"
                className="form-select"
                value={form.blood}
                onChange={(event) => setForm({ ...form, blood: event.target.value })}
              >
                {['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map((blood) => (
                  <option key={blood}>{blood}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="request-units">Units (350ml)</label>
              <input
                id="request-units"
                className="form-input"
                type="number"
                min="1"
                value={form.units}
                onChange={(event) => setForm({ ...form, units: Math.max(1, parseInt(event.target.value || '1', 10)) })}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" htmlFor="request-urgency">Urgency</label>
            <select
              id="request-urgency"
              className="form-select"
              value={form.urgency}
              onChange={(event) => setForm({ ...form, urgency: event.target.value })}
            >
              {['Critical', 'High', 'Normal'].map((urgency) => (
                <option key={urgency}>{urgency}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="auth-banner" role="alert" style={{ marginBottom: 16 }}>
              <Icon d={icons.alert} size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Broadcast Emergency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const storedAuth = readStoredAuthState();
  const socketRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(storedAuth?.token));
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(storedAuth?.token));
  const [user, setUser] = useState(storedAuth?.user || null);
  const [authToken, setAuthToken] = useState(storedAuth?.token || null);
  const [activeView, setActiveView] = useState(storedAuth?.user?.role || 'hospital');
  const [requests, setRequests] = useState(getInitialRequests);
  const [donors, setDonors] = useState(getInitialDonors);
  const [stock, setStock] = useState(getInitialStock);
  const [showModal, setShowModal] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState(getInitialActiveRequestId);
  const [requestorSection, setRequestorSection] = useState('tracker');
  const [notice, setNotice] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [focusedDonorId, setFocusedDonorId] = useState(null);

  useEffect(() => {
    if (!storedAuth?.token) {
      setIsSessionLoading(false);
      return undefined;
    }

    let isCancelled = false;

    const restoreSession = async () => {
      try {
        const data = await apiJson('/session/bootstrap', {
          token: storedAuth.token
        });

        if (isCancelled) {
          return;
        }

        setUser(data.user);
        setRequests(data.requests);
        setDonors(data.donors);
        setStock(data.stock);
        setActiveView((currentView) => (currentView === 'requestor' && data.user.role === 'hospital' ? currentView : data.user.role));
        setIsAuthenticated(true);
      } catch (error) {
        if (!isCancelled) {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthToken(null);
          setUser(null);
          setIsAuthenticated(false);
          setActiveView('hospital');
        }
      } finally {
        if (!isCancelled) {
          setIsSessionLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isCancelled = true;
    };
  }, [storedAuth?.token]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 3600);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (requests.some((request) => request.id === activeRequestId)) {
      return;
    }

    setActiveRequestId(requests[0]?.id || null);
  }, [requests, activeRequestId]);

  useEffect(() => {
    setFocusedDonorId(null);
  }, [activeRequestId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        requests,
        donors,
        stock,
        activeRequestId
      })
    );
  }, [requests, donors, stock, activeRequestId]);

  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      return undefined;
    }

    const socket = io(getRealtimeBaseUrl(), {
      auth: { token: authToken }
    });

    if (!socket || typeof socket.on !== 'function') {
      return undefined;
    }

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('request_created', (request) => {
      setRequests((currentRequests) => upsertRequest(currentRequests, request));
    });

    socket.on('request_updated', (request) => {
      setRequests((currentRequests) => upsertRequest(currentRequests, request));
    });

    socket.on('stock_updated', (stockItem) => {
      setStock((currentStock) => upsertStock(currentStock, stockItem));
    });

    socket.on('donor_location_update', ({ donor }) => {
      if (donor) {
        setDonors((currentDonors) => upsertDonor(currentDonors, donor));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [isAuthenticated, authToken]);

  useEffect(() => {
    if (!socketRef.current || !activeRequestId) {
      return;
    }

    socketRef.current.emit('join_tracking', activeRequestId);
  }, [activeRequestId]);

  const activeRequest = requests.find((request) => request.id === activeRequestId) || requests[0] || null;

  const availableViews = useMemo(() => {
    if (!user?.role) {
      return ['hospital'];
    }

    if (user.role === 'hospital') {
      return ['hospital', 'requestor'];
    }

    return [user.role];
  }, [user?.role]);

  const showNotice = (message, tone = 'info') => {
    setNotice({
      id: Date.now(),
      message,
      tone
    });
  };

  const handleSessionStart = (sessionPayload) => {
    const nextAuthState = {
      token: sessionPayload.token,
      user: sessionPayload.user
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));
    setAuthToken(sessionPayload.token);
    setUser(sessionPayload.user);
    setIsAuthenticated(true);
    setActiveView(sessionPayload.user.role);
    setRequests(sessionPayload.requests);
    setDonors(sessionPayload.donors);
    setStock(sessionPayload.stock);
    setActiveRequestId(sessionPayload.requests[0]?.id || null);
    showNotice(`Welcome back, ${sessionPayload.user.name}.`, 'success');
  };

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setActiveView('hospital');
    setNotice(null);
    setSocketConnected(false);
  };

  const handleRequestCreated = (request) => {
    setRequests((currentRequests) => upsertRequest(currentRequests, request));
    setActiveRequestId(request.id);
    showNotice(`Broadcast created for ${request.blood}. Command center is matching donors now.`, 'success');
  };

  const handleSelectRequest = (requestId) => {
    setActiveRequestId(requestId);
  };

  const handleTrackRequest = (requestId) => {
    setActiveRequestId(requestId);
    setRequestorSection('tracker');
    if (availableViews.includes('requestor')) {
      setActiveView('requestor');
    }
  };

  const handleUpdateRequestLocation = async (requestId, { lat, lng, location }) => {
    const nextLat = Number(lat);
    const nextLng = Number(lng);

    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      showNotice('Please choose a valid map location.', 'warning');
      return;
    }

    const optimisticLocation = String(location || '').trim() || `Pinned (${nextLat.toFixed(4)}, ${nextLng.toFixed(4)})`;

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId
          ? { ...request, lat: nextLat, lng: nextLng, location: optimisticLocation, updatedAt: new Date().toISOString() }
          : request
      )
    );

    try {
      const data = await apiJson(`/requests/${requestId}/location`, {
        method: 'PATCH',
        token: authToken,
        body: JSON.stringify({
          lat: nextLat,
          lng: nextLng,
          location: optimisticLocation
        })
      });

      if (data?.request) {
        setRequests((currentRequests) => upsertRequest(currentRequests, data.request));
      }

      showNotice('Drop site updated.', 'success');
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  };

  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleFetchDonorsNear = (lat, lng, radiusKm = 7) => {
    // look for existing donors within radius; if none, synthesize a few nearby mock donors
    const nearby = donors.filter((d) => {
      if (d?.lat == null || d?.lng == null) return false;
      return haversineDistance(lat, lng, Number(d.lat), Number(d.lng)) <= radiusKm;
    });

    if (nearby.length > 0) {
      // move nearby donors to the front (keep unique)
      const remaining = donors.filter((d) => !nearby.find((n) => n.id === d.id));
      setDonors([...nearby, ...remaining]);
      showNotice(`${nearby.length} donor(s) found near your location.`, 'success');
      return;
    }

    // create 3 mock donors near the provided location
    const mock = [0, 1, 2].map((i) => {
      const jitter = (i + 1) * 0.003; // ~300m increments
      return {
        id: `D-MOCK-${Date.now()}-${i}`,
        name: `Nearby Donor ${i + 1}`,
        blood: ['O-', 'A+', 'B-'][i % 3],
        lat: lat + jitter,
        lng: lng - jitter,
        eta: 8 + i * 4,
        status: 'Ready'
      };
    });

    setDonors((current) => {
      // prepend mock donors but avoid id collisions
      const existingIds = new Set(current.map((d) => d.id));
      const toAdd = mock.filter((m) => !existingIds.has(m.id));
      return [...toAdd, ...current];
    });

    showNotice('No registered donors found nearby — showing nearby volunteers.', 'info');
  };

  const handleAdvanceRequest = async (requestId) => {
    try {
      const data = await apiJson(`/requests/${requestId}/advance`, {
        method: 'PATCH',
        token: authToken
      });

      setRequests((currentRequests) => upsertRequest(currentRequests, data.request));
      setActiveRequestId(data.request.id);
      showNotice(
        data.request.status === 'Fulfilled'
          ? `${data.request.patient}'s request is now marked fulfilled.`
          : `Another unit was secured for ${data.request.patient}.`,
        'success'
      );
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  };

  const handleResolveRequest = async (requestId) => {
    try {
      const data = await apiJson(`/requests/${requestId}/resolve`, {
        method: 'PATCH',
        token: authToken
      });

      setRequests((currentRequests) => upsertRequest(currentRequests, data.request));
      setActiveRequestId(data.request.id);
      showNotice(`${data.request.patient}'s request was closed out from command center.`, 'success');
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  };

  const handleDonorResponse = async (requestId, decision) => {
    try {
      const data = await apiJson(`/requests/${requestId}/respond`, {
        method: 'PATCH',
        token: authToken,
        body: JSON.stringify({ decision })
      });

      setRequests((currentRequests) => upsertRequest(currentRequests, data.request));

      if (data.stock) {
        setStock((currentStock) => upsertStock(currentStock, data.stock));
      }

      if (data.donor) {
        setDonors((currentDonors) => upsertDonor(currentDonors, data.donor));
      }

      setActiveRequestId(data.request.id);
      showNotice(
        decision === 'accept'
          ? data.request.status === 'Fulfilled'
            ? `${data.request.patient}'s request is now fulfilled. Intake teams have been notified.`
            : `Mission accepted. ${data.request.patient}'s request is now in transit.`
          : `Command center has been told you cannot take ${data.request.patient}'s mission right now.`,
        decision === 'accept' ? 'success' : 'warning'
      );
    } catch (error) {
      showNotice(error.message, 'warning');
    }
  };

  if (isSessionLoading) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="logo-icon-animate" style={{ margin: '0 auto 16px' }}>
            <Icon d={icons.clock} size={28} color="#4facfe" />
          </div>
          <h2 style={{ marginBottom: 8 }}>Restoring secure session</h2>
          <p className="step-description" style={{ marginBottom: 0 }}>
            Syncing your account, requests, donors, and inventory from the persistent backend.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleSessionStart} />;
  }

  const subtitle = buildRoleSubtitle(activeView, requests, activeRequest);

  return (
    <div className={`app-shell theme-${activeView}`}>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon-wrap"><Icon d={icons.drop} color="var(--primary)" /></div>
          <span className="logo-text"><span>Blood</span>Agent</span>
        </div>

        <div className="role-switcher" style={{ marginBottom: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {availableViews.map((view) => {
            const roleNames = { hospital: 'Hospital', donor: 'Donor', requestor: 'Request Tracker' };
            const isActive = activeView === view;

            return (
              <button
                type="button"
                key={view}
                className={`role-tab ${isActive ? 'active' : ''}`}
                aria-pressed={isActive}
                onClick={() => setActiveView(view)}
                style={{
                  background: isActive ? 'rgba(79, 172, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: isActive ? '1.5px solid #4facfe' : '1.5px solid rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#4facfe' : '#fff',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  textAlign: 'center'
                }}
              >
                {roleNames[view]}
              </button>
            );
          })}
        </div>

        {activeView === 'hospital' && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="nav-item active"><Icon d={icons.dashboard} /> Control Center</div>
            <div className="nav-item"><Icon d={icons.requests} /> Dispatch History</div>
            <div className="nav-item"><Icon d={icons.history} /> Bio-Metrics</div>
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowModal(true)}>
                + New Request
              </button>
            </div>
          </nav>
        )}

        {activeView === 'donor' && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="nav-item active"><Icon d={icons.requests} /> Active Missions</div>
            <div className="nav-item"><Icon d={icons.history} /> Reward Points</div>
          </nav>
        )}

        {activeView === 'requestor' && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className={`nav-item ${requestorSection === 'tracker' ? 'active' : ''}`}
              onClick={() => setRequestorSection('tracker')}
            >
              <Icon d={icons.navigation} /> Live Tracker
            </button>
            <button
              type="button"
              className={`nav-item ${requestorSection === 'notes' ? 'active' : ''}`}
              onClick={() => setRequestorSection('notes')}
            >
              <Icon d={icons.history} /> Coordination Notes
            </button>
          </nav>
        )}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="page-title">
              {activeView === 'hospital' ? 'Facility Command' : activeView === 'donor' ? 'Life-Saver Hub' : 'Track Your Request'}
            </div>
            <div className="page-subtitle">{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              className="status-badge"
              style={{
                background: socketConnected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.14)',
                color: socketConnected ? 'var(--accent-green)' : 'var(--accent-amber)'
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  background: socketConnected ? 'var(--accent-green)' : 'var(--accent-amber)',
                  borderRadius: '50%',
                  marginRight: 8
                }}
              ></div>
              {socketConnected ? 'Realtime Connected' : 'Realtime Reconnecting'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
              <div style={{ fontSize: '0.9rem', textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{user?.name || user?.email || 'User'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {(user?.role || activeView).charAt(0).toUpperCase() + (user?.role || activeView).slice(1)}
                </div>
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
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="page-content">
          {activeView === 'hospital' && (
            <HospitalDashboard
              requests={requests}
              donors={donors}
              stock={stock}
              activeRequest={activeRequest}
              onSelectRequest={handleSelectRequest}
              onTrackRequest={handleTrackRequest}
              onAdvanceRequest={handleAdvanceRequest}
              onResolveRequest={handleResolveRequest}
              authToken={authToken}
              focusedDonorId={focusedDonorId}
              onFocusDonor={setFocusedDonorId}
              onUpdateRequestLocation={handleUpdateRequestLocation}
                onNotice={showNotice}
                onFetchDonorsNear={handleFetchDonorsNear}
            />
          )}
          {activeView === 'donor' && (
            <DonorPortal
              requests={requests}
              activeRequestId={activeRequestId}
              onSelectRequest={handleSelectRequest}
              onRespond={handleDonorResponse}
              currentUser={user}
            />
          )}
          {activeView === 'requestor' && (
            <RequestorPortal
              request={activeRequest}
              donors={donors}
              activeSection={requestorSection}
              onSectionChange={setRequestorSection}
              onAdvanceRequest={handleAdvanceRequest}
              onResolveRequest={handleResolveRequest}
              focusedDonorId={focusedDonorId}
              onFocusDonor={setFocusedDonorId}
              onUpdateRequestLocation={handleUpdateRequestLocation}
              onNotice={showNotice}
              onReturnToHospital={() => setActiveView(user?.role === 'hospital' ? 'hospital' : user?.role || 'requestor')}
            />
          )}
        </section>
      </main>

      {showModal && activeView === 'hospital' && (
        <RaiseRequestModal
          authToken={authToken}
          onClose={() => setShowModal(false)}
          onAdd={handleRequestCreated}
          onError={(message) => showNotice(message, 'warning')}
        />
      )}

      {notice && (
        <div className={`notice-toast notice-${notice.tone}`} role="status" aria-live="polite">
          <Icon d={notice.tone === 'warning' ? icons.alert : notice.tone === 'success' ? icons.check : icons.clock} size={16} />
          <span>{notice.message}</span>
          <button type="button" className="toast-close" onClick={() => setNotice(null)}>
            <Icon d={icons.x} size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
