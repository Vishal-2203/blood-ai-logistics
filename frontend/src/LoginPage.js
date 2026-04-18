import React, { useMemo, useState } from 'react';
import { Icon, icons } from './components/Icons';
import './LoginPage.css';
import { apiJson } from './api';

const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState(null);
  const [step, setStep] = useState('role');
  const [mode, setMode] = useState('login');
  const [credentials, setCredentials] = useState({
    name: '',
    email: '',
    password: '',
    bloodGroup: 'O-'
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState('');
  const [loading, setLoading] = useState(false);

  const heading = useMemo(() => (
    mode === 'login' ? 'Sign in to BloodAgent' : 'Create your BloodAgent account'
  ), [mode]);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    const newErrors = {};

    if (mode === 'register' && !credentials.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!credentials.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(credentials.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!credentials.password) {
      newErrors.password = 'Password is required';
    } else if (credentials.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (mode === 'register' && role === 'donor' && !credentials.bloodGroup) {
      newErrors.bloodGroup = 'Blood group is required for donor accounts';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setStep('credentials');
    setRequestError('');
  };

  const updateField = (field, value) => {
    setCredentials((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setRequestError('');
  };

  const handleAuth = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setRequestError('');

    try {
      const payload = await apiJson(mode === 'login' ? '/login' : '/register', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email.trim(),
          password: credentials.password,
          role,
          name: credentials.name.trim(),
          bloodGroup: role === 'donor' ? credentials.bloodGroup : null
        })
      });

      onLogin(payload);
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    setStep('role');
    setRole(null);
    setMode('login');
    setRequestError('');
    setErrors({});
  };

  return (
    <div className="login-container">
      <div className="login-bg-gradient"></div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon-animate">
            <Icon d={icons.drop} size={32} color="#e8193c" />
          </div>
          <h1>BloodAgent</h1>
          <p>Emergency blood logistics with persistent data, secure auth, and live routing.</p>
        </div>

        {step === 'role' ? (
          <div className="login-step">
            <h2>Select Your Role</h2>
            <p className="step-description">Choose the production role you want to access.</p>

            <div className="role-grid">
              {[
                {
                  id: 'hospital',
                  title: 'Hospital Staff',
                  description: 'Raise requests, monitor inventory, and dispatch units',
                  icon: 'M12 2C7 2 3 6 3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8c0-5-4-9-9-9z'
                },
                {
                  id: 'donor',
                  title: 'Blood Donor',
                  description: 'Receive missions and stream live movement updates',
                  icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'
                },
                {
                  id: 'requestor',
                  title: 'Request Coordinator',
                  description: 'Track the live fulfillment status of a blood request',
                  icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
                }
              ].map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className="role-option"
                  onClick={() => handleRoleSelect(entry.id)}
                >
                  <div className="role-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={entry.icon} />
                    </svg>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="login-step">
            <button type="button" className="back-button" onClick={handleBackClick}>
              &lt; Back to Roles
            </button>

            <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={`auth-mode-button ${mode === 'login' ? 'active' : ''}`}
                aria-pressed={mode === 'login'}
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-mode-button ${mode === 'register' ? 'active' : ''}`}
                aria-pressed={mode === 'register'}
                onClick={() => setMode('register')}
              >
                Register
              </button>
            </div>

            <h2>{heading}</h2>
            <p className="step-description">
              {role?.charAt(0).toUpperCase() + role?.slice(1)} access is protected by secure credentials.
            </p>

            <form onSubmit={handleAuth} className="login-form">
              {mode === 'register' && (
                <div className="form-group">
                  <label htmlFor="name" className="form-label">Full Name</label>
                  <input
                    id="name"
                    type="text"
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="Your full name"
                    value={credentials.name}
                    onChange={(event) => updateField('name', event.target.value)}
                  />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="your.email@example.com"
                  value={credentials.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="At least 8 characters"
                  value={credentials.password}
                  onChange={(event) => updateField('password', event.target.value)}
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              {mode === 'register' && role === 'donor' && (
                <div className="form-group">
                  <label htmlFor="bloodGroup" className="form-label">Blood Group</label>
                  <select
                    id="bloodGroup"
                    className={`form-input ${errors.bloodGroup ? 'error' : ''}`}
                    value={credentials.bloodGroup}
                    onChange={(event) => updateField('bloodGroup', event.target.value)}
                  >
                    {BLOOD_GROUPS.map((bloodGroup) => (
                      <option key={bloodGroup} value={bloodGroup}>{bloodGroup}</option>
                    ))}
                  </select>
                  {errors.bloodGroup && <span className="error-message">{errors.bloodGroup}</span>}
                </div>
              )}

              {requestError && (
                <div className="auth-banner" role="alert">
                  <Icon d={icons.alert} size={14} />
                  <span>{requestError}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-login"
                disabled={loading}
              >
                {loading ? 'Working...' : mode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>

            <div className="login-footer">
              <p className="demo-hint">
                Seeded accounts: `hospital@bloodagent.demo / hospital123`, `donor@bloodagent.demo / donor123`,
                `requestor@bloodagent.demo / requestor123`
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
