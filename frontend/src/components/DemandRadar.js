import React, { useEffect, useMemo, useState } from 'react';
import { apiJson } from '../api';
import { Icon, icons } from './Icons';

function sparkline(points = [], { width = 140, height = 34 } = {}) {
  if (!Array.isArray(points) || points.length < 2) {
    return { path: '', min: 0, max: 0 };
  }

  const values = points.map((p) => Number(p.units || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toX = (i) => (i / (values.length - 1)) * width;
  const toY = (v) => height - ((v - min) / range) * height;

  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
    .join(' ');

  return { path, min, max };
}

function formatDays(value) {
  if (value === null || value === undefined) return 'n/a';
  if (!Number.isFinite(Number(value))) return 'n/a';
  return `${Number(value).toFixed(1)}d`;
}

function riskTone(risk) {
  if (risk === 'Critical') return 'critical';
  if (risk === 'High') return 'high';
  return 'normal';
}

export default function DemandRadar({ authToken, center, onNotice }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('forecast'); // forecast | incidents | outreach
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const [multiplier, setMultiplier] = useState(1);

  const [incidentForm, setIncidentForm] = useState({
    title: 'Traffic incident',
    severity: 3,
    radiusKm: 12,
    location: 'Pinned area',
    lat: center.lat,
    lng: center.lng,
    endsInHours: 3,
    notes: ''
  });

  const fetchForecast = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiJson(`/forecast?days=14&lat=${center.lat}&lng=${center.lng}`, {
        token: authToken
      });
      setPayload(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || payload) return;
    void fetchForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setIncidentForm((prev) => ({ ...prev, lat: center.lat, lng: center.lng }));
  }, [center.lat, center.lng]);

  const scaledDemand = useMemo(() => {
    if (!payload?.demand) return [];
    return payload.demand.map((item) => ({
      ...item,
      avgDaily: Number((item.avgDaily * multiplier).toFixed(2)),
      daysToStockout: item.avgDaily > 0 ? Number((item.stock.units / (item.avgDaily * multiplier)).toFixed(1)) : null,
      forecast: (item.forecast || []).map((p) => ({ ...p, units: Number((p.units * multiplier).toFixed(2)) }))
    }));
  }, [payload, multiplier]);

  const actionPlan = useMemo(() => {
    if (!payload?.actionPlan) return [];
    return payload.actionPlan.map((plan) => ({
      ...plan,
      suggestedTarget: Math.ceil(plan.suggestedTarget * multiplier),
      shortage: Math.max(0, Math.ceil(plan.shortage * multiplier))
    }));
  }, [payload, multiplier]);

  const incidents = payload?.incidents || [];
  const outreach = payload?.outreach || [];

  const createIncident = async () => {
    setLoading(true);
    setError('');
    try {
      const endsAt = new Date(Date.now() + Math.max(1, Number(incidentForm.endsInHours || 3)) * 60 * 60 * 1000).toISOString();
      await apiJson('/incidents', {
        method: 'POST',
        token: authToken,
        body: JSON.stringify({
          title: incidentForm.title,
          severity: Number(incidentForm.severity),
          radiusKm: Number(incidentForm.radiusKm),
          location: incidentForm.location,
          lat: Number(incidentForm.lat),
          lng: Number(incidentForm.lng),
          startsAt: new Date().toISOString(),
          endsAt,
          notes: incidentForm.notes
        })
      });
      onNotice?.('Incident added. Forecast will reflect it on refresh.', 'success');
      await fetchForecast();
      setTab('incidents');
    } catch (err) {
      setError(err.message);
      onNotice?.(err.message, 'warning');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel demand-radar">
      <div className="demand-radar-header">
        <div>
          <div className="section-kicker">Demand Radar</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 6 }}>
            Forecast, incidents, and proactive donor outreach
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>
            Runs locally with trend + weekday seasonality and incident multipliers.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
            <Icon d={open ? icons.x : icons.navigation} size={14} /> {open ? 'Close' : 'Open'}
          </button>
          <button type="button" className="btn btn-primary btn-small" onClick={() => void fetchForecast()} disabled={!open || loading}>
            <Icon d={icons.clock} size={14} /> Refresh
          </button>
        </div>
      </div>

      {!open ? (
        <div className="queue-meta" style={{ padding: '0 24px 24px' }}>
          Tip: open during demos to show “what’s next” after live tracking.
        </div>
      ) : (
        <div className="demand-radar-body">
          <div className="demand-radar-controls">
            <div className="demand-radar-tabs">
              <button type="button" className={`demand-tab ${tab === 'forecast' ? 'active' : ''}`} onClick={() => setTab('forecast')}>
                <Icon d={icons.dashboard} size={14} /> Forecast
              </button>
              <button type="button" className={`demand-tab ${tab === 'incidents' ? 'active' : ''}`} onClick={() => setTab('incidents')}>
                <Icon d={icons.alert} size={14} /> Incidents
              </button>
              <button type="button" className={`demand-tab ${tab === 'outreach' ? 'active' : ''}`} onClick={() => setTab('outreach')}>
                <Icon d={icons.users} size={14} /> Outreach
              </button>
            </div>

            <div className="demand-multiplier">
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                What-if demand
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  type="range"
                  min="0.8"
                  max="1.6"
                  step="0.05"
                  value={multiplier}
                  onChange={(e) => setMultiplier(Number(e.target.value))}
                />
                <div className="status-badge status-active">{Math.round(multiplier * 100)}%</div>
              </div>
            </div>
          </div>

          {loading && <div className="queue-meta" style={{ padding: '16px 24px' }}>Loading forecast...</div>}
          {error && (
            <div className="auth-banner" role="alert" style={{ margin: '16px 24px' }}>
              <Icon d={icons.alert} size={14} />
              <span>{error}</span>
            </div>
          )}

          {tab === 'forecast' && payload && (
            <div className="demand-grid">
              <div className="demand-card">
                <div className="demand-card-title">Action Plan</div>
                <div className="queue-meta">Prioritized by stockout risk and shortage.</div>
                <div className="demand-plan-list">
                  {actionPlan.slice(0, 8).map((plan) => (
                    <div key={plan.blood} className={`demand-plan-row tone-${riskTone(plan.risk)}`}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{plan.blood}</div>
                        <div className="queue-meta">
                          Risk {plan.risk} · Target {plan.suggestedTarget} · Shortage {plan.shortage}
                        </div>
                      </div>
                      <div className={`risk-pill risk-${riskTone(plan.risk)}`}>{plan.risk}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="demand-card">
                <div className="demand-card-title">Blood Group Trends</div>
                <div className="queue-meta">Last 28 days and 14-day forecast.</div>
                <div className="demand-trend-list">
                  {scaledDemand.map((item) => {
                    const { path } = sparkline(item.forecast, { width: 160, height: 34 });
                    return (
                      <div key={item.blood} className="demand-trend-row">
                        <div className="blood-badge">{item.blood}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 800 }}>
                              Avg/day {item.avgDaily} · Stock {item.stock.units} · Stockout {formatDays(item.daysToStockout)}
                            </div>
                            <div className={`risk-pill risk-${item.reorderNow ? 'high' : 'normal'}`}>{item.reorderNow ? 'Reorder' : 'OK'}</div>
                          </div>
                          <svg width="160" height="34" viewBox="0 0 160 34" style={{ marginTop: 6 }}>
                            <path d={path} fill="none" stroke="rgba(79,172,254,0.95)" strokeWidth="2" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'incidents' && (
            <div className="demand-grid">
              <div className="demand-card">
                <div className="demand-card-title">Active Incidents</div>
                <div className="queue-meta">Incidents increase the forecast multiplier within their radius.</div>
                {incidents.length === 0 ? (
                  <div className="queue-meta" style={{ marginTop: 12 }}>No active incidents.</div>
                ) : (
                  <div className="incident-list">
                    {incidents.map((inc) => (
                      <div key={inc.id} className="incident-row">
                        <div>
                          <div style={{ fontWeight: 800 }}>{inc.title}</div>
                          <div className="queue-meta">{inc.location} · Severity {inc.severity} · Radius {inc.radiusKm} km</div>
                        </div>
                        <div className="risk-pill risk-high">Live</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="demand-card">
                <div className="demand-card-title">Add Incident</div>
                <div className="queue-meta">Use in demos to show the system reacting to real-world events.</div>

                <div className="incident-form">
                  <label className="form-label">Title</label>
                  <input className="form-input" value={incidentForm.title} onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })} />

                  <div className="incident-two-col">
                    <div>
                      <label className="form-label">Severity (1-5)</label>
                      <input className="form-input" type="number" min="1" max="5" value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Radius (km)</label>
                      <input className="form-input" type="number" min="1" max="120" value={incidentForm.radiusKm} onChange={(e) => setIncidentForm({ ...incidentForm, radiusKm: e.target.value })} />
                    </div>
                  </div>

                  <label className="form-label">Location label</label>
                  <input className="form-input" value={incidentForm.location} onChange={(e) => setIncidentForm({ ...incidentForm, location: e.target.value })} />

                  <div className="incident-two-col">
                    <div>
                      <label className="form-label">Lat</label>
                      <input className="form-input" value={incidentForm.lat} onChange={(e) => setIncidentForm({ ...incidentForm, lat: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Lng</label>
                      <input className="form-input" value={incidentForm.lng} onChange={(e) => setIncidentForm({ ...incidentForm, lng: e.target.value })} />
                    </div>
                  </div>

                  <label className="form-label">Ends in (hours)</label>
                  <input className="form-input" type="number" min="1" max="72" value={incidentForm.endsInHours} onChange={(e) => setIncidentForm({ ...incidentForm, endsInHours: e.target.value })} />

                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows="3" value={incidentForm.notes} onChange={(e) => setIncidentForm({ ...incidentForm, notes: e.target.value })} />

                  <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => void createIncident()} disabled={loading}>
                    <Icon d={icons.plus} size={14} /> Add Incident
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'outreach' && payload && (
            <div className="demand-card" style={{ margin: '0 24px 24px' }}>
              <div className="demand-card-title">Proactive Outreach Targets</div>
              <div className="queue-meta">Suggested donors for the highest-risk blood groups (ranked locally).</div>
              {outreach.length === 0 ? (
                <div className="queue-meta" style={{ marginTop: 12 }}>No outreach needed right now.</div>
              ) : (
                <div className="outreach-grid">
                  {outreach.map((group) => (
                    <div key={group.blood} className="outreach-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 900 }}>{group.blood}</div>
                        <div className="risk-pill risk-high">High priority</div>
                      </div>
                      <div className="outreach-list">
                        {group.donors.map((donor) => (
                          <div key={donor.id || donor.name} className="outreach-row">
                            <div>
                              <div style={{ fontWeight: 800 }}>{donor.name}</div>
                              <div className="queue-meta">{Number(donor.distance || 0).toFixed(1)} km · Score {donor.score}</div>
                            </div>
                            <div className="status-badge status-active">{donor.eta || 0}m</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

