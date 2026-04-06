import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import forestBg from '../images/aleesha-wood-forest-road.jpg';
import TrippinLogo from '../components/TrippinLogo';
import './LoginPage.css';

type Tab = 'login' | 'signup';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
  </svg>
);

const LoginPage = () => {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setError('');
  };

  const handleTabSwitch = (t: Tab) => {
    setTab(t);
    clearForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'signup' && !username.trim()) {
      setError('Please choose a username.');
      return;
    }
    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, username.trim());
      }
      navigate('/');
    } catch (err: unknown) {
      setError(parseFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: unknown) {
      setError(parseFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg" style={{ backgroundImage: `url(${forestBg})` }} />
      <div className="login-bg-overlay" />
      <p className="login-photo-credit">
        Photo by <a href="https://unsplash.com/@toxilicity?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank">Aleesha Wood</a> on <a href="https://unsplash.com/photos/empty-asphalt-road-between-tress-O3pQYVd2Bc0?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
      </p>
      <div className="login-card">
        <div className="flex justify-center mb-1">
          <TrippinLogo size="lg" />
        </div>
        <p className="login-tagline">Plan your next adventure</p>

        <div className="login-tabs">
          <button
            className={`login-tab ${tab === 'login' ? 'login-tab--active' : ''}`}
            onClick={() => handleTabSwitch('login')}
            type="button"
          >
            Log In
          </button>
          <button
            className={`login-tab ${tab === 'signup' ? 'login-tab--active' : ''}`}
            onClick={() => handleTabSwitch('signup')}
            type="button"
          >
            Sign Up
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="email" className="login-label">Email</label>
            <input
              id="email"
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              className="login-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {tab === 'signup' && (
            <>
              <div className="login-field">
                <label htmlFor="username" className="login-label">Username</label>
                <input
                  id="username"
                  type="text"
                  className="login-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="yourhandle"
                  required
                  autoComplete="username"
                />
              </div>
              <div className="login-field">
                <label htmlFor="confirm-password" className="login-label">Confirm Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="login-input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="login-btn-google"
          onClick={handleGoogle}
          disabled={submitting}
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

const parseFirebaseError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed. Please try again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return 'Something went wrong. Please try again.';
};

export default LoginPage;
