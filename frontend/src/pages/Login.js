import React, { useEffect, useState } from 'react';
import { healthService } from '../services/healthService';

const emptyForm = {
  username: '',
  email: '',
  password: '',
  name: '',
  age: '',
  gender: '',
  height_cm: '',
  weight_kg: '',
  blood_group: '',
};

const clearActionToken = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('verify_email');
  url.searchParams.delete('reset_password');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
};

const Login = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const verificationToken = url.searchParams.get('verify_email');
    const passwordToken = url.searchParams.get('reset_password');
    if (passwordToken) {
      setResetToken(passwordToken);
      clearActionToken();
      return;
    }
    if (!verificationToken) return;

    clearActionToken();
    setVerificationPending(true);
    healthService.verifyEmail(verificationToken)
      .then((response) => setNotice(response.status))
      .catch((requestError) => {
        const detail = requestError.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Could not verify your email. Please request a new link.');
        setCanResendVerification(true);
      })
      .finally(() => setVerificationPending(false));
  }, []);

  const handleInputChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const resetToLogin = () => {
    setIsRegistering(false);
    setIsForgotPassword(false);
    setResetToken('');
    setResetPassword('');
    setConfirmPassword('');
    setVerificationEmail('');
    setVerificationCode('');
  };

  const handleResendVerification = async () => {
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      const response = await healthService.resendVerification(verificationEmail || formData.username);
      setNotice(response.status);
      setCanResendVerification(false);
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not send a verification email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);

    try {
      if (verificationEmail) {
        const response = await healthService.verifyEmailCode(verificationEmail, verificationCode);
        setVerificationEmail('');
        setVerificationCode('');
        setIsRegistering(false);
        setFormData((current) => ({ ...current, password: '' }));
        setNotice(response.status);
      } else if (resetToken) {
        if (resetPassword !== confirmPassword) {
          setError('The passwords do not match.');
          return;
        }
        const response = await healthService.resetPassword(resetToken, resetPassword);
        setResetToken('');
        setResetPassword('');
        setConfirmPassword('');
        setIsRegistering(false);
        setIsForgotPassword(false);
        setNotice(response.status);
      } else if (isForgotPassword) {
        const response = await healthService.forgotPassword(formData.email);
        setNotice(response.status);
      } else if (isRegistering) {
        const response = await healthService.register({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          name: formData.name.trim(),
          age: Number(formData.age),
          gender: Number(formData.gender),
          height_cm: formData.height_cm ? Number(formData.height_cm) : null,
          weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
          blood_group: formData.blood_group || null,
        });
        setVerificationEmail(formData.email.trim().toLowerCase());
        setVerificationCode('');
        setFormData((current) => ({ ...current, password: '' }));
        setNotice(response.status);
      } else {
        const userData = await healthService.login({
          username: formData.username.trim(),
          password: formData.password,
        });
        onLogin(userData);
      }
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
      setCanResendVerification(requestError.response?.status === 403);
    } finally {
      setIsLoading(false);
    }
  };

  const title = resetToken
    ? 'Choose a New Password'
    : verificationEmail
      ? 'Verify Your Email'
      : isForgotPassword
      ? 'Reset Your Password'
      : isRegistering
        ? 'Create Account'
        : 'Welcome Back';
  const subtitle = resetToken
    ? 'Set a new password for your account.'
    : verificationEmail
      ? `Enter the 6-digit code we sent to ${verificationEmail}.`
      : isForgotPassword
      ? 'We’ll email you a secure password reset link.'
      : isRegistering
        ? 'Create your account and verify your email to continue.'
        : 'Sign in to access your dashboard.';

  return (
    <div className="login-page">
      <div className="login-wrap">
        <div className="login-card login-brand-card">
          <img
            className="login-logo"
            src="/smart-health-logo.png"
            alt="Smart Health — Your Health, Our Priority"
          />

          <div className="login-welcome">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          {verificationPending ? (
            <p className="auth-notice" role="status">Verifying your email…</p>
          ) : (
            <form className="field-group" onSubmit={handleSubmit}>
              {verificationEmail && (
                <>
                  <label>
                    <span>Email Address</span>
                    <input type="email" value={verificationEmail} readOnly />
                  </label>
                  <label>
                    <span>Verification Code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength="6"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </label>
                </>
              )}

              {isRegistering && !resetToken && !verificationEmail && (
                <>
                  <label>
                    <span>Full Name</span>
                    <input type="text" name="name" autoComplete="name" placeholder="John Doe" value={formData.name} onChange={handleInputChange} required maxLength="100" />
                  </label>
                  <label>
                    <span>Email Address</span>
                    <input type="email" name="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} required />
                  </label>
                  <label>
                    <span>Username</span>
                    <input type="text" name="username" autoComplete="username" placeholder="Choose a username" value={formData.username} onChange={handleInputChange} required maxLength="100" />
                  </label>
                  <div className="registration-fields">
                    <label>
                      <span>Age</span>
                      <input type="number" name="age" min="18" max="120" placeholder="Age" value={formData.age} onChange={handleInputChange} required />
                    </label>
                    <label>
                      <span>Gender</span>
                      <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                        <option value="" disabled>Select</option>
                        <option value="0">Male</option>
                        <option value="1">Female</option>
                      </select>
                    </label>
                    <label>
                      <span>Height (cm) <small>Optional</small></span>
                      <input type="number" name="height_cm" min="50" max="260" step="0.1" placeholder="e.g. 170" value={formData.height_cm} onChange={handleInputChange} />
                    </label>
                    <label>
                      <span>Weight (kg) <small>Optional</small></span>
                      <input type="number" name="weight_kg" min="20" max="500" step="0.1" placeholder="e.g. 65" value={formData.weight_kg} onChange={handleInputChange} />
                    </label>
                    <label className="registration-blood-group">
                      <span>Blood Group <small>Optional</small></span>
                      <select name="blood_group" value={formData.blood_group} onChange={handleInputChange}>
                        <option value="">Prefer not to say</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                    </label>
                  </div>
                </>
              )}

              {isForgotPassword && !resetToken && (
                <label>
                  <span>Email Address</span>
                  <input type="email" name="email" autoComplete="email" placeholder="you@example.com" value={formData.email} onChange={handleInputChange} required />
                </label>
              )}

              {resetToken && (
                <>
                  <label>
                    <span>New Password</span>
                    <input type="password" autoComplete="new-password" minLength="8" maxLength="128" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required />
                  </label>
                  <label>
                    <span>Confirm New Password</span>
                    <input type="password" autoComplete="new-password" minLength="8" maxLength="128" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                  </label>
                </>
              )}

              {!isRegistering && !isForgotPassword && !resetToken && (
                <label>
                  <span>Username</span>
                  <input type="text" name="username" autoComplete="username" placeholder="Your username" value={formData.username} onChange={handleInputChange} required />
                </label>
              )}

              {!verificationEmail && !isForgotPassword && !resetToken && (
                <label>
                  <span>Password</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    placeholder={isRegistering ? 'At least 8 characters' : 'Your password'}
                    minLength={isRegistering ? 8 : undefined}
                    maxLength={isRegistering ? 128 : undefined}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                </label>
              )}

              {error && <div className="message error" role="alert">{error}</div>}
              {notice && <div className="message success auth-notice" role="status">{notice}</div>}

              {!verificationEmail && <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading
                  ? 'Processing...'
                  : resetToken
                    ? 'Save New Password'
                    : isForgotPassword
                      ? 'Send Reset Link'
                      : isRegistering
                        ? 'Create Account'
                        : 'Sign In'}
              </button>}
              {verificationEmail && (
                <button type="submit" className="login-btn" disabled={isLoading || verificationCode.length !== 6}>
                  {isLoading ? 'Verifying...' : 'Verify Email'}
                </button>
              )}
            </form>
          )}

          <div className="auth-links">
            {verificationEmail ? (
              <>
                <button type="button" className="toggle-btn" onClick={handleResendVerification} disabled={isLoading}>
                  Resend code
                </button>
                <button type="button" className="toggle-btn" onClick={() => { setVerificationEmail(''); setVerificationCode(''); setIsRegistering(true); setError(''); setNotice(''); }}>
                  Back to registration
                </button>
              </>
            ) : resetToken ? (
              <button type="button" className="toggle-btn" onClick={resetToLogin}>Back to Sign In</button>
            ) : isForgotPassword ? (
              <button type="button" className="toggle-btn" onClick={resetToLogin}>Back to Sign In</button>
            ) : isRegistering ? (
              <button type="button" className="toggle-btn" onClick={() => { setIsRegistering(false); setError(''); setNotice(''); }}>Already have an account? Sign In</button>
            ) : (
              <>
                {canResendVerification && (
                  <button type="button" className="toggle-btn" onClick={handleResendVerification} disabled={isLoading}>
                    Resend verification code
                  </button>
                )}
                <button type="button" className="toggle-btn" onClick={() => { setIsForgotPassword(true); setError(''); setNotice(''); }}>Forgot password?</button>
                <button type="button" className="toggle-btn" onClick={() => { setIsRegistering(true); setError(''); setNotice(''); }}>Don&apos;t have an account? Register here</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
