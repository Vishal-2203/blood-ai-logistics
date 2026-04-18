import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons } from './Icons';
import LiveMap from './LiveMap';

const STAGES = [
  { key: 'Broadcasting', icon: 'navigation', label: 'Broadcasting', caption: 'Request is reaching available donors.' },
  { key: 'Matching', icon: 'users', label: 'Matching', caption: 'AI is prioritizing the best donor shortlist.' },
  { key: 'In Transit', icon: 'clock', label: 'In Transit', caption: 'Confirmed donor is moving toward the facility.' },
  { key: 'Fulfilled', icon: 'check', label: 'Fulfilled', caption: 'Requested units have been secured.' }
];

function getStageIndex(status = 'Broadcasting') {
  if (status === 'Fulfilled') return 3;
  if (status === 'In Transit' || status === 'Tracking Donors') return 2;
  if (status === 'Matching') return 1;
  return 0;
}

function buildCoordinationNotes(request) {
  if (!request) {
    return [];
  }

  const shortlist = request.ai_data?.top_3_donors || [];
  const leadDonor = shortlist[0];

  return [
    {
      id: 'brief',
      title: 'Dispatch Brief',
      text: `${request.units} unit${request.units === 1 ? '' : 's'} of ${request.blood} requested for ${request.patient} at ${request.location}.`,
      tone: 'info'
    },
    {
      id: 'ai',
      title: 'AI Recommendation',
      text: request.ai_data?.decision?.reason || 'The AI engine is still assembling its donor rationale.',
      tone: 'insight'
    },
    {
      id: 'lead',
      title: 'Lead Donor',
      text: leadDonor
        ? `${leadDonor.name} is leading with score ${leadDonor.score} and an estimated ${leadDonor.eta || 8} minute arrival.`
        : 'No donor shortlist is available yet for this request.',
      tone: 'success'
    },
    {
      id: 'inventory',
      title: 'Inventory Watch',
      text: request.ai_data?.system_health?.public_message || 'Inventory pressure is stable while coordination continues.',
      tone: 'warning'
    }
  ];
}

export default function RequestorPortal({
  request,
  donors = [],
  activeSection = 'tracker',
  onSectionChange,
  onAdvanceRequest,
  onResolveRequest,
  onReturnToHospital,
  focusedDonorId,
  onFocusDonor,
  onUpdateRequestLocation,
  onNotice
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const coordinationNotes = useMemo(() => buildCoordinationNotes(request), [request]);

  useEffect(() => {
    if (activeSection !== 'tracker') {
      setPickMode(false);
    }
  }, [activeSection]);

  if (!request) {
    return (
      <div className="animate-in glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <h1 style={{ marginBottom: 12 }}>Track Your Request</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Raise a request from the command center to begin live tracking.</p>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(request.status);
  const matchedDonors = request?.ai_data?.top_3_donors?.length || 2;
  const topScore = request?.ai_data?.top_3_donors?.[0]?.score;
  const successRate = topScore ? `${Math.round(topScore * 100)}%` : '85%';

  const handleUseMyLocation = () => {
    if (!request?.id) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onNotice?.('Geolocation is not available in this browser.', 'warning');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        onUpdateRequestLocation?.(request.id, {
          lat,
          lng,
          location: 'Pinned (My Location)'
        });
        setPickMode(false);
      },
      (error) => {
        onNotice?.(error.message || 'Unable to read your location.', 'warning');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 10_000
      }
    );
  };

  return (
    <div className="animate-in requestor-layout">
      <div className="glass-panel tracker-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="section-kicker">Live Tracker</div>
            <h1 style={{ margin: '8px 0 12px 0', fontSize: 28 }}>Tracking {request.patient}</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {request.blood} request at {request.location} - Status: {request.status}
            </p>
          </div>
          <div className="status-badge status-active">{request.fulfilled}/{request.units} units secured</div>
        </div>

        <div className="requestor-tab-strip" aria-label="Requestor workspace sections">
          <button
            type="button"
            className={`requestor-tab ${activeSection === 'tracker' ? 'active' : ''}`}
            aria-pressed={activeSection === 'tracker'}
            onClick={() => onSectionChange?.('tracker')}
          >
            <Icon d={icons.navigation} size={14} />
            Live Tracker
          </button>
          <button
            type="button"
            className={`requestor-tab ${activeSection === 'notes' ? 'active' : ''}`}
            aria-pressed={activeSection === 'notes'}
            onClick={() => onSectionChange?.('notes')}
          >
            <Icon d={icons.history} size={14} />
            Coordination Notes
          </button>
        </div>

        <div className="stage-flow">
          {STAGES.map((stage, index) => {
            const stateClass = index < currentStageIndex ? 'complete' : index === currentStageIndex ? 'current' : '';
            return (
              <React.Fragment key={stage.key}>
                <div className={`stage-card ${stateClass}`}>
                  <Icon d={icons[stage.icon]} size={18} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{stage.label}</div>
                    <div className="queue-meta">{stage.caption}</div>
                  </div>
                </div>
                {index < STAGES.length - 1 && <div className={`stage-connector ${index < currentStageIndex ? 'active' : ''}`}></div>}
              </React.Fragment>
            );
          })}
        </div>

        {activeSection === 'tracker' && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => setPickMode((value) => !value)}
              >
                <Icon d={pickMode ? icons.x : icons.map_pin} size={14} /> {pickMode ? 'Cancel Pick' : 'Pick Drop Site'}
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={handleUseMyLocation}>
                <Icon d={icons.navigation} size={14} /> Use My Location
              </button>
              {focusedDonorId && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => onFocusDonor?.(null)}>
                  <Icon d={icons.x} size={14} /> Clear Focus
                </button>
              )}
            </div>

            <LiveMap
              donors={donors}
              activeRequest={request}
              focusedDonorId={focusedDonorId}
              onFocusDonor={onFocusDonor}
              pickMode={pickMode}
              onPickTarget={(latlng) => {
                if (!request?.id) return;
                onUpdateRequestLocation?.(request.id, {
                  lat: latlng.lat,
                  lng: latlng.lng,
                  location: `Pinned (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`
                });
                setPickMode(false);
              }}
            />
          </div>
        )}

        <div className="stats-grid requestor-stats">
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 4 }}>{matchedDonors}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Donors matched</div>
          </div>
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffc107', marginBottom: 4 }}>
              {request.ai_data?.top_3_donors?.[0]?.eta || 8} min
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Best ETA</div>
          </div>
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#4facfe', marginBottom: 4 }}>{successRate}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Success confidence</div>
          </div>
        </div>

        <div className="requestor-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowDetails((current) => !current)}>
            <Icon d={showDetails ? icons.x : icons.plus} size={14} />
            {showDetails ? 'Hide Details' : 'View Full Details'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onAdvanceRequest(request.id)}
            disabled={request.status === 'Fulfilled'}
          >
            <Icon d={icons.plus} size={14} />
            Confirm Next Unit
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onResolveRequest(request.id)}
            disabled={request.status === 'Fulfilled'}
          >
            <Icon d={icons.check} size={14} />
            Mark Complete
          </button>
          <button type="button" className="btn btn-ghost" onClick={onReturnToHospital}>
            <Icon d={icons.dashboard} size={14} /> Back to Command Center
          </button>
        </div>
      </div>

      {activeSection === 'notes' && (
        <div className="glass-panel coordination-panel">
          <div className="coordination-header">
            <div>
              <div className="section-kicker">Coordination Notes</div>
              <h3 style={{ margin: '8px 0 0 0' }}>Shared updates for {request.patient}</h3>
            </div>
            <div className="status-badge status-pending">{request.status}</div>
          </div>

          <div className="coordination-note-list">
            {coordinationNotes.map((note) => (
              <div key={note.id} className={`coordination-note coordination-${note.tone}`}>
                <div className="coordination-note-icon">
                  <Icon
                    d={note.tone === 'warning' ? icons.alert : note.tone === 'success' ? icons.check : note.tone === 'insight' ? icons.clock : icons.navigation}
                    size={16}
                  />
                </div>
                <div className="coordination-note-copy">
                  <strong>{note.title}</strong>
                  <span>{note.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDetails && (
        <div className="requestor-detail-grid">
          <div className="glass-panel">
            <div className="section-kicker">Request Summary</div>
            <div className="detail-list" style={{ marginTop: 16 }}>
              <div className="detail-row">
                <span>Facility</span>
                <strong>{request.location}</strong>
              </div>
              <div className="detail-row">
                <span>Blood type</span>
                <strong>{request.blood}</strong>
              </div>
              <div className="detail-row">
                <span>Units required</span>
                <strong>{request.units}</strong>
              </div>
              <div className="detail-row">
                <span>AI audit</span>
                <strong>{request.ai_data?.system_health?.public_message || 'Coordinating donor shortlist.'}</strong>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="section-kicker">Top Donor Shortlist</div>
            <div className="recommendation-list" style={{ marginTop: 16 }}>
              {(request.ai_data?.top_3_donors || []).length > 0 ? (
                request.ai_data.top_3_donors.map((donor, index) => (
                  <div key={`${donor.name}-${index}`} className="recommendation-item">
                    <div>
                      <strong>{donor.name}</strong>
                      <span>{Number(donor.distance || 0).toFixed(2)} km - Score {donor.score}</span>
                    </div>
                    <div className="recommendation-score">#{index + 1}</div>
                  </div>
                ))
              ) : (
                <div className="queue-meta">AI shortlist will appear here once donor ranking completes.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
