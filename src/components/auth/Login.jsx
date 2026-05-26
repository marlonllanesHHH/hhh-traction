import { useState } from 'react';
import { signInWithGoogle } from '../../lib/supabase';
import './Login.css';

const HHHLogo = () => (
  <svg viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg" className="hhh-logo-svg">
    {/* Crown */}
    <path d="M32 8 L32 28 L22 18 L12 28 L17 28 L17 8 Z" fill="white"/>
    <path d="M32 8 L42 18 L37 28 L27 28 L22 18 L32 8Z" fill="white"/>
    <circle cx="32" cy="8" r="3" fill="white"/>
    <circle cx="17" cy="14" r="2.5" fill="white"/>
    <circle cx="47" cy="14" r="2.5" fill="white"/>
    {/* Crown base */}
    <rect x="14" y="26" width="36" height="4" rx="1" fill="white"/>
    {/* H left pillar */}
    <rect x="14" y="30" width="13" height="56" rx="2" fill="white"/>
    {/* H right pillar */}
    <rect x="37" y="30" width="13" height="56" rx="2" fill="white"/>
    {/* H crossbar */}
    <rect x="14" y="52" width="36" height="10" fill="white"/>
    {/* Text */}
    <text x="72" y="55" fontFamily="'DM Sans', sans-serif" fontSize="26" fontWeight="700" fill="white" letterSpacing="1">HISTORIC</text>
    <text x="72" y="82" fontFamily="'DM Sans', sans-serif" fontSize="26" fontWeight="700" fill="white" letterSpacing="1">HAMPTON</text>
    <text x="72" y="109" fontFamily="'DM Sans', sans-serif" fontSize="26" fontWeight="700" fill="white" letterSpacing="1">HOUSE</text>
  </svg>
);

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const { error } = await signInWithGoogle();
    if (error) {
      setError('Sign in failed. Please use your @historichamptonhouse.org account.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background chevrons */}
      <div className="login-bg">
        <div className="chevron chevron-1" />
        <div className="chevron chevron-2" />
      </div>

      <div className="login-container">
        {/* Left panel */}
        <div className="login-left">
          <div className="login-brand">
            <HHHLogo />
            <div className="login-tagline">
              <div className="tagline-line" />
              <span>TRACTION PLATFORM</span>
              <div className="tagline-line" />
            </div>
          </div>
          <p className="login-description">
            Run your EOS® operating system. Manage meetings, rocks, scorecards, and team accountability — all in one place.
          </p>
        </div>

        {/* Right panel */}
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-header">
              <h2>Welcome Back</h2>
              <p>Sign in with your Historic Hampton House account to continue.</p>
            </div>

            {error && (
              <div className="login-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {error}
              </div>
            )}

            <button
              className="google-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <div className="spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <div className="login-restriction">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Restricted to <strong>@historichamptonhouse.org</strong> accounts only
            </div>
          </div>

          <p className="login-footer">
            © {new Date().getFullYear()} Historic Hampton House. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
