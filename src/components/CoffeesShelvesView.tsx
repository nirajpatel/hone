import { Coffee, Brew } from '../types';
import { Button } from './ui/button';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { getRatingEmoji, getRatingText } from '../utils/formatters';
import { toTitleCase } from '../utils/tastingNotes';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import VanillaTilt from 'vanilla-tilt';
import { SimpleTooltip } from './ui/simple-tooltip';
import { DelayedHelpTooltip } from './ui/delayed-help-tooltip';

// Module-level caches — survive component unmount/remount during navigation
const _repImageCache = new Map<string, string>(); // key -> url ('' means confirmed no image)
let _defaultImageCache: string | null | '__loading__' = null;

/** Shows as many full tasting notes as fit in one line, then "+n" with tooltip; measures to avoid mid-word truncation */
function TastingNotesLine({ notes }: { notes: string[] }) {
  const titled = notes.map(n => toTitleCase(n));
  const [visibleCount, setVisibleCount] = useState(() => Math.min(2, notes.length));
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    setVisibleCount(Math.min(2, notes.length));
  }, [notes.length, notes.join(',')]);

  useLayoutEffect(() => {
    const text = textRef.current;
    const container = containerRef.current;
    if (!text || !container || visibleCount <= 0) return;
    if (text.scrollWidth > container.clientWidth) {
      setVisibleCount(c => (c > 0 ? c - 1 : 0));
    }
  }, [notes.length, visibleCount]);

  const hiddenCount = notes.length - visibleCount;
  const visiblePart = hiddenCount > 0
    ? `${titled.slice(0, visibleCount).join(', ')} +${hiddenCount}`
    : titled.join(', ');
  const notesText = titled.join(', ');
  const showTooltip = hiddenCount > 0;

  if (notes.length === 0) {
    return (
      <p className="text-sm text-gray-500 m-0 leading-5 min-w-0">
        No tasting notes
      </p>
    );
  }
  if (visibleCount === 0) {
    return (
      <p className="text-sm text-gray-500 m-0 leading-5 min-w-0 overflow-hidden">
        <SimpleTooltip content={notesText}>
          <span className="cursor-pointer">+{notes.length}</span>
        </SimpleTooltip>
      </p>
    );
  }
  return (
    <p ref={containerRef} className="text-sm text-gray-500 m-0 leading-5 min-w-0 overflow-hidden">
      {showTooltip ? (
        <SimpleTooltip content={notesText}>
          <span ref={textRef} className="cursor-pointer whitespace-nowrap inline-block">
            {visiblePart}
          </span>
        </SimpleTooltip>
      ) : (
        <span ref={textRef} className="whitespace-nowrap inline-block">
          {visiblePart}
        </span>
      )}
    </p>
  );
}

// ─── Pure helpers (no component state) ────────────────────────────────────────

function getDaysOldNumeric(roastDate: string): number {
  if (!roastDate) return -1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = roastDate.split('-').map(Number);
  const roast = new Date(year, month - 1, day);
  const diffTime = Math.abs(today.getTime() - roast.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getFreshness(roastDate: string): { emoji: string; label: string; tooltip: string } {
  const daysOld = getDaysOldNumeric(roastDate);
  if (daysOld < 0) return { emoji: '–', label: '–', tooltip: '' };
  if (daysOld <= 5) return { emoji: '🫧', label: 'Resting', tooltip: 'Still releasing CO₂ after roasting\nFlavor will improve in a few days' };
  if (daysOld <= 21) return { emoji: '🟢', label: 'Peak', tooltip: 'Optimal freshness window\nBest balance of aroma and clarity' };
  if (daysOld <= 35) return { emoji: '🟡', label: 'Fading', tooltip: 'Aromas are starting to fade\nStill good, but past its peak' };
  return { emoji: '⚪️', label: 'Past Peak', tooltip: 'Most aromatics have faded\nBest used soon or for milk drinks' };
}

function getCoffeeAge(roastDate: string): string {
  if (!roastDate) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = roastDate.split('-').map(Number);
  const roast = new Date(year, month - 1, day);
  const diffTime = Math.abs(today.getTime() - roast.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function renderRating(rating: number) {
  if (rating === 0) return <span className="text-sm text-gray-500 leading-5">Not rated</span>;
  const roundedRating = Math.round(rating);
  return (
    <div className="flex items-center gap-1" style={{ height: '1.25rem' }}>
      <span className="text-lg flex-shrink-0">{getRatingEmoji(roundedRating)}</span>
      <span className="text-sm text-gray-500">{getRatingText(roundedRating)}</span>
    </div>
  );
}

// ─── CoffeeCard ────────────────────────────────────────────────────────────────

interface CoffeeCardProps {
  coffee: Coffee;
  rating: number;
  onClick?: () => void;
  roastLabel?: string;
  isDesktop: boolean;
  getCoffeeImage: (coffee: Coffee) => string | null;
}

function CoffeeCard({ coffee, rating, onClick, roastLabel = 'Roasted', isDesktop, getCoffeeImage }: CoffeeCardProps) {
  const tiltRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgSrc = getCoffeeImage(coffee);

  useEffect(() => {
    if (!imgSrc || !tiltRef.current) return;
    VanillaTilt.init(tiltRef.current, {
      max: 8,
      speed: 800,
      easing: 'cubic-bezier(.03,.98,.52,.99)',
      perspective: 800,
      glare: true,
      'max-glare': 0.15,
      scale: 1.02,
      gyroscope: true,
    });
    const node = tiltRef.current;
    return () => {
      if ((node as any).vanillaTilt) {
        (node as any).vanillaTilt.destroy();
      }
    };
  }, [imgSrc]);

  const freshness = coffee.roastDate ? getFreshness(coffee.roastDate) : null;

  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 flex flex-col rounded-lg overflow-hidden${onClick ? ' cursor-pointer' : ''}`}
      style={{
        width: isDesktop ? '26em' : '14em',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        flexDirection: isDesktop ? 'row' : 'column',
        padding: isDesktop ? '0rem' : undefined,
        paddingTop: isDesktop ? undefined : '1em',
      }}
    >
      {/* Image area */}
      <div
        className="flex-shrink-0 overflow-hidden flex items-center justify-center relative"
        style={{
          backgroundColor: '#FFFFFF',
          paddingTop: isDesktop ? undefined : '1em',
          padding: isDesktop ? '0.75rem' : undefined,
          width: isDesktop ? '179px' : '100%',
          height: isDesktop ? '208px' : '200px',
          boxSizing: 'border-box',
        }}
      >
        {!imgLoaded && (
          <div
            className="absolute inset-0 rounded-sm overflow-hidden"
            style={{ margin: isDesktop ? '0.75rem' : '1em 1em 0' }}
          >
            <div className="w-full h-full animate-shimmer rounded-sm" />
          </div>
        )}
        {imgSrc && (
          isDesktop ? (
            <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img
                ref={tiltRef}
                src={imgSrc}
                alt={`${coffee.roaster} - ${coffee.name}`}
                className="w-full h-full"
                style={{
                  transformStyle: 'preserve-3d',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  opacity: imgLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}
                onLoad={() => setImgLoaded(true)}
              />
            </div>
          ) : (
            <img
              ref={tiltRef}
              src={imgSrc}
              alt={`${coffee.roaster} - ${coffee.name}`}
              className="w-full h-full object-contain"
              style={{
                transformStyle: 'preserve-3d',
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
              onLoad={() => setImgLoaded(true)}
            />
          )
        )}
      </div>

      {/* Details */}
      <div
        className="p-4 space-y-2 min-w-0"
        style={isDesktop ? { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '1.5em', paddingBottom: '1.5em', paddingLeft: 0, paddingRight: '0.75rem' } : undefined}
      >
        <div className="space-y-2 min-w-0">
          <div className="min-w-0 overflow-hidden">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
              {coffee.roaster}
            </p>
            <h4 className="text-base font-semibold text-gray-900 mt-0.5 truncate">
              {coffee.name}
            </h4>
          </div>

          <div className="space-y-2">
            <TastingNotesLine
              key={coffee.id}
              notes={coffee.notes ? coffee.notes.split(',').map(n => n.trim()).filter(Boolean) : []}
            />

            <p className="text-sm text-gray-500 m-0 leading-5">
              {!coffee.roastDate ? (
                <span className="text-gray-500">—</span>
              ) : freshness && freshness.tooltip ? (
                <SimpleTooltip content={<div className="text-xs">{freshness.tooltip.split('\n').map((line, i) => <div key={i}>{line}</div>)}</div>}>
                  <span className="cursor-help">
                    <span>{freshness.emoji}</span> {freshness.label} • {getCoffeeAge(coffee.roastDate)}
                  </span>
                </SimpleTooltip>
              ) : freshness ? (
                <><span>{freshness.emoji}</span> {freshness.label} • {getCoffeeAge(coffee.roastDate)}</>
              ) : null}
            </p>

            <div style={{ height: '1.25rem' }}>{renderRating(rating)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ScrollableShelf ───────────────────────────────────────────────────────────

interface ScrollableShelfProps {
  groupName: string;
  coffeesInGroup: Coffee[];
  groupBy: 'month' | 'coffee';
  allCoffees: Coffee[];
  isDesktop: boolean;
  getCoffeeImage: (coffee: Coffee) => string | null;
  getCoffeeBagRating: (coffeeId: string) => number;
  getAggregatedCoffeeRating: (roaster: string, coffeeName: string) => number;
  onSelectCoffee?: (coffee: Coffee, siblings?: Coffee[]) => void;
}

function ScrollableShelf({
  groupName,
  coffeesInGroup,
  groupBy,
  allCoffees,
  isDesktop,
  getCoffeeImage,
  getCoffeeBagRating,
  getAggregatedCoffeeRating,
  onSelectCoffee,
}: ScrollableShelfProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScrollability();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);
      return () => {
        container.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [coffeesInGroup]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const cardWidth = 320 + 16;
      const scrollAmount = cardWidth * 3;
      const newScrollLeft = direction === 'left'
        ? scrollContainerRef.current.scrollLeft - scrollAmount
        : scrollContainerRef.current.scrollLeft + scrollAmount;
      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm text-gray-900 sticky left-0" style={{ fontWeight: 'var(--font-weight-medium)' }}>
        {groupName}
      </h3>
      <div className="relative group">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white/95 hover:bg-white border border-gray-200 rounded-full shadow-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white/95 hover:bg-white border border-gray-200 rounded-full shadow-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto shelf-scroll-bleed scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex flex-row gap-4 pb-2 shelf-scroll-inner" style={{ minWidth: 'min-content' }}>
            {coffeesInGroup.map((coffee) => {
              const rating = groupBy === 'month'
                ? getCoffeeBagRating(coffee.id)
                : getAggregatedCoffeeRating(coffee.roaster, coffee.name);

              const handleClick = onSelectCoffee
                ? () => {
                    if (groupBy === 'coffee') {
                      const siblings = allCoffees
                        .filter(c => c.roaster === coffee.roaster && c.name === coffee.name)
                        .sort((a, b) => b.roastDate.localeCompare(a.roastDate));
                      onSelectCoffee(coffee, siblings);
                    } else {
                      onSelectCoffee(coffee);
                    }
                  }
                : undefined;

              return (
                <CoffeeCard
                  key={coffee.id}
                  coffee={coffee}
                  rating={rating}
                  onClick={handleClick}
                  roastLabel={groupBy === 'coffee' ? 'Latest Roast' : 'Roasted'}
                  isDesktop={isDesktop}
                  getCoffeeImage={getCoffeeImage}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface CoffeesShelvesViewProps {
  coffees: Coffee[];
  brews: Brew[];
  groupBy: 'month' | 'coffee';
  onNewCoffee: () => void;
  onSelectCoffee?: (coffee: Coffee, siblings?: Coffee[]) => void;
}

export function CoffeesShelvesView({
  coffees,
  brews,
  groupBy,
  onNewCoffee,
  onSelectCoffee,
}: CoffeesShelvesViewProps) {
  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
  
  // State for representative images — initialised from module-level cache so navigation doesn't re-fetch
  const [representativeImages, setRepresentativeImages] = useState<Map<string, string>>(() => new Map(_repImageCache));
  const [loadingImages, setLoadingImages] = useState(true);
  const [defaultImage, setDefaultImage] = useState<string | null>(
    typeof _defaultImageCache === 'string' && _defaultImageCache !== '__loading__' ? _defaultImageCache : null
  );
  
  // State for window width to calculate card sizes
  const [isDesktop, setIsDesktop] = useState(false);

  // Track window size for responsive card widths
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Fetch representative images for all unique coffees
  useEffect(() => {
    const abortController = new AbortController();

    const fetchRepresentativeImages = async () => {
      const norm = (s: string) => s.trim().toLowerCase();

      // Get unique coffee combinations that are NOT yet cached
      const uniqueCoffees = new Map<string, Coffee>();
      coffees.forEach(coffee => {
        const key = `${norm(coffee.roaster)}|${norm(coffee.name)}`;
        if (!uniqueCoffees.has(key) && !_repImageCache.has(key)) {
          uniqueCoffees.set(key, coffee);
        }
      });

      const coffeeArray = Array.from(uniqueCoffees.values());

      if (coffeeArray.length === 0 && _defaultImageCache !== null && _defaultImageCache !== '__loading__') {
        // Everything already cached — nothing to fetch
        setLoadingImages(false);
        return;
      }

      setLoadingImages(true);

      // Process in batches of 5 to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < coffeeArray.length; i += batchSize) {
        if (abortController.signal.aborted) break;

        const batch = coffeeArray.slice(i, i + batchSize);
        const promises = batch.map(async (coffee) => {
          try {
            const requestAbortController = new AbortController();
            const timeoutId = setTimeout(() => requestAbortController.abort(), 5000);

            const normRoaster = coffee.roaster.trim().toLowerCase();
            const normName = coffee.name.trim().toLowerCase();
            const res = await fetch(
              `${apiUrl}/coffee-representative-image?roaster=${encodeURIComponent(normRoaster)}&coffeeName=${encodeURIComponent(normName)}`,
              {
                headers: { Authorization: `Bearer ${publicAnonKey}` },
                signal: requestAbortController.signal,
              }
            );

            clearTimeout(timeoutId);

            const key = `${normRoaster}|${normName}`;
            if (res.ok) {
              const data = await res.json();
              // Store url if found, empty string as "confirmed missing" sentinel
              _repImageCache.set(key, data.imageUrl ?? '');
            } else {
              _repImageCache.set(key, '');
            }
          } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error('Error fetching representative image:', error);
            }
          }
        });

        await Promise.all(promises);

        // Update state incrementally so cards appear as each batch resolves
        if (!abortController.signal.aborted) {
          setRepresentativeImages(new Map(_repImageCache));
        }
      }

      // Fetch the default fallback image (only once ever)
      if (_defaultImageCache === null && !abortController.signal.aborted) {
        _defaultImageCache = '__loading__';
        try {
          const defaultRes = await fetch(
            `${apiUrl}/coffee-representative-image?roaster=__default__&coffeeName=__default__`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );
          if (defaultRes.ok) {
            const data = await defaultRes.json();
            _defaultImageCache = data.imageUrl ?? null;
          } else {
            _defaultImageCache = null;
          }
        } catch {
          _defaultImageCache = null;
        }
        if (!abortController.signal.aborted) {
          setDefaultImage(typeof _defaultImageCache === 'string' ? _defaultImageCache : null);
        }
      }

      if (!abortController.signal.aborted) {
        setRepresentativeImages(new Map(_repImageCache));
        setLoadingImages(false);
      }
    };

    if (coffees.length > 0) {
      fetchRepresentativeImages();
    } else {
      setLoadingImages(false);
    }

    return () => {
      abortController.abort();
    };
  }, [coffees, apiUrl]);

  // Get the best image for a coffee.
  // Returns null when still loading (caller should show shimmer instead of fallback).
  const getCoffeeImage = (coffee: Coffee): string | null => {
    const key = `${coffee.roaster.trim().toLowerCase()}|${coffee.name.trim().toLowerCase()}`;
    const representativeImage = representativeImages.get(key);

    // Non-empty string = confirmed URL
    if (representativeImage) return representativeImage;

    // Key not yet in cache = fetch still in flight → return null (show shimmer)
    if (!representativeImages.has(key)) return null;

    // Key present but empty string = confirmed no rep image; only show default fallback
    // Only show the default fallback when we are done loading (avoid fallback→repImage flash)
    return loadingImages ? null : defaultImage;
  };

  // Get coffee average rating for a specific coffee bag (by coffeeId)
  const getCoffeeBagRating = (coffeeId: string): number => {
    const coffeeBrews = brews.filter(e => e.coffeeId === coffeeId && e.quality);
    if (coffeeBrews.length === 0) return 0;
    const sum = coffeeBrews.reduce((acc, e) => acc + (e.quality || 0), 0);
    return sum / coffeeBrews.length;
  };

  // Get average rating across all bags of the same coffee (by roaster + name)
  const getAggregatedCoffeeRating = (roaster: string, coffeeName: string): number => {
    const relatedCoffees = coffees.filter(c => c.roaster === roaster && c.name === coffeeName);
    const coffeeIds = relatedCoffees.map(c => c.id);
    const relevantExtractions = brews.filter(e => coffeeIds.includes(e.coffeeId) && e.quality);
    if (relevantExtractions.length === 0) return 0;
    const sum = relevantExtractions.reduce((acc, e) => acc + (e.quality || 0), 0);
    return sum / relevantExtractions.length;
  };

  // Format roast date
  const formatRoastDate = (roastDate: string): string => {
    if (!roastDate) return '—';
    const [year, monthNum, day] = roastDate.split('-').map(Number);
    const date = new Date(year, monthNum - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const currentYear = new Date().getFullYear();
    return year === currentYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
  };

  // Group coffees
  type GroupedData = Record<string, Coffee[]>;
  const groupedCoffees: GroupedData = {};

  if (groupBy === 'month') {
    // Group by roast month/year - each bag gets its own card
    coffees.forEach(coffee => {
      const [year, monthNum] = coffee.roastDate.split('-').map(Number);
      const date = new Date(year, monthNum - 1);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const month = months[date.getMonth()];
      const monthYear = `${month} ${date.getFullYear()}`;
      if (!groupedCoffees[monthYear]) {
        groupedCoffees[monthYear] = [];
      }
      groupedCoffees[monthYear].push(coffee);
    });
  } else {
    // Group by roaster - unique coffees only
    const uniqueCoffeeMap = new Map<string, Coffee>();
    
    coffees.forEach(coffee => {
      const key = `${coffee.roaster}|${coffee.name}`;
      const existing = uniqueCoffeeMap.get(key);
      
      // Keep the most recent roast date
      if (!existing || coffee.roastDate > existing.roastDate) {
        uniqueCoffeeMap.set(key, coffee);
      }
    });

    // Group by roaster
    uniqueCoffeeMap.forEach(coffee => {
      const roaster = coffee.roaster;
      if (!groupedCoffees[roaster]) {
        groupedCoffees[roaster] = [];
      }
      groupedCoffees[roaster].push(coffee);
    });
  }

  // Sort groups
  const monthNameToIndex: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };
  const sortedGroups = Object.entries(groupedCoffees).sort((a, b) => {
    if (groupBy === 'month') {
      // Sort by (year, month) descending (most recent first). Parse "Month YYYY" explicitly for reliable cross-browser sort.
      const parseMonthYear = (s: string) => {
        const parts = s.split(' ');
        const year = parseInt(parts[parts.length - 1], 10);
        const monthName = parts.slice(0, -1).join(' ');
        const month = monthName in monthNameToIndex ? monthNameToIndex[monthName] : 0;
        return { year, month };
      };
      const pa = parseMonthYear(a[0]);
      const pb = parseMonthYear(b[0]);
      if (pb.year !== pa.year) return pb.year - pa.year;
      return pb.month - pa.month;
    } else {
      // Sort by roaster name alphabetically
      return a[0].localeCompare(b[0]);
    }
  });

  return (
    <div className="space-y-6">
      {/* Shelves */}
      {sortedGroups.length === 0 ? (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex flex-1 items-center justify-center min-h-0">
            <div className="empty-state-card-md bg-white rounded-lg border border-gray-200 p-0 md:p-16 text-center" style={{ marginTop: '-2rem' }}>
              <div className="max-w-lg mx-auto">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No coffees yet</h3>
                <p className="text-base text-gray-600 mb-6">
                  Add your coffee to start logging brews and getting personalized guidance.
                </p>
                <Button onClick={onNewCoffee} className="cursor-pointer">
                  <Plus className="w-4 h-4" />
                  Add Coffee
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedGroups.map(([groupName, coffeesInGroup]) => (
            <ScrollableShelf
                key={groupName}
                groupName={groupName}
                coffeesInGroup={[...coffeesInGroup].sort((a, b) => (b.roastDate ?? '').localeCompare(a.roastDate ?? ''))}
                groupBy={groupBy}
                allCoffees={coffees}
                isDesktop={isDesktop}
                getCoffeeImage={getCoffeeImage}
                getCoffeeBagRating={getCoffeeBagRating}
                getAggregatedCoffeeRating={getAggregatedCoffeeRating}
                onSelectCoffee={onSelectCoffee}
              />
          ))}
        </div>
      )}
    </div>
  );
}