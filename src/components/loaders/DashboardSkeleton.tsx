import { AppNavBrand } from '../AppNavBrand';
import { BrewsToolbar } from '../BrewsToolbar';
import { Button } from '../ui/button';
import type { Coffee, Equipment } from '../../types';
import coffeeBeansImage from '../../assets/coffee-beans.webp';

// Draws the brews dashboard with the real nav and toolbar and identical placeholder cards.
// Card spacing and chart height follow BrewsTimelineView so the real cards land in the same place.
const STYLES = `
@keyframes hone-skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
.hone-skel-bar, .hone-skel-chart { animation: hone-skel-pulse 1.6s ease-in-out infinite; }
.hone-skel-bar { background: var(--color-gray-200); border-radius: 4px; max-width: 100%; }
.hone-skel-line { display: flex; align-items: center; }
.hone-skel-cards { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; }
.hone-skel-card { padding: 16px; }
.hone-skel-chart { position: relative; height: 134px; overflow: hidden; }
.hone-skel-block { position: absolute; left: 0; right: 0; top: 0; height: 90px; border-radius: 8px; background: linear-gradient(var(--color-gray-100), transparent); }
.hone-skel-dates { position: absolute; left: 0; right: 0; top: 102px; height: 32px; overflow: hidden; display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); grid-auto-rows: 32px; column-gap: 8px; }
.hone-skel-date { display: flex; flex-direction: column; align-items: center; }
@media (min-width: 768px) {
  .hone-skel-cards { gap: 10px; padding-top: 0; }
  .hone-skel-card { padding: 20px; }
  .hone-skel-chart { height: 164px; }
  .hone-skel-block { height: 120px; }
  .hone-skel-dates { top: 132px; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); column-gap: 32px; }
}
@media (prefers-reduced-motion: reduce) { .hone-skel-bar, .hone-skel-chart { animation: none; } }
`;

const CARD_COUNT = 4;
// More date columns than the widest card holds; the extras wrap to a hidden second row.
const COLUMN_COUNT = 24;

// Enough for the toolbar to show New Brew enabled, as it is for anyone with brews.
const TOOLBAR_EQUIPMENT = [{ type: 'brewer', active: true }, { type: 'grinder', active: true }] as Equipment[];
const TOOLBAR_COFFEES = [{}] as Coffee[];
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
            <div className="hone-skel-line" style={{ height: 16 }}><Bar width={36} height={9} /></div>
            <div className="hone-skel-line" style={{ height: 16 }}><Bar width={44} height={9} /></div>
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
        <TextLine height={16} width={72} barHeight={9} />
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

export function DashboardSkeleton() {
  return (
    <div className="bg-gray-50 flex flex-col" style={{ minHeight: '100dvh' }} aria-busy="true" aria-label="Loading your brews">
      <style>{STYLES}</style>
      <div className="flex flex-col flex-1" style={{ pointerEvents: 'none' }} aria-hidden="true">
        <nav className="bg-white border-b border-gray-200">
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
                  <div className="hone-skel-bar" style={{ width: 32, height: 32, borderRadius: 999 }} />
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="px-3 py-4 md:px-6 md:py-6 flex flex-col flex-1 mobile-page-content" style={{ flex: '1 1 auto' }}>
          <BrewsToolbar
            view="timeline"
            filterMethod="all"
            onViewChange={noop}
            onFilterMethodChange={noop}
            onNewBrew={noop}
            equipment={TOOLBAR_EQUIPMENT}
            coffees={TOOLBAR_COFFEES}
          />
          <div className="hone-skel-cards">
            {Array.from({ length: CARD_COUNT }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
