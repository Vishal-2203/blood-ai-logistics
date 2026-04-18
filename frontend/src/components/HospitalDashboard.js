import React, { useState } from 'react';
import { Icon, icons } from './Icons';
import AIInsights from './AIInsights';
import LiveMap from './LiveMap';

function buildRecommendations(activeRequest, donors) {
  if (activeRequest?.ai_data?.top_3_donors?.length) {
    return activeRequest.ai_data.top_3_donors.map((donor, index) => ({
      ...donor,
      eta: donor.eta || 8 + index * 4
    }));
  }

  return donors.slice(0, 3).map((donor, index) => ({
    ...donor,
    score: Number(Math.max(0.55, 0.92 - index * 0.1).toFixed(2)),
    distance: Number((1.2 + index * 0.8).toFixed(1))
  }));
}

export default function HospitalDashboard({
  requests,
  donors,
  stock,
  activeRequest,
  onSelectRequest,
  onTrackRequest,
  onAdvanceRequest,
  onResolveRequest,
  authToken,
  focusedDonorId,
  onFocusDonor,
  onUpdateRequestLocation,
  onNotice
}) {
  const [pickMode, setPickMode] = useState(false);
  const criticalCount = requests.filter((request) => request.urgency === 'Critical').length;
  const pendingUnits = requests.reduce((total, request) => total + Math.max(0, request.units - request.fulfilled), 0);
  const shortageCount = stock.filter((item) => item.units < item.min).length;
  const recommendations = buildRecommendations(activeRequest, donors);

  const handleUseMyLocation = () => {
    if (!activeRequest?.id) {
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
        onUpdateRequestLocation?.(activeRequest.id, {
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
    <div className="animate-in hospital-dashboard">
      <div className="stats-grid command-stats">
        <div className="stat-card" style={{ '--accent-color': 'var(--primary)', '--accent-bg': 'rgba(232, 25, 60, 0.15)' }}>
          <div className="stat-icon"><Icon d={icons.requests} /></div>
          <div className="stat-label">Live Requests</div>
          <div className="stat-value">{requests.length}</div>
          <div className="stat-trend down">{criticalCount} critical missions in queue</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--accent-blue)', '--accent-bg': 'rgba(59, 130, 246, 0.16)' }}>
          <div className="stat-icon"><Icon d={icons.map_pin} /></div>
          <div className="stat-label">Active Donors</div>
          <div className="stat-value">{donors.length}</div>
          <div className="stat-trend">Closest donor ETA {donors[0]?.eta || 12} min</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--accent-amber)', '--accent-bg': 'rgba(245, 158, 11, 0.16)' }}>
          <div className="stat-icon"><Icon d={icons.alert} /></div>
          <div className="stat-label">Units Pending</div>
          <div className="stat-value">{pendingUnits}</div>
          <div className="stat-trend down">{shortageCount} blood groups below minimum</div>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--accent-green)', '--accent-bg': 'rgba(16, 185, 129, 0.16)' }}>
          <div className="stat-icon"><Icon d={icons.check} /></div>
          <div className="stat-label">Fulfillment Rate</div>
          <div className="stat-value">
            {requests.length ? Math.round((requests.reduce((total, request) => total + request.fulfilled, 0) / requests.reduce((total, request) => total + request.units, 0)) * 100) : 0}%
          </div>
          <div className="stat-trend">{activeRequest?.status || 'Monitoring queue'}</div>
        </div>
      </div>

      <div className="hospital-dashboard-grid">
        <div className="glass-panel operations-panel">
          <div className="operations-header">
            <div>
              <div className="section-kicker">Command Map</div>
              <h3 style={{ margin: '6px 0 0 0' }}>Live donor tracking for {activeRequest?.patient || 'the active request'}</h3>
              <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)' }}>
                Routing toward {activeRequest?.location || 'the receiving facility'} with continuous AI prioritization.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {activeRequest && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => onTrackRequest(activeRequest.id)}>
                  <Icon d={icons.navigation} size={14} /> Open Request Tracker
                </button>
              )}
              {activeRequest && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => setPickMode((value) => !value)}
                >
                  <Icon d={pickMode ? icons.x : icons.map_pin} size={14} /> {pickMode ? 'Cancel Pick' : 'Pick Drop Site'}
                </button>
              )}
              {activeRequest && (
                <button type="button" className="btn btn-ghost btn-small" onClick={handleUseMyLocation}>
                  <Icon d={icons.navigation} size={14} /> Use My Location
                </button>
              )}
              {focusedDonorId && (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => onFocusDonor?.(null)}>
                  <Icon d={icons.x} size={14} /> Clear Focus
                </button>
              )}
            </div>
          </div>

          <LiveMap
            donors={donors}
            activeRequest={activeRequest}
            focusedDonorId={focusedDonorId}
            onFocusDonor={(id) => {
              onFocusDonor?.(id);
              setPickMode(false);
            }}
            pickMode={pickMode}
            onPickTarget={(latlng) => {
              if (!activeRequest?.id) return;
              onUpdateRequestLocation?.(activeRequest.id, {
                lat: latlng.lat,
                lng: latlng.lng,
                location: `Pinned (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`
              });
              setPickMode(false);
            }}
          />

          <div className="recommendation-list">
            {recommendations.map((donor, index) => (
              <button
                type="button"
                key={`${donor.name}-${index}`}
                className="recommendation-item"
                onClick={() => onFocusDonor?.(donor.id || donor.name)}
                style={{ cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <strong>#{index + 1} {donor.name}</strong>
                  <span>{donor.distance ? `${Number(donor.distance).toFixed(2)} km away` : `${donor.eta || 10} min ETA`} - Score {donor.score}</span>
                </div>
                <div className="recommendation-score">{donor.eta || 10}m</div>
              </button>
            ))}
          </div>

          {activeRequest && (
            <div className="command-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onAdvanceRequest(activeRequest.id)}
                disabled={activeRequest.status === 'Fulfilled'}
              >
                <Icon d={icons.plus} size={14} />
                Secure Next Unit
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onResolveRequest(activeRequest.id)}
                disabled={activeRequest.status === 'Fulfilled'}
              >
                <Icon d={icons.check} size={14} />
                Mark Fulfilled
              </button>
            </div>
          )}
        </div>

        <div className="hospital-side-column">
          <AIInsights activeRequest={activeRequest} stock={stock} authToken={authToken} />

          <div className="glass-panel request-queue-panel">
            <div className="request-panel-header">
              <div>
                <div className="section-kicker">Mission Queue</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 4 }}>Select a request to inspect</div>
              </div>
              <div className="status-badge status-pending">{requests.length} open</div>
            </div>

            <div className="request-queue-list">
              {requests.map((request) => (
                <button
                  type="button"
                  key={request.id}
                  className={`queue-item ${activeRequest?.id === request.id ? 'active' : ''}`}
                  onClick={() => onSelectRequest(request.id)}
                >
                  <div className="queue-item-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="blood-badge">{request.blood}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{request.patient}</div>
                        <div className="queue-meta">{request.location}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{request.fulfilled}/{request.units}</div>
                      <div className="queue-meta">{request.status}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {shortageCount > 0 && (
            <div className="glass-panel shortage-panel">
              <div className="section-kicker">Inventory Alerts</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, margin: '6px 0 14px 0' }}>
                {shortageCount} blood groups need replenishment
              </div>
              <div className="shortage-list">
                {stock.filter((item) => item.units < item.min).map((item) => (
                  <div key={item.type} className="shortage-row">
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.type}</div>
                      <div className="queue-meta">Minimum target {item.min} units</div>
                    </div>
                    <div className="shortage-value">{item.units}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
