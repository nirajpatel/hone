import { Coffee, Extraction, Brew } from '../types';
import { getRatingEmoji } from '../utils/formatters';
import { SimpleTooltip } from './ui/simple-tooltip';

interface CoffeesMobileListViewProps {
  coffees: Coffee[];
  brews: Brew[];
  onSelectCoffee: (coffee: Coffee) => void;
  groupBy?: 'month' | 'coffee';
}

export function CoffeesMobileListView({
  coffees,
  brews,
  onSelectCoffee,
  groupBy = 'month',
}: CoffeesMobileListViewProps) {
  // Sort coffees by roast date (most recent first)
  // Coffees without roast dates go to the end
  const sortedCoffees = [...coffees].sort((a, b) => {
    // If both have roast dates, sort normally
    if (a.roastDate && b.roastDate) {
      return new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime();
    }
    // If only a has no roast date, put it after b
    if (!a.roastDate && b.roastDate) return 1;
    // If only b has no roast date, put it after a
    if (a.roastDate && !b.roastDate) return -1;
    // If both have no roast date, maintain order
    return 0;
  });

  // Group coffees by date or roaster
  const grouped: Record<string, Coffee[]> = {};
  
  if (groupBy === 'coffee') {
    // Group by roaster
    sortedCoffees.forEach(coffee => {
      const roasterKey = coffee.roaster;
      if (!grouped[roasterKey]) {
        grouped[roasterKey] = [];
      }
      grouped[roasterKey].push(coffee);
    });
  } else {
    // Group by date (day-level, not month)
    sortedCoffees.forEach(coffee => {
      if (!coffee.roastDate) {
        // Add to Unknown group
        if (!grouped['Unknown']) {
          grouped['Unknown'] = [];
        }
        grouped['Unknown'].push(coffee);
      } else {
        const [year, month, day] = coffee.roastDate.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        
        let dateLabel: string;
        if (checkDate.getTime() === today.getTime()) {
          dateLabel = 'Today';
        } else if (checkDate.getTime() === yesterday.getTime()) {
          dateLabel = 'Yesterday';
        } else {
          const currentYear = new Date().getFullYear();
          const options: Intl.DateTimeFormatOptions = { 
            month: 'long', 
            day: 'numeric'
          };
          if (date.getFullYear() !== currentYear) {
            options.year = 'numeric';
          }
          dateLabel = date.toLocaleDateString('en-US', options);
        }
        
        if (!grouped[dateLabel]) {
          grouped[dateLabel] = [];
        }
        grouped[dateLabel].push(coffee);
      }
    });
  }

  // Get coffee average rating
  const getCoffeeAverageRating = (coffeeId: string): number => {
    const coffeeBrews = brews.filter(e => e.coffeeId === coffeeId && e.quality);
    if (coffeeBrews.length === 0) return 0;
    const sum = coffeeBrews.reduce((acc, e) => acc + (e.quality || 0), 0);
    return Math.round(sum / coffeeBrews.length);
  };

  // Get brew count for a coffee
  const getBrewCount = (coffeeId: string): number => {
    return brews.filter(e => e.coffeeId === coffeeId).length;
  };

  // Format roast date for display
  const formatRoastDate = (roastDate: string) => {
    if (!roastDate) return '—';
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // If today or yesterday
    if (checkDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    // Otherwise show abbreviated date with short month names
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[date.getMonth()];
    const currentYear = new Date().getFullYear();
    
    if (date.getFullYear() !== currentYear) {
      return `${monthName} ${day}, ${year}`;
    }
    
    return `${monthName} ${day}`;
  };

  // Get days old (numeric value)
  const getDaysOldNumeric = (roastDate: string): number => {
    if (!roastDate) return -1;
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    roast.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get freshness status
  const getFreshness = (roastDate: string): { emoji: string; label: string; tooltip: string } => {
    const daysOld = getDaysOldNumeric(roastDate);
    if (daysOld < 0) return { emoji: '–', label: '–', tooltip: '' };
    
    if (daysOld <= 5) {
      return { 
        emoji: '🫧', 
        label: 'Resting',
        tooltip: 'Still releasing CO₂ after roasting\nFlavor will improve in a few days'
      };
    } else if (daysOld <= 21) {
      return { 
        emoji: '🟢', 
        label: 'Peak',
        tooltip: 'Optimal freshness window\nBest balance of aroma and clarity'
      };
    } else if (daysOld <= 35) {
      return { 
        emoji: '🟡', 
        label: 'Fading',
        tooltip: 'Aromas are starting to fade\nStill good, but past its peak'
      };
    } else {
      return { 
        emoji: '⚪️', 
        label: 'Past Peak',
        tooltip: 'Most aromatics have faded\nBest used soon or for milk drinks'
      };
    }
  };

  // Get days old (abbreviated format)
  const getDaysOld = (roastDate: string): string => {
    if (!roastDate) return '—';
    
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    roast.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Don't use Today/Yesterday for age - always show numeric age
    if (diffDays === 0) return '0 days';
    if (diffDays === 1) return '1 day';
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 14) return '1 week';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    if (diffDays < 60) return '1mo';
    
    // Calculate years and months for 365+ days
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365);
      const remainingDays = diffDays - (years * 365);
      const months = Math.floor(remainingDays / 30);
      
      if (months === 0) {
        return years === 1 ? '1yr' : `${years}yr`;
      }
      
      const yearText = years === 1 ? '1yr' : `${years}yr`;
      const monthText = months === 1 ? '1mo' : `${months}mo`;
      return `${yearText} ${monthText}`;
    }
    
    return `${Math.floor(diffDays / 30)}mo`;
  };

  return (
    <div className="mobile-list-view -mx-3">
      {Object.entries(grouped)
        .sort((a, b) => {
          // Put "Unknown" group at the end
          if (a[0] === 'Unknown') return 1;
          if (b[0] === 'Unknown') return -1;
          
          // For month grouping, sort by roast date descending (most recent first)
          if (groupBy === 'month') {
            // Handle special labels (Today/Yesterday) - they should come first
            if (a[0] === 'Today') return -1;
            if (b[0] === 'Today') return 1;
            if (a[0] === 'Yesterday') {
              if (b[0] === 'Today') return 1;
              return -1;
            }
            if (b[0] === 'Yesterday') return 1;
            
            // For date strings, parse and sort descending
            // Find the latest roast date in each group
            const getLatestRoastDate = (coffees: Coffee[]): number => {
              const dates = coffees
                .map(c => c.roastDate)
                .filter((d): d is string => !!d)
                .map(d => {
                  const [year, month, day] = d.split('-').map(Number);
                  return new Date(year, month - 1, day).getTime();
                });
              return dates.length > 0 ? Math.max(...dates) : 0;
            };
            
            const dateA = getLatestRoastDate(a[1]);
            const dateB = getLatestRoastDate(b[1]);
            return dateB - dateA; // Descending (most recent first)
          }
          
          // For roaster grouping, sort by latest roast date in that roaster group
          if (groupBy === 'coffee') {
            const getLatestRoastDate = (coffees: Coffee[]): number => {
              const dates = coffees
                .map(c => c.roastDate)
                .filter((d): d is string => !!d)
                .map(d => {
                  const [year, month, day] = d.split('-').map(Number);
                  return new Date(year, month - 1, day).getTime();
                });
              return dates.length > 0 ? Math.max(...dates) : 0;
            };
            
            const dateA = getLatestRoastDate(a[1]);
            const dateB = getLatestRoastDate(b[1]);
            return dateB - dateA; // Descending (most recent first)
          }
          
          return 0;
        })
        .map(([groupLabel, groupCoffees]) => (
        <div key={groupLabel}>
          {/* Group Header */}
          <div className="px-3 pt-2 pb-1.25" style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-medium)' }}>
            {groupLabel}
          </div>
          
          {/* Coffee List */}
          <div className="bg-white border-y border-gray-200 overflow-hidden mobile-brew-card">
            {groupCoffees.map((coffee, index) => {
              const avgRating = getCoffeeAverageRating(coffee.id);
              const brewCount = getBrewCount(coffee.id);
              
              return (
                <div key={coffee.id}>
                  <button
                    onClick={() => onSelectCoffee(coffee)}
                    className="w-full text-left px-3 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {/* Three-line layout with emoji vertically centered on the right */}
                    <div className="flex items-center gap-3">
                      {/* Left side content - 3 lines */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* Line 1: Roaster – Coffee Name */}
                        <div 
                          className="text-gray-900 truncate"
                          style={{ fontWeight: 'var(--font-weight-medium)' }}
                        >
                          {coffee.roaster} – {coffee.name}
                        </div>
                        
                        {/* Line 2: Roasted date, freshness, and age */}
                        <div className="text-sm text-gray-500 truncate">
                          {!coffee.roastDate ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <>
                              Roasted {formatRoastDate(coffee.roastDate)} • {(() => {
                                const freshness = getFreshness(coffee.roastDate);
                                return freshness.tooltip ? (
                                  <SimpleTooltip content={
                                    <div className="text-xs">
                                      {freshness.tooltip.split('\n').map((line, index) => (
                                        <div key={index}>{line}</div>
                                      ))}
                                    </div>
                                  }>
                                    <span className="inline-flex items-center gap-1 cursor-help">
                                      <span>{freshness.emoji}</span>
                                      <span>{freshness.label}</span>
                                    </span>
                                  </SimpleTooltip>
                                ) : (
                                  <span>{freshness.emoji} {freshness.label}</span>
                                );
                              })()} • {getDaysOld(coffee.roastDate)}
                            </>
                          )}
                        </div>
                        
                        {/* Line 3: Brew count */}
                        <div className="text-sm text-gray-500 truncate">
                          {brewCount > 0 
                            ? `${brewCount} ${brewCount === 1 ? 'brew' : 'brews'}`
                            : 'No brews'
                          }
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating only (vertically centered) */}
                      <div className="flex-shrink-0 self-center flex items-center justify-center w-6">
                        {avgRating > 0 ? (
                          <span className="text-xl leading-none block text-center">
                            {getRatingEmoji(avgRating)}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xl leading-none block text-center">–</span>
                        )}
                      </div>
                    </div>
                  </button>
                  
                  {/* Separator line (except for last item) */}
                  {index < groupCoffees.length - 1 && (
                    <div className="border-b border-gray-200" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {coffees.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">No coffees found</p>
        </div>
      )}
    </div>
  );
}