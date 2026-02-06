import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { StaticTimelineScreenshot } from './StaticTimelineScreenshot';

interface LandingPageProps {
  onLoginSuccess?: () => void;
}

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    
    // TODO: Add actual API call to submit email to waitlist
    // For now, just simulate a delay and show success
    setTimeout(() => {
      setSubmitted(true);
      setIsSubmitting(false);
      setEmail('');
    }, 500);
  };

  return (
    <div className="landing-page" style={{ minHeight: '100vh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 16px' }}>
      <div style={{ maxWidth: '1400px', width: '100%', display: 'flex', alignItems: 'center', gap: '64px', flexWrap: 'wrap' }}>
        {/* Hero Section - Left */}
        <section className="landing-section" style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', order: 2 }}>
        <div className="landing-text-content" style={{ textAlign: 'left', width: '100%' }}>
          <h1 
            style={{ 
              fontSize: 'clamp(2.5rem, 5vw, 4rem)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: '1.1',
              color: '#111827',
              marginBottom: '16px',
              margin: '0 0 16px 0'
            }}
          >
            Dial in any bean, perfectly.
          </h1>
          
          <p 
            className="landing-subtitle"
            style={{ 
              fontSize: 'clamp(1.125rem, 2vw, 1.25rem)',
              fontWeight: 400,
              lineHeight: '1.6',
              color: '#4b5563',
              marginBottom: '24px',
              maxWidth: '672px',
              margin: '0 0 24px 0'
            }}
          >
            Your personal coffee coach. Know exactly what to tweak next.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ maxWidth: '480px', margin: '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
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
                    textAlign: 'left',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#111827'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
                <Button 
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || !email}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontWeight: 500,
                    width: '100%'
                  }}
                >
                  {isSubmitting ? 'Requesting...' : 'Request Early Access'}
                  {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
                <p style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  color: '#6b7280',
                  margin: '8px 0 0 0',
                  textAlign: 'center'
                }}>
                  Rolling access • Built with early users
                </p>
              </div>
            </form>
          ) : (
            <div style={{ 
              padding: '16px 24px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              maxWidth: '480px',
              margin: '0'
            }}>
              <p style={{ 
                fontSize: '1rem',
                lineHeight: '1.5',
                color: '#166534',
                margin: 0,
                fontWeight: 500
              }}>
                You're on the list! We'll be in touch.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Static Timeline Screenshot - Right */}
      <div style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', order: 1 }}>
        <StaticTimelineScreenshot />
      </div>
      </div>

      <style>{`
        .landing-page * {
          box-sizing: border-box;
        }
        .landing-section {
          display: block;
        }
        input[type="email"] {
          text-align: left !important;
        }
        input[type="email"]:focus {
          border-color: #111827 !important;
        }
        @media (max-width: 1024px) {
          .landing-page {
            height: 100vh !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
            overflow: hidden !important;
            padding: 0 !important;
          }
          .landing-page > div {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            height: 100% !important;
            gap: 0 !important;
            padding: 32px 16px !important;
            position: relative !important;
          }
          .landing-section {
            order: 1 !important;
            width: 100% !important;
            min-width: auto !important;
            flex: 0 0 auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 1 !important;
          }
          .landing-text-content {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .landing-page > div > div:last-child {
            order: 2 !important;
            width: 100% !important;
            min-width: auto !important;
            position: absolute !important;
            bottom: 32px !important;
            left: 16px !important;
            right: 16px !important;
            z-index: 0 !important;
          }
          .landing-text-content {
            text-align: center !important;
          }
          .landing-text-content * {
            text-align: center !important;
          }
          .landing-text-content form {
            margin-left: auto !important;
            margin-right: auto !important;
            maxWidth: 480px !important;
            width: 100% !important;
          }
          .landing-text-content > div {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .landing-section {
            text-align: center !important;
          }
          .landing-section p,
          .landing-subtitle {
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
        @media (max-width: 768px) {
          .landing-text-content form {
            maxWidth: 100% !important;
            width: 100% !important;
          }
          .landing-text-content input[type="email"],
          .landing-text-content button {
            width: 100% !important;
          }
          .landing-text-content input[type="email"] {
            text-align: left !important;
          }
        }
        @media (min-width: 1025px) {
          .landing-section {
            order: 1 !important;
          }
          .landing-page > div > div:last-child {
            order: 2 !important;
          }
        }
      `}</style>
    </div>
  );
}
