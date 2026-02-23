import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { sanitizeErrorMessage } from '../utils/errorHandling';

interface SignInPageProps {
  onLoginSuccess?: () => void;
}

function getIsSignUpModeFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get('signup') === 'true';
}

function isIOSChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /CriOS/i.test(navigator.userAgent);
}

export function SignInPage({ onLoginSuccess }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(getIsSignUpModeFromUrl);
  const [usePasswordMode, setUsePasswordMode] = useState(false);
  const [googleOAuthUrl, setGoogleOAuthUrl] = useState<string | null>(null);
  const [showReturnMessage, setShowReturnMessage] = useState(false);

  // iOS Chrome: pre-fetch OAuth URL, open in new tab (redirect may work in new tab)
  useEffect(() => {
    if (!isIOSChrome()) return;
    const fetchUrl = async () => {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDev ? 'http://localhost:3000/login' : `${window.location.origin}/login`;
      const { data, err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (!err && data?.url) setGoogleOAuthUrl(data.url);
    };
    fetchUrl();
  }, []);

  // iOS Chrome: poll for session when OAuth opened in new tab (localStorage shared across tabs)
  useEffect(() => {
    if (!isIOSChrome() || !showReturnMessage) return;
    const poll = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        clearInterval(poll);
        setShowReturnMessage(false);
        onLoginSuccess?.();
      }
    }, 1000);
    return () => clearInterval(poll);
  }, [showReturnMessage, onLoginSuccess]);

  // Sync sign-up mode from URL when route changes (e.g. back/forward)
  useEffect(() => {
    const handler = () => setIsSignUpMode(getIsSignUpModeFromUrl());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Check for OAuth errors in URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const errorParam = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (errorParam) {
      const friendlyError = sanitizeErrorMessage({ 
        message: errorDescription || errorParam,
        code: errorParam 
      }, 'Sign in failed. Please try again.');
      setError(friendlyError);
      
      // Clear error params from URL
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);

    // iOS Chrome: open in new tab - redirect may complete there; we poll for session
    if (isIOSChrome() && googleOAuthUrl) {
      const newTab = window.open(googleOAuthUrl, '_blank', 'noopener,noreferrer');
      if (newTab) {
        setShowReturnMessage(true);
        setIsGoogleSubmitting(true);
        setTimeout(() => setIsGoogleSubmitting(false), 2000);
      } else {
        setError('Please allow popups, or try opening in Safari.');
      }
      return;
    }

    if (isIOSChrome()) {
      try {
        setIsGoogleSubmitting(true);
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const redirectUrl = isDev ? 'http://localhost:3000/login' : `${window.location.origin}/login`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        });
        if (error) throw error;
        if (data?.url) {
          const newTab = window.open(data.url, '_blank', 'noopener,noreferrer');
          if (newTab) setShowReturnMessage(true);
          else setError('Please allow popups, or try opening in Safari.');
        }
      } catch (err) {
        setError(sanitizeErrorMessage(err, 'Sign in failed. Please try again.'));
      }
      setIsGoogleSubmitting(false);
      return;
    }

    // Standard redirect flow for Safari, desktop
    try {
      setIsGoogleSubmitting(true);
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDev ? 'http://localhost:3000/login' : `${window.location.origin}/login`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('OAuth error:', error);
        setError(sanitizeErrorMessage(error, 'Sign in failed. Please try again.'));
        setIsGoogleSubmitting(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(sanitizeErrorMessage(error, 'Sign in failed. Please try again.'));
      setIsGoogleSubmitting(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDev ? 'http://localhost:3000/login' : `${window.location.origin}/login`;

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setError(sanitizeErrorMessage(error, 'Failed to send magic link. Please try again.'));
        setIsSubmitting(false);
      } else {
        setMagicLinkSent(true);
        setMagicLinkEmail(trimmedEmail);
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Magic link error:', err);
      setError(sanitizeErrorMessage(err, 'Something went wrong'));
      setIsSubmitting(false);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        setError(sanitizeErrorMessage(error, 'Sign in failed. Please try again.'));
        setIsSubmitting(false);
      } else {
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(sanitizeErrorMessage(err, 'Something went wrong'));
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usePasswordMode) {
      handleEmailPasswordLogin(e);
    } else {
      handleMagicLinkSignIn(e);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', height: '100dvh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Hone Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-xl)', marginBottom: '0.5rem', color: '#111827' }}>Hone</div>
        </div>

        {/* Sign In Form */}
        <div style={{ width: '100%' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              color: '#991b1b',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {magicLinkSent ? (
            <div style={{
              padding: '24px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <p style={{ 
                color: '#166534', 
                fontSize: '0.9375rem', 
                marginBottom: '8px', 
                fontWeight: 600 
              }}>
                Check your email
              </p>
              <p style={{ 
                color: '#15803d', 
                fontSize: '0.875rem', 
                marginBottom: '20px',
                lineHeight: '1.5'
              }}>
                We sent a {isSignUpMode ? 'sign-up' : 'sign-in'} link to<br />
                <strong style={{ color: '#166534' }}>{magicLinkEmail}</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {!isSignUpMode && (
                  <Button
                    type="button"
                    onClick={() => {
                      setMagicLinkSent(false);
                      setMagicLinkEmail('');
                      setError(null);
                      setUsePasswordMode(true);
                    }}
                    variant="outline"
                    className="cursor-pointer"
                    style={{ 
                      fontSize: '0.875rem', 
                      padding: '8px 16px',
                      borderColor: '#86efac',
                      color: '#166534'
                    }}
                  >
                    Use password instead
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleMagicLinkSignIn(e);
                  }}
                  disabled={isSubmitting}
                  variant="default"
                  className="cursor-pointer"
                  style={{ 
                    fontSize: '0.875rem', 
                    padding: '8px 16px',
                    backgroundColor: '#111827',
                    color: '#ffffff'
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Resend link'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* iOS Chrome: show message when OAuth opened in new tab */}
              {showReturnMessage && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                  Complete sign-in in the new tab, then return here. We&apos;ll detect it automatically.
                </div>
              )}
              {/* Google Sign In / Sign Up */}
              <Button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleSubmitting || (isIOSChrome() && !googleOAuthUrl)}
                variant="default"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer mb-4 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-0 focus-visible:outline-none"
                style={{
                  fontWeight: 500,
                  padding: '12px 16px',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#111827',
                  pointerEvents: isGoogleSubmitting ? 'none' : 'auto',
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#FFFFFF"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#FFFFFF"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FFFFFF"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#FFFFFF"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isIOSChrome() && !googleOAuthUrl ? 'Loading...' : (isSignUpMode ? 'Sign up with Google' : 'Sign in with Google')}
              </Button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                <span style={{ padding: '0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
              </div>

              {/* Email + optional password form */}
              <form onSubmit={handleFormSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        fontSize: '1rem',
                        lineHeight: '1.5',
                        color: '#111827',
                        backgroundColor: 'rgb(255, 255, 255)',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        outline: 'none',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#111827'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                    />
                  </div>

                  {!isSignUpMode && usePasswordMode && (
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        disabled={isSubmitting}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          paddingRight: '48px',
                          fontSize: '1rem',
                          lineHeight: '1.5',
                          color: '#111827',
                          backgroundColor: 'rgb(255, 255, 255)',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'border-color 0.15s ease',
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = '#111827'}
                        onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          padding: '4px',
                        }}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  )}

                  <Button 
                    type="submit"
                    disabled={isSubmitting || !email || (!isSignUpMode && usePasswordMode && !password)}
                    variant="default"
                    className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-0 focus-visible:outline-none"
                    style={{
                      fontWeight: 500,
                      padding: '12px 16px',
                      fontSize: '1rem',
                      backgroundColor: '#111827',
                    }}
                  >
                    {isSubmitting 
                      ? (!isSignUpMode && usePasswordMode ? 'Signing in...' : 'Sending...') 
                      : (!isSignUpMode && usePasswordMode ? 'Sign in' : (isSignUpMode ? 'Sign up with magic link' : 'Sign in with magic link'))
                    }
                  </Button>

                  {/* Sign in with password instead / Use magic link instead - only in sign-in flow */}
                  {!isSignUpMode && (
                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setUsePasswordMode(!usePasswordMode);
                          setPassword('');
                          setError(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {usePasswordMode ? 'Use magic link instead' : 'Sign in with password instead'}
                      </button>
                    </div>
                  )}
                </div>
              </form>

              {/* New here? Sign up - only show in sign-in flow; hide in sign-up flow */}
              {!isSignUpMode && (
                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>New here? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUpMode(true);
                      window.history.replaceState({}, '', '/login?signup=true');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#111827',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    Sign up
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
