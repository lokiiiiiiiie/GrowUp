import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/client';
import { setCredentials } from '../redux/authSlice';

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onboardingPoints = [
    'Get a starter template with guided risk settings.',
    'Track progress through weekly improvement milestones.',
    'Practice trade execution without risking real capital.',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      const response = await api.post('/api/auth/register', { name, email, password });
      dispatch(setCredentials(response.data));
      toast.success('Account created');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to register';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page auth-page">
      <section className="panel auth-panel">
        <p className="eyebrow">Create Account</p>
        <h2>Join GrowUp and start improving</h2>
        <p className="muted">
          Build strategies, test ideas, and sharpen execution with structured feedback.
        </p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            <span>Full Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </label>
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
              placeholder="Create a strong password"
              required
            />
          </label>

          <button type="submit" className="btn primary wide" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Login</Link>
        </p>

        <div className="auth-feature-list">
          {onboardingPoints.map((item) => (
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

export default Register;
