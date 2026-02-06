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
    <div className="landing-page-wrapper" style={{ minHeight: '100dvh', height: '100dvh', maxHeight: '100dvh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Desktop Header - Top Left */}
      <nav className="landing-desktop-header bg-white" style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: '60px', padding: '0 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)' }}>Hone</div>
        </div>
      </nav>

      {/* Mobile/Tablet Header - Centered Top */}
      <nav className="landing-mobile-header bg-white" style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: '60px' }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)' }}>Hone</div>
        </div>
      </nav>

      <div className="landing-page" style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 2rem', overflow: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: '64px', flexWrap: 'wrap' }}>
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
            Dial in any bean, perfectly
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
            Brew smarter with personalized guidance
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
      <div className="landing-graph-container" style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', order: 1 }}>
        <StaticTimelineScreenshot />
      </div>
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
          .landing-mobile-header {
            display: block !important;
            height: 60px !important;
          }
          .landing-mobile-header > div {
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .landing-desktop-header {
            display: none !important;
          }
          .landing-page-wrapper {
            position: relative !important;
            height: 100vh !important;
            height: 100dvh !important;
            max-height: 100vh !important;
            max-height: 100dvh !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }
          .landing-page {
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
            padding: 0 !important;
            flex: 1 1 0 !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .landing-page > div {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 0 !important;
            gap: 0 !important;
            padding: 16px !important;
            padding-top: 60px !important;
            padding-bottom: 60px !important;
            position: relative !important;
            flex: 1 1 0 !important;
            width: 100% !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
            display: flex !important;
            box-sizing: border-box !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .landing-section {
            order: 2 !important;
            width: 100% !important;
            min-width: auto !important;
            flex: 0 0 auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 1 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            margin-bottom: 16px !important;
          }
          .landing-text-content {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-start !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .landing-text-content h1 {
            margin-top: 0 !important;
            margin-bottom: 12px !important;
            font-size: clamp(1.75rem, 4vw, 2.5rem) !important;
          }
          .landing-text-content .landing-subtitle {
            margin-bottom: 16px !important;
            font-size: clamp(1rem, 2vw, 1.125rem) !important;
          }
          .landing-graph-container {
            position: relative !important;
            width: 100% !important;
            z-index: 0 !important;
            order: 1 !important;
            min-width: auto !important;
            margin-bottom: 56px !important;
            padding-bottom: 0 !important;
            flex: 0 0 auto !important;
            display: block !important;
            align-items: normal !important;
            justify-content: normal !important;
          }
          .landing-graph-container > div {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
          }
          .static-timeline-card {
            margin-bottom: 0 !important;
            margin-top: 0 !important;
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
          .landing-page-wrapper {
            height: 100vh !important;
            height: 100dvh !important;
            max-height: 100vh !important;
            max-height: 100dvh !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
          }
          .landing-page > div {
            padding: 12px !important;
            padding-top: 60px !important;
            padding-bottom: 60px !important;
            justify-content: center !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .landing-graph-container {
            margin-bottom: 24px !important;
          }
          .landing-text-content h1 {
            margin-bottom: 8px !important;
            font-size: clamp(2rem, 6vw, 2.5rem) !important;
          }
          .landing-text-content .landing-subtitle {
            margin-bottom: 24px !important;
            font-size: clamp(1rem, 2.5vw, 1.125rem) !important;
          }
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
          .landing-footer-text {
            height: 60px !important;
            padding: 0 16px !important;
            font-size: 0.75rem !important;
          }
        }
        @media (min-width: 1025px) {
          .landing-page-wrapper {
            height: auto !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            overflow: visible !important;
          }
          .landing-page {
            overflow: visible !important;
            padding: 64px 2rem !important;
          }
          .landing-section {
            order: 1 !important;
          }
          .landing-page > div > div:last-child {
            order: 2 !important;
          }
          .landing-desktop-header {
            display: block !important;
            height: 60px !important;
            padding: 0 2rem !important;
          }
          .landing-desktop-header > div {
            height: 100% !important;
            display: flex !important;
            align-items: center !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
          }
          .landing-mobile-header {
            display: none !important;
          }
          .landing-footer-text {
            height: 60px !important;
            justify-content: flex-start !important;
            padding: 0 2rem !important;
          }
          .landing-footer-text > div {
            text-align: left !important;
            margin: 0 auto !important;
            max-width: 1400px !important;
          }
        }
        .landing-footer-text {
          text-align: left !important;
          height: 60px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          padding: 0 2rem !important;
        }
        .landing-footer-text > div {
          text-align: left !important;
        }
        @media (max-width: 1024px) {
          .landing-footer-text {
            text-align: center !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            visibility: visible !important;
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            padding: 0 16px !important;
            background-color: rgb(255, 255, 255) !important;
            z-index: 5 !important;
            margin: 0 !important;
            height: 60px !important;
          }
          .landing-footer-text > div {
            width: 100% !important;
            text-align: center !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
          }
        }
      `}</style>

      {/* Footer */}
      <footer className="landing-footer-text" style={{ padding: '0 2rem', fontSize: '0.875rem', color: '#6b7280', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
          © 2026 Hone • Privacy • Terms
        </div>
      </footer>
    </div>
  );
}
