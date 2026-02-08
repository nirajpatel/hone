import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface SignInPageProps {
  onLoginSuccess?: () => void;
}

// Map technical error messages to user-friendly ones
const getUserFriendlyError = (error: any): string => {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code || error?.status;

  // Handle specific error codes
  if (errorCode === 403 || errorMessage.includes('Access denied') || errorMessage.includes('not authorized')) {
    return 'Thanks for your interest! This email isn\'t approved for beta access yet.';
  }
  
  if (errorMessage.includes('Invalid login credentials') || errorMessage.includes('Invalid credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  
  if (errorMessage.includes('Email not confirmed') || errorMessage.includes('email_not_confirmed')) {
    return 'Please verify your email before signing in.';
  }
  
  if (errorMessage.includes('Too many requests') || errorMessage.includes('rate_limit')) {
    return 'Too many sign-in attempts. Please wait a moment.';
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return 'Connection error. Please check your internet and try again.';
  }
  
  if (errorCode === 'access_denied' || errorMessage.includes('access_denied')) {
    return 'Thanks for your interest! This email isn\'t approved for beta access yet.';
  }
  
  if (errorCode === 'invalid_request' || errorMessage.includes('invalid_request')) {
    return 'Sign in failed. Please try again.';
  }

  if (errorMessage.includes('magic link') || errorMessage.includes('email link')) {
    return 'Failed to send magic link. Please try again.';
  }

  // Return the original message if we can't map it
  return errorMessage || 'Sign in failed. Please try again.';
};

export function SignInPage({ onLoginSuccess }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [usePasswordMode, setUsePasswordMode] = useState(false); // false = magic link mode (default)

  // Check for OAuth errors in URL params on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const error = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');
    
    if (error) {
      const friendlyError = getUserFriendlyError({ 
        message: errorDescription || error,
        code: error 
      });
      setError(friendlyError);
      
      // Clear error params from URL
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleSubmitting(true);
      setError(null);
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
        setError(getUserFriendlyError(error));
        setIsGoogleSubmitting(false);
      }
      // Note: If successful, user will be redirected, so we don't reset state
    } catch (error) {
      console.error('Login error:', error);
      setError(getUserFriendlyError(error));
      setIsGoogleSubmitting(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // First validate email eligibility
      const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
      const validationResponse = await fetch(`${apiUrl}/validate-magic-link-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      let validationData;
      try {
        validationData = await validationResponse.json();
      } catch (parseError) {
        console.error('Failed to parse validation response:', parseError);
        throw new Error('Failed to validate email. Please try again.');
      }

      if (!validationResponse.ok) {
        // If we got an error response, check if it has a specific error message
        const errorMessage = validationData?.error || 'Failed to validate email. Please try again.';
        throw new Error(errorMessage);
      }

      if (!validationData.eligible) {
        setError('Thanks for your interest! This email isn\'t approved for beta access yet.');
        setIsSubmitting(false);
        return;
      }

      // Email is eligible, send magic link
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDev ? 'http://localhost:3000/login' : `${window.location.origin}/login`;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setError(getUserFriendlyError(error));
        setIsSubmitting(false);
      } else {
        setMagicLinkSent(true);
        setMagicLinkEmail(email.toLowerCase().trim());
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Magic link error:', error);
      setError(getUserFriendlyError(error));
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
        setError(getUserFriendlyError(error));
        setIsSubmitting(false);
      } else {
        // Success - onAuthStateChange will handle the rest
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(getUserFriendlyError(error));
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usePasswordMode) {
      await handleEmailPasswordLogin(e);
    } else {
      await handleMagicLinkSignIn(e);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', height: '100dvh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Hone Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-xl)', marginBottom: '0.5rem' }}>Hone</div>
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
                We sent a sign-in link to<br />
                <strong style={{ color: '#166534' }}>{magicLinkEmail}</strong>
              </p>
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                justifyContent: 'center',
                flexWrap: 'wrap' 
              }}>
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
              {/* Google Sign In */}
              <Button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleSubmitting}
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
                Sign in with Google
              </Button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                <span style={{ padding: '0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>or</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
              </div>

              {/* Single Form - Toggles between Magic Link and Password */}
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

                  {usePasswordMode && (
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
                    disabled={isSubmitting || !email || (usePasswordMode && !password)}
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
                      ? (usePasswordMode ? 'Signing in...' : 'Sending...') 
                      : (usePasswordMode ? 'Sign in' : 'Sign in with magic link')
                    }
                  </Button>

                  {/* Toggle Link */}
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
                </div>
              </form>

              {/* Request Access Link */}
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>New here? </span>
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState({}, '', '/?requestAccess=true');
                    window.dispatchEvent(new PopStateEvent('popstate'));
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
                  Request access
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
