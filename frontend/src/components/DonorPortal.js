import React, { useState } from 'react';
import { Icon, icons } from './Icons';

export default function DonorPortal({ requests }) {
  const [selectedMatch, setSelectedMatch] = useState(null);

  const activeMatches = requests.filter(r => r.status === 'Broadcasting' || r.status === 'Tracking Donors');

  return (
    <div className="animate-in glass-panel" style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ width: 60, height: 60, background: 'linear-gradient(135deg, var(--accent-green), rgba(76,175,80,0.3))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
          ❤️
        </div>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 24 }}>Ready to Save a Life?</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          {activeMatches.length} matching request{activeMatches.length !== 1 ? 's' : ''} found
        </p>
      </div>

      {activeMatches.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
          {activeMatches.map(match => (
            <div
              key={match.id}
              className="glass-panel"
              onClick={() => setSelectedMatch(match)}
              style={{
                padding: 16,
                cursor: 'pointer',
                borderLeft: selectedMatch?.id === match.id ? '4px solid var(--accent-green)' : '4px solid transparent',
                transition: 'all 0.3s'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {match.patient}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--accent-green)', marginBottom: 8 }}>
                {match.blood} • {match.units} units
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Urgency: {match.urgency}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '32px 0', color: 'var(--text-secondary)' }}>
          <Icon d={icons.clock} size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p>No active matches right now. Check back soon!</p>
        </div>
      )}

      {selectedMatch && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setSelectedMatch(null)}>
            Decline
          </button>
          <button className="btn btn-primary" style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}>
            <Icon d={icons.check} size={16} /> Accept Match
          </button>
        </div>
      )}
    </div>
  );
}
