import { Button } from './ui/button';
import { Card } from './ui/card';
import { Coffee } from 'lucide-react';
import { supabase } from '../utils/supabase/client';
import coffeeIllustration from '../assets/a4ded3d553dbb411506381e0bb3995b35e4538d9 (2).avif';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
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
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
      <div className="flex w-full max-w-6xl">
        {/* Left side - Coffee Cup Illustration */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
          <img 
            src={coffeeIllustration} 
            alt="Coffee cup illustration" 
            className="max-w-md w-full"
          />
        </div>

        {/* Right side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <h1 className="text-gray-900" style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-weight-bold)', color: '#111827' }}>Hone</h1>
                <p className="text-gray-600 text-lg" style={{ fontWeight: 500 }}>Designed for better coffee</p>
              </div>

              <div className="w-full space-y-4">
                <Button 
                  onClick={handleGoogleLogin}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer"
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}