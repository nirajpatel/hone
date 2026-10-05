import { useLayoutEffect, useRef } from 'react';

const TOP_HALF = 'M108.87,64.36c-.8-17.27-6.31-33.21-15.52-44.91l-.1-.13C83.87,7.47,71.21.64,57.58.06c-1.87-.08-4.03-.08-5.98,0-13.62.58-26.29,7.42-35.67,19.26C6.67,31.03,1.12,47.03.32,64.36l-.32,6.88,5.89-.24c13.66-.55,26.36-7.39,35.76-19.27l.05-.06c5.9-7.48,10.28-16.7,12.89-26.89,2.62,10.22,7.01,19.46,12.94,26.94l.09.11c9.39,11.81,22.06,18.61,35.68,19.16l5.89.24-.32-6.88Z';
const BOTTOM_HALF = 'M.32,90.1c.8,17.27,6.31,33.21,15.52,44.91l.1.13c9.38,11.85,22.04,18.68,35.66,19.26,1.87.08,4.03.08,5.98,0,13.62-.58,26.29-7.42,35.67-19.26,9.27-11.71,14.82-27.7,15.62-45.03l.32-6.88-5.89.24c-13.66.55-26.36,7.39-35.76,19.27l-.05.06c-5.9,7.48-10.28,16.7-12.89,26.89-2.62-10.22-7.01-19.46-12.94-26.94l-.09-.11c-9.39-11.81-22.06-18.61-35.68-19.16l-5.89-.24.32,6.88Z';

const STYLES = `
.hone-trace { opacity: 0; }
.hone-trace.ready { opacity: 1; }
.hone-trace path {
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 5.5;
  stroke-linejoin: round;
  stroke-dasharray: calc(var(--len) * 1px) calc(var(--len) * 1px);
  animation: hone-trace 3s cubic-bezier(.6, 0, .4, 1) infinite both;
}
.hone-trace path + path { animation-delay: .15s; }
@keyframes hone-trace {
  0%   { stroke-dashoffset: calc(var(--len) * 1px); fill-opacity: 0; opacity: 1; }
  50%  { stroke-dashoffset: 0; fill-opacity: 0; }
  65%  { fill-opacity: 1; }
  85%  { stroke-dashoffset: 0; fill-opacity: 1; opacity: 1; }
  100% { stroke-dashoffset: 0; fill-opacity: 1; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hone-trace path { animation: none; stroke-dasharray: none; fill-opacity: 1; }
}
`;

export function MarkTraceLoading() {
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.querySelectorAll('path').forEach((p) => {
      p.style.setProperty('--len', p.getTotalLength().toFixed(2));
    });
    svg.classList.add('ready');
  }, []);

  return (
    <>
      <style>{STYLES}</style>
      <svg
        ref={svgRef}
        className="hone-trace"
        role="img"
        aria-label="Loading"
        width={28}
        height={40}
        viewBox="0 0 109.19 154.45"
        style={{ color: '#111827', overflow: 'visible' }}
      >
        <path d={TOP_HALF} />
        <path d={BOTTOM_HALF} />
      </svg>
    </>
  );
}
