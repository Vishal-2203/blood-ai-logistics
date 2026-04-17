import React from 'react';
import { Icon, icons } from './Icons';

export default function RequestorPortal() {
  const stages = [
    { stage: 'Broadcasting', icon: 'navigation', status: 'Active', color: '#e8193c' },
    { stage: 'Matching', icon: 'users', status: 'In Progress', color: '#ffc107' },
    { stage: 'En Route', icon: 'clock', status: 'Tracking', color: '#4fac fe' },
    { stage: 'Fulfilled', icon: 'check', status: 'Complete', color: '#4caf50' }
  ];

  return (
    <div className="animate-in">
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 12px 0', fontSize: 28 }}>Track Your Request</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', marginBottom: 24 }}>
          AI is matching donors in your area...
        </p>

        {/* Progress Pipeline */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
          {stages.map((s, idx) => (
            <React.Fragment key={s.stage}>
              <div
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  borderLeft: `4px solid ${s.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 140,
                  transition: 'all 0.3s'
                }}
              >
                <Icon d={icons[s.icon]} size={18} color={s.color} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: s.color }}>
                    {s.stage}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {s.status}
                  </div>
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div style={{ fontSize: 20, color: 'var(--text-secondary)', margin: '0 4px' }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Matching Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 32 }}>
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-green)', marginBottom: 4 }}>
              2
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Donors Matched
            </div>
          </div>
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffc107', marginBottom: 4 }}>
              8 min
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Avg. ETA
            </div>
          </div>
          <div className="glass-panel" style={{ padding: 16, borderRadius: 8 }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#4fac fe', marginBottom: 4 }}>
              85%
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Success Rate
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ marginTop: 32 }}>
          <button className="btn btn-primary" style={{ minWidth: 200 }}>
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
}
