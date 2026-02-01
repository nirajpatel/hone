import { FluidBackground } from './FluidBackground';
import { Button } from './ui/button';
import { supabase } from '../utils/supabase/client';

interface LandingPageProps {
  onLoginSuccess?: () => void;
}

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const handleGoogleLogin = async () => {
    try {
      // Force localhost:3000 for development
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const redirectUrl = isDev ? 'http://localhost:3000/' : `${window.location.origin}/`;
      
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
        alert(`OAuth Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert(`Login Error: ${error}`);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: '#faf5f0' }}>
      {/* WebGL Fluid Background */}
      <FluidBackground />
      
      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Hone Title - XL */}
        <h1 
          className="text-gray-900 mb-3" 
          style={{ 
            fontSize: '3rem', 
            fontWeight: 'var(--font-weight-bold)',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}
        >
          Hone
        </h1>
        
        {/* Subtitle - LG */}
        <p 
          className="text-gray-900 text-center mb-8" 
          style={{ 
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-weight-medium)',
            letterSpacing: '0.01em'
          }}
        >
          Designed for better coffee
        </p>
        
        {/* Sign in with Google Button */}
        <Button 
          onClick={handleGoogleLogin}
          className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer px-6 py-3 flex items-center w-full max-w-md"
          style={{
            fontWeight: 'var(--font-weight-medium)'
          }}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
}
