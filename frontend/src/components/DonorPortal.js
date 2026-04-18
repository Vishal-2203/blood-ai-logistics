import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons } from './Icons';

export default function DonorPortal({ requests, activeRequestId, onSelectRequest, onRespond, currentUser }) {
  const activeMatches = useMemo(
    () => requests.filter((request) => ['Broadcasting', 'Matching', 'In Transit', 'Tracking Donors', 'Fulfilled'].includes(request.status)),
    [requests]
  );
  const [selectedMatchId, setSelectedMatchId] = useState(activeRequestId || activeMatches[0]?.id || null);

  useEffect(() => {
    if (activeRequestId && activeMatches.some((request) => request.id === activeRequestId)) {
      setSelectedMatchId(activeRequestId);
      return;
    }

    if (!activeMatches.some((request) => request.id === selectedMatchId)) {
      setSelectedMatchId(activeMatches[0]?.id || null);
    }
  }, [activeMatches, activeRequestId, selectedMatchId]);

  const selectedMatch = activeMatches.find((request) => request.id === selectedMatchId) || activeMatches[0] || null;
  const acceptedCount = requests.filter((request) => request.donorStatus === 'accepted').length;

  const handleSelectMatch = (requestId) => {
    setSelectedMatchId(requestId);
    onSelectRequest(requestId);
  };

  const statusText = selectedMatch?.donorStatus === 'accepted'
    ? 'Mission accepted'
    : selectedMatch?.donorStatus === 'declined'
      ? 'Marked unavailable'
      : 'Awaiting response';

  return (
    <div className="animate-in donor-portal-grid">
      <div className="glass-panel donor-match-board">
        <div style={{ marginBottom: 28 }}>
          <div className="section-kicker">Donor Console</div>
          <h2 style={{ margin: '6px 0 8px 0', fontSize: 24 }}>Ready to save a life?</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {activeMatches.length} matching mission{activeMatches.length !== 1 ? 's' : ''} found for {currentUser?.name || 'you'}.
          </p>
        </div>

        {activeMatches.length > 0 ? (
          <div className="donor-match-list">
            {activeMatches.map((match) => (
              <button
                type="button"
                key={match.id}
                className={`donor-match-card ${selectedMatch?.id === match.id ? 'active' : ''}`}
                onClick={() => handleSelectMatch(match.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{match.patient}</div>
                    <div className="queue-meta">{match.location || 'Facility dispatch'}</div>
                  </div>
                  <div className="blood-badge">{match.blood}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>{match.units} units - {match.urgency}</span>
                  <span>{match.status}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Icon d={icons.clock} size={32} style={{ opacity: 0.5 }} />
            <h3>No active matches right now</h3>
            <p>Stay on standby. New emergency broadcasts will show up here automatically.</p>
          </div>
        )}
      </div>

      <div className="glass-panel donor-detail-card">
        {selectedMatch ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <div className="section-kicker">Mission Brief</div>
                <h3 style={{ margin: '6px 0 8px 0', fontSize: 22 }}>{selectedMatch.patient}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {selectedMatch.blood} blood request at {selectedMatch.location || 'the assigned facility'}.
                </p>
              </div>
              <div className={`status-badge ${selectedMatch.status === 'Fulfilled' ? 'status-active' : 'status-pending'}`}>
                {statusText}
              </div>
            </div>

            <div className="detail-list" style={{ marginTop: 24 }}>
              <div className="detail-row">
                <span>Urgency</span>
                <strong>{selectedMatch.urgency}</strong>
              </div>
              <div className="detail-row">
                <span>Units requested</span>
                <strong>{selectedMatch.fulfilled}/{selectedMatch.units} matched</strong>
              </div>
              <div className="detail-row">
                <span>Best ETA</span>
                <strong>{selectedMatch.ai_data?.top_3_donors?.[0]?.eta || 8} minutes</strong>
              </div>
              <div className="detail-row">
                <span>AI guidance</span>
                <strong>{selectedMatch.ai_data?.decision?.reason || 'Stay ready for rapid donor confirmation.'}</strong>
              </div>
            </div>

            <div className="donor-response-banner">
              <Icon d={icons.navigation} size={16} />
              <span>{acceptedCount} mission{acceptedCount === 1 ? '' : 's'} already accepted across the network.</span>
            </div>

            <div className="requestor-actions" style={{ marginTop: 24 }}>
              <button type="button" className="btn btn-ghost" onClick={() => onRespond(selectedMatch.id, 'decline')}>
                Not Available
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
                onClick={() => onRespond(selectedMatch.id, 'accept')}
                disabled={selectedMatch.donorStatus === 'accepted' || selectedMatch.status === 'Fulfilled'}
              >
                <Icon d={icons.check} size={16} />
                {selectedMatch.status === 'Fulfilled'
                  ? 'Already Fulfilled'
                  : selectedMatch.donorStatus === 'accepted'
                    ? 'Mission Accepted'
                    : 'Accept Mission'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Icon d={icons.navigation} size={32} />
            <h3>Select a mission</h3>
            <p>Choose any active match to see routing and response details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
