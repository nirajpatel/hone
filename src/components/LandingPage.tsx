import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { StaticTimelineScreenshot } from './StaticTimelineScreenshot';
import honeLogo from '../assets/hone-logo.svg';

interface LandingPageProps {
  onLoginSuccess?: () => void;
}

export function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [headlineFontSize, setHeadlineFontSize] = useState<number | null>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const headlineContainerRef = useRef<HTMLDivElement>(null);

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

  const handleSignInClick = () => {
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleGetStartedClick = () => {
    window.history.pushState({}, '', '/login?signup=true');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="landing-page-wrapper" style={{ minHeight: '100dvh', height: '100dvh', maxHeight: '100dvh', backgroundColor: 'rgb(255, 255, 255)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Desktop Header - Top Left */}
      <nav className="landing-desktop-header bg-white" style={{ display: 'none', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: '60px', padding: '0 2rem' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="landing-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <img src={honeLogo} alt="" style={{ height: '24px', width: 'auto', display: 'block' }} />
            <span className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: '18px', lineHeight: 1, color: '#111827' }}>Hone</span>
          </div>
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
      <nav className="landing-mobile-header bg-white" style={{ display: 'none', flexShrink: 0, height: '60px' }}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <div className="landing-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <img src={honeLogo} alt="" style={{ height: '24px', width: 'auto', display: 'block' }} />
            <span className="text-gray-900" style={{ fontWeight: 'var(--font-weight-bold)', fontSize: '18px', lineHeight: 1, color: '#111827' }}>Hone</span>
          </div>
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
        <div className="landing-main" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: '64px', flexWrap: 'wrap' }}>
        {/* Headline block - order 1 on mobile */}
        <div ref={headlineContainerRef} className="landing-headline-block landing-text-content" style={{ flex: '1', minWidth: '400px', textAlign: 'left', width: '100%' }}>
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
            Dial in any bean, perfectly.
          </h1>
          <p 
            className="landing-subtitle"
            style={{ 
              fontSize: 'clamp(1.25rem, 2vw, 1.375rem)',
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
        </div>

        {/* Graph - order 2 on mobile */}
        <div className="landing-graph-container" style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <StaticTimelineScreenshot />
        </div>

        {/* CTA block - order 3 on mobile */}
        <div className="landing-cta-block landing-text-content" style={{ flex: '1', minWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <Button 
            type="button"
            onClick={handleGetStartedClick}
            size="lg"
            className="landing-cta-button bg-gray-900 hover:bg-gray-800 text-white rounded-lg cursor-pointer px-8 py-3 text-base inline-flex items-center justify-center gap-2"
            style={{
              fontWeight: 500,
              maxWidth: '480px',
              width: '100%',
            }}
          >
            Get Started
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Button>
        </div>
      </div>
      </div>

      <footer className="landing-footer" style={{ height: '60px', flex: '0 0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontSize: '0.875rem', color: '#6b7280', textAlign: 'left', backgroundColor: 'rgb(255, 255, 255)', boxSizing: 'border-box' }}>
        <div className="landing-footer-inner" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 0, boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'left' }}>
            © 2026 Hone • <a href="/privacy" style={{ color: '#6b7280', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>Privacy</a> • <a href="/terms" style={{ color: '#6b7280', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>Terms</a>
          </div>
        </div>
      </footer>

      <style>{`
        .landing-page * {
          box-sizing: border-box;
        }
        .landing-main {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          grid-template-rows: auto auto !important;
          column-gap: 64px !important;
          row-gap: 0 !important;
          align-items: start !important;
        }
        .landing-headline-block {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }
        .landing-graph-container {
          grid-column: 2 !important;
          grid-row: 1 / -1 !important;
          align-self: center !important;
        }
        .landing-cta-block {
          grid-column: 1 !important;
          grid-row: 2 !important;
        }
        .landing-cta-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          line-height: 1 !important;
          margin-top: 1em !important;
        }
        .landing-cta-button svg {
          display: block !important;
          vertical-align: middle !important;
          margin: 0 !important;
        }
        .landing-footer {
          justify-content: flex-start !important;
          align-items: center !important;
          text-align: left !important;
        }
        .landing-footer-inner {
          justify-content: flex-start !important;
          align-items: center !important;
          text-align: left !important;
        }
        .landing-footer-inner > div {
          text-align: left !important;
          width: auto !important;
          max-width: none !important;
        }
        .landing-header-brand {
          gap: 5px !important;
        }
        .landing-header-brand img {
          height: 24px !important;
          width: auto !important;
          display: block !important;
        }
        .landing-header-brand span {
          font-size: 18px !important;
          line-height: 1 !important;
          color: #111827 !important;
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
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900) {
          color: #6b7280 !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):hover {
          color: #111827 !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):active,
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):focus {
          color: #6b7280 !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):active:hover,
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):focus:hover {
          color: #111827 !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"].bg-gray-900 {
          color: #ffffff !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900) span {
          color: inherit !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):hover span {
          color: inherit !important;
        }
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):active span,
        .landing-text-content .brew-methods-pills-container button[type="button"]:not(.bg-gray-900):focus span {
          color: inherit !important;
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
            height: 100dvh !important;
            max-height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
          }
          .landing-page {
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 0 !important;
            flex: 1 1 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
          }
          .landing-page > div,
          .landing-main {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 20px !important;
            padding: 16px !important;
            position: relative !important;
            flex: 0 0 auto !important;
            width: 100% !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
            display: flex !important;
            box-sizing: border-box !important;
          }
          .landing-main {
            grid-template-columns: none !important;
            grid-template-rows: none !important;
          }
          .landing-headline-block {
            order: 1 !important;
            width: 100% !important;
            min-width: auto !important;
            flex: 0 0 auto !important;
            grid-column: auto !important;
            grid-row: auto !important;
          }
          .landing-graph-container {
            order: 2 !important;
            grid-column: auto !important;
            grid-row: auto !important;
          }
          .landing-cta-block {
            order: 3 !important;
            width: 100% !important;
            min-width: auto !important;
            flex: 0 0 auto !important;
            grid-column: auto !important;
            grid-row: auto !important;
          }
          .landing-footer,
          .landing-footer-inner {
            justify-content: flex-start !important;
            text-align: left !important;
          }
          .landing-footer {
            padding: 0 16px !important;
          }
          .landing-footer-inner {
            padding: 0 !important;
          }
          .landing-footer-inner > div {
            text-align: left !important;
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
            margin-bottom: 0 !important;
            font-size: clamp(1.125rem, 2vw, 1.25rem) !important;
          }
          .landing-graph-container {
            position: relative !important;
            width: 100% !important;
            z-index: 0 !important;
            order: 1 !important;
            min-width: auto !important;
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            flex: 0 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            justify-content: flex-start !important;
            text-align: left !important;
          }
          .landing-graph-container > div {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            text-align: left !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .static-timeline-card {
            margin-bottom: 0 !important;
            margin-top: 0 !important;
            text-align: left !important;
            align-self: flex-start !important;
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
          .landing-headline-block,
          .landing-cta-block {
            text-align: left !important;
          }
          .landing-subtitle {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .landing-mobile-header > div {
            display: grid !important;
            grid-template-columns: 1fr auto 1fr !important;
            align-items: center !important;
          }
          .landing-mobile-header > div > div:first-child {
            grid-column: 2 !important;
            justify-self: center !important;
          }
          .landing-mobile-header > div > div:last-child {
            grid-column: 3 !important;
            justify-self: end !important;
          }
          .landing-page > div {
            gap: 64px !important;
          }
          .landing-graph-container {
            margin-bottom: 0 !important;
          }
          .landing-text-content {
            align-items: center !important;
          }
          .landing-text-content h1 {
            text-align: center !important;
            margin-bottom: 10px !important;
            font-size: 40px !important;
          }
          .landing-text-content .landing-subtitle {
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
            margin-top: -2px !important;
            margin-bottom: 0 !important;
            font-size: 20px !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 {
            text-align: center !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 h3,
          .landing-graph-container .static-timeline-card .mb-3 p {
            text-align: center !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 p {
            justify-content: center !important;
          }
          .landing-footer,
          .landing-footer-inner {
            justify-content: center !important;
            text-align: center !important;
          }
          .landing-footer-inner > div {
            text-align: center !important;
          }
          .landing-text-content form div p.rolling-access-text {
            margin-top: 10px !important;
          }
          .landing-text-content form > div > div:first-child {
            min-height: 42px !important;
          }
          .landing-text-content input[type="email"] {
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 16px !important;
          }
          .landing-text-content form .brew-methods-section {
            margin-bottom: 12px !important;
          }
          .landing-text-content .brew-methods-pills-container button[type="button"] {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
        }
        @media (max-width: 768px) {
          .landing-page-wrapper {
            height: 100dvh !important;
            max-height: 100dvh !important;
            min-height: 100dvh !important;
          }
          .landing-page > div,
          .landing-main {
            gap: 20px !important;
          }
          .landing-page > div {
            padding: 16px !important;
            justify-content: center !important;
          }
          .landing-headline-block {
            order: 1 !important;
          }
          .landing-graph-container {
            order: 2 !important;
            margin-bottom: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            width: 100% !important;
          }
          .landing-graph-container > div {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .landing-graph-container .static-timeline-card {
            align-self: flex-start !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 {
            text-align: left !important;
          }
          .landing-cta-block {
            order: 3 !important;
          }
          .landing-mobile-header > div {
            display: flex !important;
            grid-template-columns: none !important;
            justify-content: space-between !important;
          }
          .landing-mobile-header > div > div:first-child {
            position: static !important;
            left: auto !important;
            transform: none !important;
            grid-column: auto !important;
            justify-self: auto !important;
          }
          .landing-mobile-header > div > div:last-child {
            grid-column: auto !important;
            justify-self: auto !important;
          }
          .landing-text-content {
            align-items: flex-start !important;
            text-align: left !important;
          }
          .landing-text-content h1 {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            margin-bottom: 6px !important;
          }
          .landing-text-content .landing-subtitle {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            font-size: 16px !important;
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
          .landing-text-content form .brew-methods-section label,
          .landing-text-content .email-label,
          .landing-text-content form label.email-label {
            text-align: left !important;
            margin-bottom: 4px !important;
            margin-top: -2px !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            display: block !important;
          }
          .landing-text-content form .brew-methods-section,
          .landing-text-content form .email-section {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .landing-text-content form .brew-methods-section {
            margin-top: 6px !important;
          }
          .landing-text-content form .brew-methods-label,
          .landing-text-content form .brew-methods-section label,
          .landing-text-content form .email-label,
          .landing-text-content form label.email-label {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-top: -2px !important;
            margin-bottom: 4px !important;
          }
          .landing-text-content input[type="email"],
          .landing-text-content button:not(.brew-methods-pills-container button) {
            width: 100% !important;
          }
          .landing-text-content form > div > div:first-child {
            min-height: 42px !important;
          }
          .landing-text-content input[type="email"] {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 14px !important;
          }
          .landing-text-content button[type="button"]:not(.brew-methods-pills-container *) {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 10px 14px !important;
          }
          .landing-cta-button {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 48px !important;
            height: 48px !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
            line-height: 1 !important;
            margin-top: 1em !important;
          }
          .landing-cta-button svg {
            display: block !important;
            vertical-align: middle !important;
            margin: 0 !important;
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
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 16px !important;
          }
          .landing-text-content label span {
            font-size: 0.875rem !important;
          }
          .landing-text-content form label {
            padding: 6px 10px !important;
          }
          .landing-text-content form label.brew-methods-label,
          .landing-text-content form .brew-methods-section label,
          .landing-text-content form label.email-label,
          .landing-text-content form .email-label {
            padding: 0 !important;
            padding-bottom: 0 !important;
            margin-top: -2px !important;
            margin-bottom: 6px !important;
          }
        }
        @media (min-width: 513px) and (max-width: 768px) {
          .landing-mobile-header > div {
            display: grid !important;
            grid-template-columns: 1fr auto 1fr !important;
            align-items: center !important;
            position: relative !important;
          }
          .landing-mobile-header > div > div:first-child {
            grid-column: 2 !important;
            justify-self: center !important;
          }
          .landing-mobile-header > div > div:last-child {
            grid-column: 3 !important;
            justify-self: end !important;
          }
          .landing-text-content {
            align-items: center !important;
          }
          .landing-text-content h1 {
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .landing-text-content .landing-subtitle {
            text-align: center !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 {
            text-align: center !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 h3,
          .landing-graph-container .static-timeline-card .mb-3 p {
            text-align: center !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 p {
            justify-content: center !important;
          }
          .landing-footer,
          .landing-footer-inner {
            justify-content: center !important;
            text-align: center !important;
          }
          .landing-footer-inner > div {
            text-align: center !important;
          }
        }
        @media (max-width: 512px) {
          .landing-mobile-header > div {
            display: flex !important;
            grid-template-columns: none !important;
            justify-content: space-between !important;
          }
          .landing-mobile-header > div > div:first-child {
            position: static !important;
            left: auto !important;
            transform: none !important;
            grid-column: auto !important;
            justify-self: auto !important;
          }
          .landing-mobile-header > div > div:last-child {
            grid-column: auto !important;
            justify-self: auto !important;
          }
          .landing-text-content {
            align-items: flex-start !important;
            text-align: left !important;
          }
          .landing-text-content h1 {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            margin-bottom: 6px !important;
          }
          .landing-text-content .landing-subtitle {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
          }
          .landing-text-content * {
            text-align: left !important;
          }
          .landing-text-content h1,
          .landing-text-content .landing-subtitle {
            text-align: left !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 {
            text-align: left !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 h3,
          .landing-graph-container .static-timeline-card .mb-3 p {
            text-align: left !important;
          }
          .landing-graph-container .static-timeline-card .mb-3 p {
            justify-content: flex-start !important;
          }
          .landing-graph-container {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            width: 100% !important;
          }
          .landing-graph-container > div {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .landing-graph-container .static-timeline-card {
            align-self: flex-start !important;
          }
          .landing-footer,
          .landing-footer-inner {
            justify-content: flex-start !important;
            text-align: left !important;
          }
          .landing-footer-inner > div {
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
          .landing-text-content form .brew-methods-section label,
          .landing-text-content .email-label,
          .landing-text-content form label.email-label {
            text-align: left !important;
            margin-bottom: 4px !important;
            margin-top: -2px !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            display: block !important;
          }
          .landing-text-content form .brew-methods-section,
          .landing-text-content form .email-section {
            text-align: left !important;
            margin-left: 0 !important;
            margin-right: auto !important;
            width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .landing-text-content form .brew-methods-section {
            margin-top: 6px !important;
          }
          .landing-text-content form .brew-methods-label,
          .landing-text-content form .brew-methods-section label,
          .landing-text-content form .email-label,
          .landing-text-content form label.email-label {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-top: -2px !important;
            margin-bottom: 4px !important;
          }
          .landing-text-content input[type="email"],
          .landing-text-content button:not(.brew-methods-pills-container button) {
            width: 100% !important;
          }
          .landing-text-content form > div > div:first-child {
            min-height: 42px !important;
          }
          .landing-text-content input[type="email"] {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 14px !important;
          }
          .landing-text-content button[type="button"]:not(.brew-methods-pills-container *) {
            text-align: left !important;
            font-size: 0.875rem !important;
            height: 40px !important;
            min-height: 40px !important;
            padding: 10px 14px !important;
          }
          .landing-cta-button {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 48px !important;
            height: 48px !important;
            padding-top: 12px !important;
            padding-bottom: 12px !important;
            line-height: 1 !important;
            margin-top: 1em !important;
          }
          .landing-cta-button svg {
            display: block !important;
            vertical-align: middle !important;
            margin: 0 !important;
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
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 16px !important;
          }
          .landing-text-content label span {
            font-size: 0.875rem !important;
          }
          .landing-text-content form label {
            padding: 6px 10px !important;
          }
          .landing-text-content form label.brew-methods-label,
          .landing-text-content form .brew-methods-section label,
          .landing-text-content form label.email-label,
          .landing-text-content form .email-label {
            padding: 0 !important;
            padding-bottom: 0 !important;
            margin-top: -2px !important;
            margin-bottom: 4px !important;
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
            min-height: 100dvh !important;
            overflow: visible !important;
          }
          .landing-page {
            overflow: visible !important;
            padding: 64px 2rem !important;
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
          .landing-footer {
            padding: 0 2rem !important;
          }
          .landing-footer-inner {
            padding: 0 !important;
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
        @media (min-width: 1025px) {
          .landing-text-content form div p.rolling-access-text {
            margin-top: 10px !important;
          }
          .landing-text-content h1 {
            margin-bottom: 10px !important;
          }
          .landing-text-content .landing-subtitle {
            margin-top: 0 !important;
          }
          .landing-text-content button[type="submit"] {
            height: 42px !important;
            min-height: 42px !important;
          }
          .landing-text-content form .brew-methods-section {
            margin-bottom: 12px !important;
          }
          .landing-text-content form > div > div:first-child {
            min-height: 36px !important;
          }
          .landing-text-content input[type="email"] {
            height: 36px !important;
            min-height: 36px !important;
            padding: 8px 16px !important;
          }
          .landing-text-content .brew-methods-pills-container button[type="button"] {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
        }
        @media (min-width: 769px) {
          .landing-text-content form > div > div:first-child {
            min-height: 42px !important;
          }
          .landing-text-content input[type="email"] {
            height: 42px !important;
            min-height: 42px !important;
            padding: 10px 16px !important;
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
      `}</style>
    </div>
  );
}
