import { Button } from './ui/button';
import { ArrowRight, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { StaticTimelineScreenshot } from './StaticTimelineScreenshot';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface LandingPageProps {
  onLoginSuccess?: () => void;
}

const PREDEFINED_METHODS = [
  'Espresso',
  'Pour Over',
  'AeroPress',
  'French Press',
  'Other',
];

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [email, setEmail] = useState('');
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [headlineFontSize, setHeadlineFontSize] = useState<number | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const headlineContainerRef = useRef<HTMLDivElement>(null);

  // Focus email field if coming from request access link
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('requestAccess') === 'true') {
      // Clear the query parameter
      window.history.replaceState({}, '', '/');
      // Focus the email input after a short delay to ensure it's rendered
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, []);


  // Dynamic font sizing for headline on mobile
  useEffect(() => {
    const adjustHeadlineFontSize = () => {
      if (!headlineRef.current || !headlineContainerRef.current) return;
      
      // Only adjust on mobile (max-width: 768px)
      if (window.innerWidth > 768) {
        setHeadlineFontSize(null);
        return;
      }

      const container = headlineContainerRef.current;
      const headline = headlineRef.current;
      const text = headline.textContent || '';
      
      if (!text) return;

      // Get container width (accounting for padding)
      const containerStyle = window.getComputedStyle(container);
      const containerPadding = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
      const availableWidth = container.offsetWidth - containerPadding;

      // Binary search for optimal font size
      let minSize = 12; // Minimum font size in pixels
      let maxSize = 32; // Maximum font size in pixels
      let optimalSize = maxSize;

      // Create a temporary element to measure text width
      const measureElement = document.createElement('span');
      measureElement.style.position = 'absolute';
      measureElement.style.visibility = 'hidden';
      measureElement.style.whiteSpace = 'nowrap';
      measureElement.style.fontWeight = '700';
      measureElement.style.letterSpacing = '-0.02em';
      measureElement.style.fontFamily = window.getComputedStyle(headline).fontFamily;
      measureElement.textContent = text;
      document.body.appendChild(measureElement);

      // Binary search
      while (minSize <= maxSize) {
        const midSize = Math.floor((minSize + maxSize) / 2);
        measureElement.style.fontSize = `${midSize}px`;
        const textWidth = measureElement.offsetWidth;

        if (textWidth <= availableWidth) {
          optimalSize = midSize;
          minSize = midSize + 1;
        } else {
          maxSize = midSize - 1;
        }
      }

      document.body.removeChild(measureElement);
      setHeadlineFontSize(optimalSize);
    };

    adjustHeadlineFontSize();
    
    const handleResize = () => {
      adjustHeadlineFontSize();
    };

    window.addEventListener('resize', handleResize);
    // Also adjust after a short delay to ensure layout is complete
    const timeoutId = setTimeout(adjustHeadlineFontSize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const toggleMethod = (method: string) => {
    setSelectedMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    
    if (!email || selectedMethods.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
      const response = await fetch(`${apiUrl}/early-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ 
          email,
          methods: selectedMethods,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      setSubmitted(true);
      setIsSubmitting(false);
      setEmail('');
      setSelectedMethods([]);
      setHasAttemptedSubmit(false);
    } catch (error) {
      console.error('Error submitting early access request:', error);
      setIsSubmitting(false);
      // Still show success to user even if email fails (graceful degradation)
      setSubmitted(true);
      setEmail('');
      setSelectedMethods([]);
      setHasAttemptedSubmit(false);
    }
  };

  const handleSignInClick = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="landing-page-wrapper" style={{ minHeight: '100dvh', height: '100dvh', maxHeight: '100dvh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Desktop Header - Top Left */}
      <nav className="landing-desktop-header bg-white" style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: '60px', padding: '0 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)' }}>Hone</div>
          <Button 
            onClick={handleSignInClick}
            variant="ghost"
            className="text-gray-900 hover:bg-gray-100 cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Sign in
          </Button>
        </div>
      </nav>

      {/* Mobile/Tablet Header - Left Aligned */}
      <nav className="landing-mobile-header bg-white" style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: '60px' }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <div className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-lg)' }}>Hone</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              onClick={handleSignInClick}
              variant="ghost"
              className="text-gray-900 hover:bg-gray-100 cursor-pointer"
              style={{ fontWeight: 500, padding: '4px 12px' }}
            >
              Sign in
            </Button>
          </div>
        </div>
      </nav>

      <div className="landing-page" style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 2rem', overflow: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: '64px', flexWrap: 'wrap' }}>
        {/* Hero Section - Left */}
        <section className="landing-section" style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', order: 2 }}>
        <div ref={headlineContainerRef} className="landing-text-content" style={{ textAlign: 'left', width: '100%' }}>
          <h1 
            ref={headlineRef}
            style={{ 
              fontSize: headlineFontSize ? `${headlineFontSize}px` : 'clamp(2.5rem, 5vw, 4rem)',
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
            <form onSubmit={handleSubmit} style={{ maxWidth: '480px', margin: '0', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'stretch', position: 'relative' }}>
                <div style={{ position: 'relative', width: '100%', minHeight: '48px', isolation: 'isolate' }}>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      paddingRight: '40px', // Make room for LastPass icon
                      fontSize: '1rem',
                      lineHeight: '1.5',
                      color: '#111827',
                      backgroundColor: 'rgb(255, 255, 255)',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                      textAlign: 'left',
                      boxSizing: 'border-box',
                      height: '48px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#111827';
                      // Prevent any scroll behavior
                      e.currentTarget.scrollIntoView({ behavior: 'instant', block: 'nearest' });
                    }}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  />
                </div>
                
                {/* Coffee Methods Multi-Select Pills */}
                <div className="brew-methods-section" style={{ width: '100%', marginTop: '8px', marginBottom: '8px' }}>
                  {/* Header */}
                  <label className="brew-methods-label" style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '8px',
                    textAlign: 'left',
                  }}>
                    Your brew methods
                  </label>
                  
                  {/* All Method Pills */}
                  <div className="brew-methods-pills-container" style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}>
                    {PREDEFINED_METHODS.map((method) => {
                      const isSelected = selectedMethods.includes(method);
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleMethod(method);
                          }}
                          disabled={isSubmitting}
                          className={`inline-flex items-center gap-1 rounded-full text-sm border transition-colors ${
                            isSelected
                              ? 'bg-gray-900 border-gray-900 text-white hover:bg-gray-800'
                              : 'bg-transparent border-gray-300 text-gray-900 hover:bg-gray-100'
                          } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                          }}
                        >
                          <span>{method}</span>
                          {isSelected && (
                            <X className="w-3 h-3 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  
                  {selectedMethods.length === 0 && hasAttemptedSubmit && (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#ef4444',
                      marginTop: '8px',
                    }}>
                      Please select at least one coffee method
                    </p>
                  )}
                </div>
                
                <Button 
                  type="submit"
                  size="lg"
                  disabled={isSubmitting || !email || selectedMethods.length === 0}
                  className="bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer px-8 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontWeight: 500,
                    width: '100%',
                  }}
                >
                  {isSubmitting ? 'Requesting...' : 'Request Early Access'}
                  {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
                <p className="rolling-access-text" style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  color: '#6b7280',
                  margin: '4px auto 0 auto',
                  textAlign: 'center',
                  width: '100%'
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
                You're on the list! We'll be in touch soon.
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
        button[type="button"] {
          text-align: left !important;
          font-size: 1rem !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"] {
          padding-left: 16px !important;
          padding-right: 16px !important;
          padding-top: 4px !important;
          padding-bottom: 4px !important;
          height: auto !important;
          min-height: auto !important;
        }
        button[type="button"] span {
          text-align: left !important;
          font-size: inherit !important;
        }
        input[type="checkbox"] {
          border-radius: 4px !important;
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
            justify-content: space-between !important;
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
            align-items: flex-start !important;
            justify-content: flex-start !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .landing-text-content h1 {
            margin-top: 0 !important;
            margin-bottom: 12px !important;
            font-size: clamp(1.75rem, 4vw, 2.5rem) !important;
            text-align: left !important;
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
            justify-content: flex-start !important;
            text-align: left !important;
          }
          .landing-graph-container > div {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            text-align: left !important;
          }
          .static-timeline-card {
            margin-bottom: 0 !important;
            margin-top: 0 !important;
            text-align: left !important;
          }
          .landing-text-content {
            text-align: left !important;
          }
          .landing-text-content button[type="button"],
          .landing-text-content button[type="button"] span,
          .landing-text-content label,
          .landing-text-content label span {
            text-align: left !important;
          }
          .landing-text-content * {
            text-align: left !important;
          }
          .landing-text-content form div p.rolling-access-text {
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
            text-align: left !important;
          }
          .landing-section p,
          .landing-subtitle {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .landing-text-content {
            align-items: center !important;
          }
          .landing-text-content h1 {
            text-align: center !important;
          }
          .landing-text-content .landing-subtitle {
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .landing-text-content form div p.rolling-access-text {
            margin-top: 8px !important;
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
            padding: 16px !important;
            padding-top: 60px !important;
            padding-bottom: 60px !important;
            justify-content: center !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .landing-graph-container {
            margin-bottom: 20px !important;
            text-align: left !important;
            display: flex !important;
            justify-content: flex-start !important;
            align-items: flex-start !important;
          }
          .landing-graph-container > div {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
          }
          .static-timeline-card {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
          }
          .landing-graph-container .static-timeline-card h3 {
            text-align: left !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 {
            text-align: left !important;
          }
          .landing-graph-container .static-timeline-card p {
            text-align: left !important;
            justify-content: flex-start !important;
          }
          .landing-text-content {
            align-items: flex-start !important;
          }
          .landing-text-content h1 {
            margin-bottom: 6px !important;
            text-align: left !important;
            line-height: 1.1 !important;
          }
          .landing-text-content .landing-subtitle {
            margin-bottom: 20px !important;
            font-size: clamp(1rem, 2.5vw, 1.125rem) !important;
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
          }
          .landing-text-content * {
            text-align: left !important;
          }
          .landing-text-content h1,
          .landing-text-content .landing-subtitle {
            text-align: left !important;
          }
          .landing-text-content form {
            maxWidth: 100% !important;
            width: 100% !important;
            text-align: left !important;
            align-items: flex-start !important;
          }
          .landing-text-content form > div {
            text-align: left !important;
            align-items: flex-start !important;
            display: flex !important;
            flex-direction: column !important;
          }
          .landing-text-content form > div > div {
            text-align: left !important;
            align-items: flex-start !important;
          }
          .landing-text-content .brew-methods-label,
          .landing-text-content .brew-methods-section label,
          .landing-text-content form label.brew-methods-label,
          .landing-text-content form .brew-methods-section label {
            text-align: left !important;
            margin-bottom: 0 !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            display: block !important;
          }
          .landing-text-content form .brew-methods-section {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .landing-text-content form .brew-methods-label,
          .landing-text-content form .brew-methods-section label {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
          }
          .landing-text-content input[type="email"],
          .landing-text-content button:not(.brew-methods-pills-container button) {
            width: 100% !important;
          }
          .landing-text-content form > div > div:first-child {
            min-height: 40px !important;
          }
          .landing-text-content input[type="email"] {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 10px 14px !important;
          }
          .landing-text-content button[type="button"]:not(.brew-methods-pills-container *) {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 10px 14px !important;
          }
          .landing-text-content .brew-methods-pills-container button[type="button"] {
            height: auto !important;
            min-height: auto !important;
            padding-left: 16px !important;
            padding-right: 14px !important;
            padding-top: 6px !important;
            padding-bottom: 6px !important;
          }
          .landing-text-content button[type="button"] span {
            text-align: left !important;
            font-size: 0.875rem !important;
            line-height: 1.5 !important;
          }
          .landing-text-content button[type="submit"] {
            font-size: 0.875rem !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 10px 16px !important;
          }
          .landing-text-content label span {
            font-size: 0.875rem !important;
          }
          .landing-text-content form label {
            padding: 6px 10px !important;
          }
          .landing-text-content form label.brew-methods-label,
          .landing-text-content form .brew-methods-section label {
            padding: 0 !important;
            padding-bottom: 8px !important;
          }
          .landing-text-content form > div > div > div > div {
            padding: 4px !important;
          }
          .landing-text-content form div p.rolling-access-text {
            text-align: center !important;
            font-size: 0.75rem !important;
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
            justify-content: space-between !important;
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
          .landing-text-content form div p.rolling-access-text {
            margin-top: 8px !important;
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
        .landing-footer-text a {
          color: #6b7280 !important;
          text-decoration: none !important;
          cursor: pointer !important;
          transition: text-decoration 0.2s ease !important;
        }
        .landing-footer-text a:hover {
          text-decoration: underline !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"] {
          height: auto !important;
          min-height: auto !important;
          padding-left: 16px !important;
          padding-right: 16px !important;
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }
      `}</style>

      {/* Footer */}
      <footer className="landing-footer-text" style={{ padding: '0 2rem', fontSize: '0.875rem', color: '#6b7280', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', textAlign: 'left' }}>
          © 2026 Hone • <a href="/privacy">Privacy</a> • <a href="/terms">Terms</a>
        </div>
      </footer>
    </div>
  );
}
