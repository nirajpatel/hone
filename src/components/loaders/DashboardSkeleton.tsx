import { useLayoutEffect, useState, type CSSProperties } from 'react';
import { AppNavBrand } from '../AppNavBrand';
import { BrewsToolbar } from '../BrewsToolbar';
import { Button } from '../ui/button';
import coffeeBeansImage from '../../assets/coffee-beans.webp';

// Placeholders for the dashboard's data while it loads. The real nav and toolbars render around them.
// Brew card spacing, chart height and date columns follow BrewsTimelineView so the real cards land in the same place.
const STYLES = `
@keyframes hone-skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
.hone-skel-bar, .hone-skel-chart { animation: hone-skel-pulse 1.6s ease-in-out infinite; }
.hone-skel-bar { background: var(--color-gray-200); border-radius: 4px; max-width: 100%; }
.hone-skel-line { display: flex; align-items: center; }
.hone-skel-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; }
.hone-skel-card { padding: 16px; }
.hone-skel-chart { position: relative; height: 136px; overflow: hidden; }
.hone-skel-block { position: absolute; left: 0; right: 0; top: 0; height: 90px; border-radius: 8px; background: linear-gradient(var(--color-gray-100), transparent); }
.hone-skel-dates { position: absolute; left: 0; right: 0; top: 102px; height: 34px; padding: 0 8px; overflow: hidden; display: grid; grid-template-columns: repeat(auto-fill, 60px); grid-auto-rows: 34px; column-gap: 8px; }
.hone-skel-date { display: flex; flex-direction: column; align-items: center; }
.hone-skel-shelf { display: flex; gap: 16px; overflow: hidden; margin-top: 8px; }
.hone-skel-bag { flex: none; width: 14em; background: #fff; border: 1px solid var(--color-gray-200); border-radius: 8px; padding: 1em; }
.hone-skel-bag-image { height: 12.5em; border-radius: 4px; }
@media (min-width: 768px) {
  .hone-skel-cards { gap: 10px; padding-top: 0; }
  .hone-skel-card { padding: 20px; }
  .hone-skel-chart { height: 166px; }
  .hone-skel-block { height: 120px; }
  .hone-skel-dates { top: 132px; grid-template-columns: repeat(auto-fill, 80px); column-gap: 32px; }
  .hone-skel-bag { width: 26em; display: flex; gap: 0.75em; padding: 0.75em; }
  .hone-skel-bag-image { width: 155px; flex: none; }
}
@keyframes hone-skel-ghost-out { from { opacity: 1; } to { opacity: 0; } }
.hone-skel-ghost { position: absolute; left: 0; right: 0; top: 0; pointer-events: none; animation: hone-skel-ghost-out 700ms ease-out both; }
.hone-skel-ghost .hone-skel-bar, .hone-skel-ghost .hone-skel-chart { animation-delay: var(--hone-skel-phase, 0ms); }
.hone-skel-ghost .hone-skel-dates { animation: hone-skel-ghost-out 300ms ease-out both; animation-delay: inherit; }
@media (prefers-reduced-motion: reduce) { .hone-skel-bar, .hone-skel-chart, .hone-skel-ghost { animation: none; } }
`;

const PULSE_MS = 1600;
let brewSkeletonShownAt = 0;
let brewSkeletonRemovedAt = -Infinity;

/** True while real brew cards are mounting in place of BrewCardsSkeleton (as opposed to appearing later on). */
export function isReplacingBrewSkeleton() {
  return performance.now() - brewSkeletonRemovedAt < 250;
}

const CARD_COUNT = 4;
// More date columns than the widest card holds; the extras wrap to a hidden second row.
const COLUMN_COUNT = 24;
const noop = () => {};

function Bar({ width, height }: { width: number; height: number }) {
  return <div className="hone-skel-bar" style={{ width, height }} />;
}

function TextLine({ height, width, barHeight, className }: { height: number; width: number; barHeight: number; className?: string }) {
  return (
    <div className={className}>
      <div className="hone-skel-line" style={{ height }}>
        <Bar width={width} height={barHeight} />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="hone-skel-chart">
      <div className="hone-skel-block" />
      <div className="hone-skel-dates">
        {Array.from({ length: COLUMN_COUNT }, (_, i) => (
          <div key={i} className="hone-skel-date">
            <div className="hone-skel-line" style={{ height: 17 }}><Bar width={36} height={9} /></div>
            <div className="hone-skel-line" style={{ height: 17 }}><Bar width={44} height={9} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 mobile-timeline-card hone-skel-card">
      <div className="mb-3">
        <TextLine height={17} width={72} barHeight={9} />
        <TextLine height={24} width={150} barHeight={13} />
        <TextLine height={20} width={190} barHeight={10} className="md:hidden" />
        <TextLine height={20} width={290} barHeight={10} className="hidden md:block" />
        <TextLine height={20} width={170} barHeight={10} className="md:hidden" />
        <TextLine height={20} width={250} barHeight={10} className="hidden md:block" />
      </div>
      <SkeletonChart />
    </div>
  );
}

/**
 * A brew card skeleton's chart, left behind over the real timeline and faded out as it draws. Its pulse continues
 * in step with the skeleton it replaces so the handoff has no jump.
 */
export function SkeletonChartGhost({ delayMs }: { delayMs: number }) {
  const [pulsePhase] = useState(() => (performance.now() - brewSkeletonShownAt) % PULSE_MS);
  return (
    <div
      className="hone-skel-ghost"
      style={{ animationDelay: `${delayMs}ms`, '--hone-skel-phase': `${-pulsePhase}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <style>{STYLES}</style>
      <SkeletonChart />
    </div>
  );
}

/** Stand-in brew cards for the timeline while brews load. */
export function BrewCardsSkeleton() {
  useLayoutEffect(() => {
    brewSkeletonShownAt = performance.now();
    return () => { brewSkeletonRemovedAt = performance.now(); };
  }, []);
  return (
    <div className="hone-skel-cards" aria-busy="true" aria-label="Loading your brews">
      <style>{STYLES}</style>
      {Array.from({ length: CARD_COUNT }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

/** Stand-in bean shelves while beans load. */
export function BeanShelvesSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your beans">
      <style>{STYLES}</style>
      {[0, 1].map((shelf) => (
        <div key={shelf}>
          <Bar width={110} height={12} />
          <div className="hone-skel-shelf">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="hone-skel-bag">
                <div className="hone-skel-bar hone-skel-bag-image" />
                <div style={{ flex: 1, paddingTop: 12 }}>
                  <TextLine height={17} width={70} barHeight={9} />
                  <TextLine height={24} width={130} barHeight={13} />
                  <TextLine height={20} width={100} barHeight={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Avatar placeholder for the nav before the account has loaded. */
export function AvatarSkeleton() {
  return (
    <>
      <style>{STYLES}</style>
      <div className="hone-skel-bar" style={{ width: 32, height: 32, borderRadius: 999 }} aria-hidden="true" />
    </>
  );
}

/**
 * Full-page stand-in for the brief moments before the dashboard itself can render (the sign-in redirect and
 * the first session check). Its controls are inert; once the session is known the real dashboard takes over.
 */
export function DashboardSkeleton() {
  return (
    <div className="bg-gray-50 flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="flex flex-col flex-1" style={{ pointerEvents: 'none' }}>
        <nav className="bg-white border-b border-gray-200" aria-hidden="true">
          <div className="px-3 md:px-6 py-4">
            <div className="flex items-center justify-between">
              <AppNavBrand />
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2">
                  <Button variant="default" tabIndex={-1}><span>Brews</span></Button>
                  <Button variant="ghost" tabIndex={-1}><span>Beans</span></Button>
                </div>
                <div className="flex md:hidden items-center gap-2">
                  <Button variant="default" tabIndex={-1} className="h-9 w-9 p-0 text-xl">☕</Button>
                  <Button variant="ghost" tabIndex={-1} className="h-9 w-9 p-0 flex items-center justify-center">
                    <img src={coffeeBeansImage} alt="" className="object-contain" style={{ width: '18px', height: '18px' }} />
                  </Button>
                </div>
                <div className="flex items-center gap-3 border-l pl-4">
                  <AvatarSkeleton />
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="px-3 py-4 md:px-6 md:py-6 flex flex-col flex-1 mobile-page-content" style={{ flex: '1 1 auto' }}>
          <div aria-hidden="true">
            <BrewsToolbar
              view="timeline"
              filterMethod="all"
              onViewChange={noop}
              onFilterMethodChange={noop}
              onNewBrew={noop}
              equipment={[]}
              coffees={[]}
              loading
            />
          </div>
          <BrewCardsSkeleton />
        </div>
      </div>
    </div>
  );
}
