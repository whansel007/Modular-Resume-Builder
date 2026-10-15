import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';

export default function ForgotPassword() {
  const [step, setStep] = useState('email'); // email | reset | done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const hintStyle = { fontSize: 12, lineHeight: 1.45, color: 'var(--muted)', margin: '10px 0 0' };

  const requestCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send reset code');
      setStep('reset');
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset password');
      setStep('done');
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>
          {step === 'done' ? 'Password updated' : 'Reset password'}
        </h1>

        {step === 'email' && (
          <form className={styles.form} onSubmit={requestCode}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <p style={hintStyle}>
              We&rsquo;ll email you a 6-digit code to reset your password.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className={styles.form} onSubmit={resetPassword}>
            <p style={hintStyle}>
              Enter the code sent to <strong>{email}</strong> and choose a new password.
            </p>
            <label>Reset code</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              required
            />
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <label>Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              required
            />
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Updating...' : 'Update password'}
            </button>
            <button
              type="button"
              className={styles.submitBtn}
              style={{ background: 'var(--panel) !important', color: 'var(--ink) !important', marginTop: 10 }}
              onClick={requestCode}
              disabled={loading}
            >
              Resend code
            </button>
          </form>
        )}

        {step === 'done' && (
          <>
            <p style={hintStyle}>You can now log in with your new password.</p>
            <button
              type="button"
              className={styles.submitBtn}
              onClick={() => navigate('/login')}
            >
              Back to login
            </button>
          </>
        )}

        <p className={styles.footer}>
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
