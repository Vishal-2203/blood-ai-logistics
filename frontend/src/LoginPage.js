import React, { useState } from 'react';
import { Icon, icons } from './components/Icons';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState(null);
  const [step, setStep] = useState('role'); // 'role' or 'credentials'
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!credentials.email) newErrors.email = 'Email is required';
    else if (!validateEmail(credentials.email)) newErrors.email = 'Invalid email format';
    if (!credentials.password) newErrors.password = 'Password is required';
    else if (credentials.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setStep('credentials');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Simulate API call to backend
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          role: role
        })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const userData = await response.json();
      
      // Store auth data
      localStorage.setItem('user', JSON.stringify({
        id: userData.id || Math.random(),
        email: credentials.email,
        role: role,
        name: userData.name || credentials.email.split('@')[0]
      }));

      onLogin(role, credentials.email);
    } catch (err) {
      // For demo, allow mock login if backend unavailable
      console.warn('Backend unavailable, using mock login:', err);
      localStorage.setItem('user', JSON.stringify({
        id: Math.random(),
        email: credentials.email,
        role: role,
        name: credentials.email.split('@')[0]
      }));
      onLogin(role, credentials.email);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    setStep('role');
    setRole(null);
    setCredentials({ email: '', password: '' });
    setErrors({});
  };

  return (
    <div className="login-container">
      {/* Animated Background */}
      <div className="login-bg-gradient"></div>
      
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon-animate">
            <Icon d={icons.drop} size={32} color="#e8193c" />
          </div>
          <h1>BloodAgent</h1>
          <p>Emergency Blood Logistics Network</p>
        </div>

        {step === 'role' ? (
          /* Role Selection Step */
          <div className="login-step">
            <h2>Select Your Role</h2>
            <p className="step-description">Choose how you want to contribute to the network</p>
            
            <div className="role-grid">
              {[
                { 
                  id: 'hospital', 
                  title: 'Hospital Staff', 
                  description: 'Manage blood requests and inventory',
                  icon: 'M12 2C7 2 3 6 3 11v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8c0-5-4-9-9-9z'
                },
                { 
                  id: 'donor', 
                  title: 'Blood Donor', 
                  description: 'Respond to urgent blood requests',
                  icon: 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z'
                },
                { 
                  id: 'requestor', 
                  title: 'Request Coordinator', 
                  description: 'Broadcast and track blood requests',
                  icon: 'M22 12h-4l-3 9L9 3l-3 9H2'
                }
              ].map(r => (
                <button
                  key={r.id}
                  className="role-option"
                  onClick={() => handleRoleSelect(r.id)}
                >
                  <div className="role-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={r.icon} />
                    </svg>
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Credentials Step */
          <div className="login-step">
            <button className="back-button" onClick={handleBackClick}>
              ← Back to Roles
            </button>
            
            <h2>Login as {role?.charAt(0).toUpperCase() + role?.slice(1)}</h2>
            
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="your.email@example.com"
                  value={credentials.email}
                  onChange={(e) => {
                    setCredentials({ ...credentials, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={(e) => {
                    setCredentials({ ...credentials, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                />
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-login"
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="login-footer">
              <p className="demo-hint">💡 Demo: Use any email and password (min 6 chars)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
