import React, { useEffect, useMemo, useState } from 'react';
import { Icon, icons } from './Icons';
import './AIInsights.css';
import { apiJson } from '../api';

function buildLocalInsights(activeRequest, stock = []) {
  const aiData = activeRequest?.ai_data;
  const shortage = stock
    ?.filter((item) => Number(item.units) < Number(item.min))
    ?.sort((left, right) => (left.units / left.min) - (right.units / right.min))[0];
  const topDonor = aiData?.top_3_donors?.[0];
  const alertStatus = aiData?.system_health?.alert_status || (shortage ? 'WARNING' : 'NORMAL');
  const requestSummary = activeRequest
    ? `${activeRequest.blood} x ${activeRequest.units} for ${activeRequest.patient}`
    : 'the current request queue';

  return [
    {
      type: shortage ? 'warning' : 'success',
      icon: 'drop',
      title: shortage ? 'Critical Stock Alert' : 'Stock Stable',
      description: shortage
        ? `${shortage.type} is at ${shortage.units}/${shortage.min} units and needs replenishment.`
        : 'All tracked blood groups are currently above their minimum thresholds.',
      priority: shortage ? 'high' : 'low'
    },
    {
      type: topDonor ? 'info' : 'insight',
      icon: topDonor ? 'navigation' : 'clock',
      title: topDonor ? 'Top Donor Match' : 'Awaiting Match Data',
      description: topDonor
        ? `${topDonor.name} leads for ${requestSummary} with score ${topDonor.score} at approximately ${Number(topDonor.distance || 0).toFixed(2)} km.`
        : 'Raise a request to surface ranked donors and routing guidance here.',
      priority: topDonor ? 'medium' : 'low'
    },
    {
      type: alertStatus === 'CRITICAL' ? 'warning' : 'success',
      icon: alertStatus === 'CRITICAL' ? 'alert' : 'check',
      title: 'System Health',
      description: aiData?.system_health?.public_message || `Current alert status: ${alertStatus}.`,
      priority: alertStatus === 'CRITICAL' ? 'high' : 'low'
    },
    {
      type: 'insight',
      icon: 'clock',
      title: 'Decision Summary',
      description: aiData?.decision?.reason || `Monitoring ${requestSummary} while donor and inventory signals update.`,
      priority: 'medium'
    }
  ];
}

export default function AIInsights({ activeRequest, stock, authToken }) {
  const [insights, setInsights] = useState(() => buildLocalInsights(activeRequest, stock));
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('Awaiting analysis');
  const [showAnalysis, setShowAnalysis] = useState(false);

  const highlightedStock = useMemo(
    () => stock.filter((item) => item.units < item.min),
    [stock]
  );

  useEffect(() => {
    const localInsights = buildLocalInsights(activeRequest, stock);
    setInsights(localInsights);
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    if (!activeRequest) {
      setLoading(false);
      return undefined;
    }

    let isCancelled = false;

    const fetchInsights = async () => {
      try {
        setLoading(true);

        const data = await apiJson('/ai-insights', {
          method: 'POST',
          token: authToken,
          body: JSON.stringify({
            activeRequest,
            stock
          })
        });

        if (!isCancelled && Array.isArray(data.insights) && data.insights.length > 0) {
          setInsights(data.insights);
          setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('AI Insights API unavailable, using local insights.', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchInsights();

    return () => {
      isCancelled = true;
    };
  }, [activeRequest, authToken, stock, refreshTick]);

  return (
    <>
      <div className="ai-insights-panel">
        <div className="insights-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="ai-badge">AI</div>
            <div>
              <h3>System Insights</h3>
              <div className="insight-timestamp">Updated {lastUpdated}</div>
            </div>
          </div>
          <button type="button" className="insight-refresh" onClick={() => setRefreshTick((tick) => tick + 1)} aria-label="Refresh insights">
            <Icon d={icons.clock} size={16} />
          </button>
        </div>

        <div className="insights-container">
          {loading && insights.length === 0 ? (
            <div className="insights-loading">
              <div className="spinner"></div>
              <p>Analyzing data...</p>
            </div>
          ) : (
            insights.map((insight, idx) => (
              <div key={idx} className={`insight-card insight-${insight.type}`}>
                <div className="insight-icon">
                  <Icon d={icons[insight.icon]} size={16} />
                </div>
                <div className="insight-content">
                  <div className="insight-title">{insight.title}</div>
                  <div className="insight-description">{insight.description}</div>
                </div>
                <div className={`insight-priority priority-${insight.priority}`}>
                  {insight.priority.toUpperCase()}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="insights-footer">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowAnalysis(true)}>
            <Icon d={icons.plus} size={14} /> View Live Analysis
          </button>
        </div>
      </div>

      {showAnalysis && (
        <div className="modal-backdrop" onClick={() => setShowAnalysis(false)}>
          <div className="modal analysis-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-title">
              <Icon d={icons.dashboard} color="var(--accent-blue)" />
              Live AI Analysis
            </div>

            <div className="analysis-grid">
              <div className="analysis-block">
                <div className="section-kicker">Request Snapshot</div>
                <div className="detail-list" style={{ marginTop: 14 }}>
                  <div className="detail-row">
                    <span>Patient</span>
                    <strong>{activeRequest?.patient || 'No active request'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Blood type</span>
                    <strong>{activeRequest?.blood || 'Unknown'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Facility</span>
                    <strong>{activeRequest?.location || 'Unknown facility'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Decision reason</span>
                    <strong>{activeRequest?.ai_data?.decision?.reason || 'Waiting for donor analysis.'}</strong>
                  </div>
                </div>
              </div>

              <div className="analysis-block">
                <div className="section-kicker">Ranked Donor Shortlist</div>
                <div className="analysis-list" style={{ marginTop: 14 }}>
                  {(activeRequest?.ai_data?.top_3_donors || []).length > 0 ? (
                    activeRequest.ai_data.top_3_donors.map((donor, index) => (
                      <div key={`${donor.name}-${index}`} className="analysis-list-item">
                        <div>
                          <strong>{donor.name}</strong>
                          <span>{Number(donor.distance || 0).toFixed(2)} km - Score {donor.score}</span>
                        </div>
                        <div className="analysis-pill">#{index + 1}</div>
                      </div>
                    ))
                  ) : (
                    <div className="queue-meta">No shortlist available yet for this request.</div>
                  )}
                </div>
              </div>

              <div className="analysis-block">
                <div className="section-kicker">Inventory Watchlist</div>
                <div className="analysis-list" style={{ marginTop: 14 }}>
                  {highlightedStock.length > 0 ? (
                    highlightedStock.map((item) => (
                      <div key={item.type} className="analysis-list-item">
                        <div>
                          <strong>{item.type}</strong>
                          <span>{item.units}/{item.min} units</span>
                        </div>
                        <div className="analysis-pill warning">Alert</div>
                      </div>
                    ))
                  ) : (
                    <div className="queue-meta">All blood groups are above minimum thresholds.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAnalysis(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
