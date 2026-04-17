import React from 'react';
import { Icon, icons } from './Icons';
import AIInsights from './AIInsights';

export default function HospitalDashboard({ requests, donors }) {
  const activeRequest = requests[0];
  const criticalCount = requests.filter(r => r.urgency === 'Critical').length;

  return (
    <div className="animate-in" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, height: '100%' }}>
      {/* Live Tracking Map */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon d={icons.map_pin} color="var(--primary)" /> Live Donor Tracking
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--accent-green)' }}>• {donors.length} Active</div>
        </div>
        <div style={{ height: 400, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ textAlign: 'center' }}>
            <Icon d={icons.map_pin} size={32} />
            <p>Map visualization loaded</p>
          </div>
        </div>
      </div>

      {/* Right Panel: AI Insights + Status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AIInsights activeRequest={activeRequest} stock={[]} />

        {/* Critical Alerts */}
        {criticalCount > 0 && (
          <div className="glass-panel" style={{ padding: 16, borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon d={icons.alert} size={16} color="var(--primary)" />
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                {criticalCount} Critical Alert{criticalCount > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              High-priority requests require immediate donor matching. System recommendations active.
            </div>
          </div>
        )}

        {/* Active Requests Summary */}
        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            Active Requests ({requests.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 150, overflowY: 'auto' }}>
            {requests.slice(0, 3).map(r => (
              <div key={r.id} style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{r.patient}</span>
                  <span style={{ color: r.urgency === 'Critical' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {r.blood}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Status: {r.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
