import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/client';
import { setCredentials } from '../redux/authSlice';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const perks = [
    'Continue your active learning path and missions.',
    'Access your latest trade journal and behavior notes.',
    'Review performance summaries before your next session.',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      const response = await api.post('/api/auth/login', { email, password });
      dispatch(setCredentials(response.data));
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to login';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <section className="panel auth-panel">
        <p className="eyebrow">Welcome Back</p>
        <h2>Sign in to GrowUp</h2>
        <p className="muted">
          Access your practice portfolio, open orders, and performance analytics.
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          <button type="submit" className="btn primary wide" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>

        <div className="auth-feature-list">
          {perks.map((item) => (
            <div key={item} className="auth-feature-item">
              <span className="check-dot" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Login;
