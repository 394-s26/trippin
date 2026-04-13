import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import forestBg from '../images/aleesha-wood-forest-road.jpg';
import TrippinLogo from '../components/TrippinLogo';
import { MoveRightIcon, GoogleIcon, UserIcon } from '../services/svgIcons';
import './LoginPage.css';

type Tab = 'login' | 'signup';
type SignupStep = 1 | 2;


const LoginPage = () => {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const clearForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setSignupStep(1);
    setError('');
  };

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }

    const nextPreview = URL.createObjectURL(photoFile);
    setPhotoPreview(nextPreview);

    return () => URL.revokeObjectURL(nextPreview);
  }, [photoFile]);

  const handleTabSwitch = (t: Tab) => {
    setTab(t);
    clearForm();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'signup') {
      if (signupStep === 1) {
        if (!firstName.trim() || !lastName.trim()) {
          setError('Please enter your first and last name.');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }

        setSignupStep(2);
        return;
      }

      if (!username.trim()) {
        setError('Please choose a username.');
        return;
      }
    } else if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
        navigate('/');
      } else {
        setSettingUp(true);
        const tripId = await registerWithEmail({
          email,
          password,
          firstName,
          lastName,
          username: normalizeUsername(username),
          photoFile,
        });
        navigate(tripId ? `/trip/${tripId}` : '/');
      }
    } catch (err: unknown) {
      setSettingUp(false);
      setError(parseFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      setSettingUp(true);
      const tripId = await loginWithGoogle();
      navigate(tripId ? `/trip/${tripId}` : '/');
    } catch (err: unknown) {
      setSettingUp(false);
      setError(parseFirebaseError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setPhotoFile(nextFile);
  };

  const handleBackToBasics = () => {
    setError('');
    setSignupStep(1);
  };

  if (settingUp) {
    return (
      <div className="login-wrapper">
        <div className="login-bg" style={{ backgroundImage: `url(${forestBg})` }} />
        <div className="login-bg-overlay" />
        <div className="login-card" style={{ alignItems: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
          <div className="login-spinner" />
          <p style={{ color: '#374151', fontWeight: 600, fontSize: '1rem', marginTop: '1.25rem' }}>
            Setting up your account...
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.4rem' }}>
            Checking for trip invites
          </p>
        </div>
      </div>
    );
  }

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

        {tab === 'signup' && (
          <div className="signup-progress" aria-label={`Signup step ${signupStep} of 2`}>
            <div className={`signup-progress-step ${signupStep >= 1 ? 'signup-progress-step--active' : ''}`}>
              <span>1</span>
              <strong>Basics</strong>
            </div>
            <div className="signup-progress-line" />
            <div className={`signup-progress-step ${signupStep >= 2 ? 'signup-progress-step--active' : ''}`}>
              <span>2</span>
              <strong>Profile</strong>
            </div>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {tab === 'signup' ? (
            <>
              {signupStep === 1 ? (
                <>
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
                  <div className="login-field-grid">
                    <div className="login-field">
                      <label htmlFor="first-name" className="login-label">First Name</label>
                      <input
                        id="first-name"
                        type="text"
                        className="login-input"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="e.g. John"
                        required
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="login-field">
                      <label htmlFor="last-name" className="login-label">Last Name</label>
                      <input
                        id="last-name"
                        type="text"
                        className="login-input"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="e.g. Doe"
                        required
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                  <div className="login-field">
                    <label htmlFor="password" className="login-label">Password</label>
                    <input
                      id="password"
                      type="password"
                      className="login-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      required
                      autoComplete="new-password"
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
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="signup-summary">
                    <span className="signup-summary--email">{email}</span>
                    <span className="signup-summary--name">&quot;{firstName.trim()} {lastName.trim()}&quot;</span>
                  </div>

                  <div className="signup-avatar-card">
                    <div className="signup-avatar-preview" aria-hidden="true">
                      {photoPreview ? (
                        <img src={photoPreview} alt="" className="signup-avatar-image" />
                      ) : (
                        <UserIcon size={24} />
                      )}
                    </div>
                    <div className="signup-avatar-copy">
                      <strong>Profile photo</strong>
                      <p>Optional, but it helps friends recognize you when trips get shared.</p>
                    </div>
                    <label htmlFor="profile-photo" className="signup-avatar-upload">
                      {photoFile ? 'Change photo' : 'Upload photo'}
                    </label>
                    <input
                      id="profile-photo"
                      type="file"
                      accept="image/*"
                      className="signup-avatar-input"
                      onChange={handlePhotoChange}
                    />
                  </div>
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
                    <p className="login-hint">Your username will appear as @{normalizeUsername(username || 'yourhandle')}.</p>
                  </div>
                  <button
                    type="button"
                    className="login-btn-secondary"
                    onClick={handleBackToBasics}
                    disabled={submitting}
                  >
                    Back
                  </button>
                </>
              )}
            </>
          ) : (
            <>
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
                  autoComplete="current-password"
                />
              </div>
            </>
          )}

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="login-btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : tab === 'login' ? 'Log In' : signupStep === 1 ? <>Finish Your Profile <MoveRightIcon size={18} /></> : 'Create Account'}
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

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();


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
