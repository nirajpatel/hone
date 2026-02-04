import { Extraction, Coffee, BrewMethod } from '../types';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, ChevronLeft, ChevronRight, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { getRatingEmoji, getRatingText } from '../utils/formatters';
import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import VanillaTilt from 'vanilla-tilt';
import { SimpleTooltip } from './ui/simple-tooltip';
import { DelayedHelpTooltip } from './ui/delayed-help-tooltip';

interface CoffeesShelvesViewProps {
  coffees: Coffee[];
  brews: Brew[];
  groupBy: 'month' | 'coffee';
  onGroupByChange: (groupBy: 'month' | 'coffee') => void;
  onNewCoffee: () => void;
  view?: 'shelf' | 'table';
  onViewChange?: (view: 'shelf' | 'table') => void;
}

export function CoffeesShelvesView({
  coffees,
  brews,
  groupBy,
  onGroupByChange,
  onNewCoffee,
  view,
  onViewChange,
}: CoffeesShelvesViewProps) {
  const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-23508aac`;
  
  // State for representative images
  const [representativeImages, setRepresentativeImages] = useState<Map<string, string>>(new Map());
  const [loadingImages, setLoadingImages] = useState(true);
  
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
      setLoadingImages(true);
      const imageMap = new Map<string, string>();
      
      // Get unique coffee combinations
      const uniqueCoffees = new Map<string, Coffee>();
      coffees.forEach(coffee => {
        const key = `${coffee.roaster}|${coffee.name}`;
        if (!uniqueCoffees.has(key)) {
          uniqueCoffees.set(key, coffee);
        }
      });

      // Fetch images for each unique coffee with rate limiting
      const coffeeArray = Array.from(uniqueCoffees.values());
      
      // Process in batches of 5 to avoid overwhelming the server
      const batchSize = 5;
      for (let i = 0; i < coffeeArray.length; i += batchSize) {
        if (abortController.signal.aborted) break;
        
        const batch = coffeeArray.slice(i, i + batchSize);
        const promises = batch.map(async (coffee) => {
          try {
            // Create abort controller with timeout for individual request
            const requestAbortController = new AbortController();
            const timeoutId = setTimeout(() => requestAbortController.abort(), 5000); // 5 second timeout
            
            const res = await fetch(
              `${apiUrl}/coffee-representative-image?roaster=${encodeURIComponent(coffee.roaster)}&coffeeName=${encodeURIComponent(coffee.name)}`,
              {
                headers: {
                  Authorization: `Bearer ${publicAnonKey}`,
                },
                signal: requestAbortController.signal,
              }
            );
            
            clearTimeout(timeoutId);
            
            if (res.ok) {
              const data = await res.json();
              if (data.imageUrl) {
                const key = `${coffee.roaster}|${coffee.name}`;
                imageMap.set(key, data.imageUrl);
              }
            }
          } catch (error) {
            // Ignore abort errors and network errors - just skip this image
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error('Error fetching representative image:', error);
            }
          }
        });

        await Promise.all(promises);
      }

      if (!abortController.signal.aborted) {
        setRepresentativeImages(imageMap);
        setLoadingImages(false);
      }
    };

    if (coffees.length > 0) {
      fetchRepresentativeImages();
    }

    return () => {
      abortController.abort();
    };
  }, [coffees, apiUrl]);

  // Get the best image for a coffee (representative > uploaded > null)
  const getCoffeeImage = (coffee: Coffee): string | null => {
    const key = `${coffee.roaster}|${coffee.name}`;
    const representativeImage = representativeImages.get(key);
    
    if (representativeImage) {
      return representativeImage;
    }
    
    if (coffee.imageUrls && coffee.imageUrls.length > 0) {
      return coffee.imageUrls[0];
    }
    
    return null;
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

  // Render emoji rating
  const renderRating = (rating: number) => {
    if (rating === 0) return <span className="text-sm text-gray-400">Not rated</span>;
    
    const roundedRating = Math.round(rating);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{getRatingEmoji(roundedRating)}</span>
        <span className="text-sm text-gray-900">{getRatingText(roundedRating)}</span>
      </div>
    );
  };

  // Format roast date
  const formatRoastDate = (roastDate: string): string => {
    if (!roastDate) return '—';
    const [year, monthNum, day] = roastDate.split('-').map(Number);
    const date = new Date(year, monthNum - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    return `${month} ${day}, ${year}`;
  };

  // Calculate coffee age
  const getCoffeeAge = (roastDate: string): string => {
    if (!roastDate) return '—';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // < 1 month: show days
    if (diffDays < 30) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }
    
    // < 1 year: show months
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    
    // >= 1 year: show years
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  };

  // Group coffees
  type GroupedData = Record<string, Coffee[]>;
  const groupedCoffees: GroupedData = {};

  if (groupBy === 'month') {
    // Group by roast month/year - each bag gets its own card
    coffees.forEach(coffee => {
      const [year, monthNum] = coffee.roastDate.split('-').map(Number);
      const date = new Date(year, monthNum - 1);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  const sortedGroups = Object.entries(groupedCoffees).sort((a, b) => {
    if (groupBy === 'month') {
      // Sort by date descending (most recent first)
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateB.getTime() - dateA.getTime();
    } else {
      // Sort by roaster name alphabetically
      return a[0].localeCompare(b[0]);
    }
  });

  // Component for individual coffee card with tilt effect
  const CoffeeCard = ({ coffee, rating }: { coffee: Coffee; rating: number }) => {
    const tiltRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      if (tiltRef.current) {
        VanillaTilt.init(tiltRef.current, {
          max: 15,
          speed: 400,
          glare: true,
          'max-glare': 0.3,
          scale: 1.02,
        });
      }

      return () => {
        if (tiltRef.current && (tiltRef.current as any).vanillaTilt) {
          (tiltRef.current as any).vanillaTilt.destroy();
        }
      };
    }, []);

    return (
      <div
        className="flex-shrink-0 flex flex-col md:flex-row rounded-lg overflow-hidden hover:shadow-md transition-shadow"
        style={{ 
          // All cards have consistent width on desktop for uniform appearance
          // Width allows exactly 3.5 cards to be visible in the viewport
          width: isDesktop ? '456px' : '256px',
          // Explicitly set background and border to override global mobile styles
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.5rem',
        }}
      >
        {/* Coffee Image Container with Background */}
        <div
          className="aspect-[2/3] md:aspect-auto md:w-56 md:h-64 md:flex-shrink-0 overflow-hidden flex items-center justify-center"
          style={{ 
            backgroundColor: '#FFFFFF'
          }}
        >
          {/* Tiltable Coffee Bag Image - only render if image exists */}
          {getCoffeeImage(coffee) && (
            <img
              ref={tiltRef}
              src={getCoffeeImage(coffee)!}
              alt={`${coffee.roaster} - ${coffee.name}`}
              className="w-full h-full object-contain"
              style={{ transformStyle: 'preserve-3d' }}
            />
          )}
        </div>

        {/* Coffee Details */}
        <div className="p-4 space-y-2 md:flex-1 md:flex md:flex-col md:justify-between">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {coffee.roaster}
              </p>
              <h4 className="text-base font-semibold text-gray-900 mt-1 line-clamp-2">
                {coffee.name}
              </h4>
            </div>

            {coffee.region && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Region:</span> {coffee.region}
              </p>
            )}

            {coffee.notes && (
              <p className="text-sm text-gray-600 line-clamp-2">
                <span className="font-medium">Notes:</span> {coffee.notes}
              </p>
            )}

            <p className="text-sm text-gray-600">
              {!coffee.roastDate ? (
                <span className="text-gray-400">—</span>
              ) : (
                <>
                  <span className="font-medium">Roasted:</span> {formatRoastDate(coffee.roastDate)} • {getCoffeeAge(coffee.roastDate)}
                </>
              )}
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Rating</span>
              {renderRating(rating)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Component for scrollable shelf with navigation arrows
  const ScrollableShelf = ({ groupName, coffeesInGroup }: { groupName: string; coffeesInGroup: Coffee[] }) => {
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
        const cardWidth = 320 + 16; // card width (80 * 4px) + gap
        const scrollAmount = cardWidth * 3; // Scroll by 3 cards
        const newScrollLeft = direction === 'left' 
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;
        
        scrollContainerRef.current.scrollTo({
          left: newScrollLeft,
          behavior: 'smooth'
        });
      }
    };

    return (
      <div className="space-y-3">
        {/* Shelf Header */}
        <h3 className="text-lg font-semibold text-gray-900 sticky left-0">
          {groupName}
        </h3>

        {/* Scrollable Container with Navigation */}
        <div className="relative group">
          {/* Left Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white/95 hover:bg-white border border-gray-200 rounded-full shadow-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Right Arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white/95 hover:bg-white border border-gray-200 rounded-full shadow-lg cursor-pointer transition-all opacity-0 group-hover:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Cards Container */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex flex-row gap-4 pb-2" style={{ minWidth: 'min-content' }}>
              {coffeesInGroup.map((coffee) => {
                const rating = groupBy === 'month' 
                  ? getCoffeeBagRating(coffee.id)
                  : getAggregatedCoffeeRating(coffee.roaster, coffee.name);

                return (
                  <CoffeeCard key={coffee.id} coffee={coffee} rating={rating} />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 desktop-filters">
          {/* View Toggle Buttons */}
          {onViewChange && (
            <div className="flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5 flex-none">
              <DelayedHelpTooltip content="Table">
                <Button
                  variant={view === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewChange('table')}
                  className="cursor-pointer h-8 px-2"
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
              </DelayedHelpTooltip>
              <DelayedHelpTooltip content="Shelf">
                <Button
                  variant={view === 'shelf' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewChange('shelf')}
                  className="cursor-pointer h-8 px-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </DelayedHelpTooltip>
            </div>
          )}
          
          <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as 'month' | 'coffee')}>
            <SelectTrigger className="w-[180px] cursor-default text-sm">
              <SelectValue placeholder="By Roast Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">By Roast Month</SelectItem>
              <SelectItem value="coffee">By Roaster</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Mobile Header */}
        <h2 className="mobile-section-header">
          Previous Coffees
        </h2>
        
        <Button onClick={onNewCoffee} className="cursor-pointer mobile-add-button">
          <Plus className="w-4 h-4" />
          Add Coffee
        </Button>
      </div>

      {/* Shelves */}
      <div className="space-y-8">
        {sortedGroups.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Coffees Yet</h3>
              <p className="text-sm text-gray-600">
                Get started by adding your first coffee
              </p>
            </div>
          </div>
        ) : (
          sortedGroups.map(([groupName, coffeesInGroup]) => (
            <ScrollableShelf key={groupName} groupName={groupName} coffeesInGroup={coffeesInGroup} />
          ))
        )}
      </div>
    </div>
  );
}