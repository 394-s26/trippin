import { useEffect, useMemo, useRef, useState, FormEvent, ChangeEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import './ProfilePage.css';

const normalizeUsername = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();

const ProfilePage = () => {
  const {
    user,
    appUser,
    updateProfile,
    updateUsername,
    updateProfilePhoto,
    changePasswordWithCurrentPassword,
    deleteAccount,
  } = useAuth();

  const hasPasswordProvider = useMemo(() => {
    return Boolean(user?.providerIds?.includes('password'));
  }, [user]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const alertRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!appUser) return;
    setFirstName(appUser.firstName ?? '');
    setLastName(appUser.lastName ?? '');
    setUsername(appUser.username ?? '');
  }, [appUser]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const nextPreview = URL.createObjectURL(photoFile);
    setPhotoPreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [photoFile]);

  useEffect(() => {
    if (!error && !success) return;
    alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [error, success]);

  const clearAlerts = () => {
    setError('');
    setSuccess('');
  };

  const handleSaveBasics = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
      setSuccess('Profile updated.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveUsername = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    const next = normalizeUsername(username);
    if (!next) {
      setError('Please choose a username.');
      return;
    }
    setSavingUsername(true);
    try {
      await updateUsername(next);
      setSuccess('Username updated.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingUsername(false);
    }
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setPhotoFile(nextFile);
  };

  const handleSavePhoto = async () => {
    clearAlerts();
    if (!photoFile) return;
    setSavingPhoto(true);
    try {
      await updateProfilePhoto(photoFile);
      setPhotoFile(null);
      setSuccess('Profile photo updated.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    clearAlerts();
    if (!hasPasswordProvider) {
      setError('Your account is signed in with Google. Password change is not available here.');
      return;
    }
    if (!currentPassword || newPassword.length < 6) {
      setError('Please enter your current password and a new password (6+ characters).');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePasswordWithCurrentPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccess('Password updated.');
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async () => {
    clearAlerts();
    const confirmed = window.confirm(
      "Delete your account? This can't be undone.\n\nYou'll lose your profile, and you may lose access to trips you own."
    );
    if (!confirmed) return;

    let password: string | undefined;
    if (hasPasswordProvider) {
      password = window.prompt('To confirm, enter your current password:') ?? undefined;
      if (!password) return;
    }

    setDeleting(true);
    try {
      await deleteAccount({ currentPassword: password });
      // ProtectedRoute will kick in once auth state changes.
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-container">
        <main className="profile-page-main">
            <h2 className="profile-page-title">Profile</h2>

            {(error || success) && (
              <div
                ref={alertRef}
                className={
                  error ? 'profile-page-alert profile-page-alert--error' : 'profile-page-alert profile-page-alert--success'
                }
              >
                {error || success}
              </div>
            )}

            <div className="profile-page-identity">
              <UserAvatar user={appUser} size="lg" />
              <div className="profile-page-identity-copy">
                <p className="profile-page-identity-name">
                  {appUser ? `${appUser.firstName} ${appUser.lastName}`.trim() : '—'}
                </p>
                <p className="profile-page-identity-meta">
                  {appUser?.username ? `@${appUser.username}` : ''}
                </p>
              </div>
            </div>

            <section className="profile-page-section">
              <h3>Email</h3>
              <p className="profile-page-muted">
                Email can’t be changed here.
              </p>
              <div className="profile-page-row">
                <input className="profile-page-input" value={user?.email ?? ''} disabled />
              </div>
            </section>

            <section className="profile-page-section">
              <h3>Basic info</h3>
              <form onSubmit={handleSaveBasics} className="profile-page-form">
                <div className="profile-page-grid">
                  <div className="profile-page-field">
                    <label>First name</label>
                    <input
                      className="profile-page-input"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="profile-page-field">
                    <label>Last name</label>
                    <input
                      className="profile-page-input"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <button className="profile-page-btn" type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
              </form>
            </section>

            <section className="profile-page-section">
              <h3>Username</h3>
              <p className="profile-page-muted">Usernames must be unique.</p>
              <form onSubmit={handleSaveUsername} className="profile-page-form">
                <div className="profile-page-row">
                  <input
                    className="profile-page-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <p className="profile-page-muted">Your username will appear as @{normalizeUsername(username || 'yourhandle')}.</p>
                <button className="profile-page-btn" type="submit" disabled={savingUsername}>
                  {savingUsername ? 'Saving…' : 'Save'}
                </button>
              </form>
            </section>

            <section className="profile-page-section">
              <h3>Profile photo</h3>
              <div className="profile-page-photo">
                <div className="profile-page-photo-preview" aria-hidden="true">
                  {photoPreview ? <img src={photoPreview} alt="" /> : <UserAvatar user={appUser} size="md" />}
                </div>
                <div className="profile-page-photo-actions">
                  <label className="profile-page-btn-secondary">
                    {photoFile ? 'Change photo' : 'Choose photo'}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                  <button
                    className="profile-page-btn"
                    type="button"
                    onClick={handleSavePhoto}
                    disabled={!photoFile || savingPhoto}
                  >
                    {savingPhoto ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
            </section>

            <section className="profile-page-section">
              <h3>Password</h3>
              {!hasPasswordProvider ? (
                <p className="profile-page-muted">
                  You signed in with Google. Password changes aren’t available.
                </p>
              ) : (
                <form onSubmit={handleChangePassword} className="profile-page-form">
                  <div className="profile-page-grid">
                    <div className="profile-page-field">
                      <label>Current password</label>
                      <input
                        className="profile-page-input"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="profile-page-field">
                      <label>New password</label>
                      <input
                        className="profile-page-input"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="profile-page-field">
                      <label>Confirm new password</label>
                      <input
                        className="profile-page-input"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button className="profile-page-btn" type="submit" disabled={savingPassword}>
                    {savingPassword ? 'Saving…' : 'Update password'}
                  </button>
                </form>
              )}
            </section>

            <section className="profile-page-section profile-page-section-danger">
              <h3>Delete account</h3>
              <p className="profile-page-muted">
                This will permanently delete your account.
              </p>
              <button className="profile-page-btn-danger" type="button" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </section>
        </main>
      </div>
    </div>
  );
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
};

export default ProfilePage;

