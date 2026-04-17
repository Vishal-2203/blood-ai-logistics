import React, { useState, useEffect } from 'react';
import { Icon, icons } from './Icons';
import './AIInsights.css';

export default function AIInsights({ activeRequest, stock }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch('http://localhost:3000/ai-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeRequest,
            stock
          })
        });

        if (response.ok) {
          const data = await response.json();
          setInsights(data.insights || generateMockInsights());
        } else {
          setInsights(generateMockInsights());
        }
      } catch (err) {
        console.warn('AI Insights API unavailable, using mock data');
        setInsights(generateMockInsights());
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [activeRequest, stock]);

  const generateMockInsights = () => {
    const criticalBlood = stock?.find(s => s.units < s.min);
    return [
      {
        type: 'warning',
        icon: 'drop',
        title: 'Critical Stock Alert',
        description: criticalBlood 
          ? `${criticalBlood.type} at ${criticalBlood.units}/${criticalBlood.min} units`
          : 'All blood types above minimum threshold',
        priority: 'high'
      },
      {
        type: 'info',
        icon: 'navigation',
        title: 'Optimal Donor Match',
        description: 'System recommends Ravi Kumar based on location proximity and availability',
        priority: 'medium'
      },
      {
        type: 'success',
        icon: 'check',
        title: 'Request Efficiency',
        description: '2 compatible donors available within 15 min radius',
        priority: 'low'
      },
      {
        type: 'insight',
        icon: 'clock',
        title: 'Peak Demand Pattern',
        description: 'Emergency requests peak at 6-9 PM. Consider advance planning',
        priority: 'medium'
      }
    ];
  };

  return (
    <div className="ai-insights-panel">
      <div className="insights-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ai-badge">AI</div>
          <h3>System Insights</h3>
        </div>
        <div className="insight-refresh" style={{ cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
          <Icon d={icons.clock} size={16} />
        </div>
      </div>

      <div className="insights-container">
        {loading ? (
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
        <button className="btn btn-ghost btn-small">
          <Icon d={icons.plus} size={14} /> View Full Analysis
        </button>
      </div>
    </div>
  );
}
