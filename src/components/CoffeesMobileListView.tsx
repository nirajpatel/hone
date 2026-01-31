import { Coffee, Extraction } from '../types';
import { getRatingEmoji } from '../utils/formatters';

interface CoffeesMobileListViewProps {
  coffees: Coffee[];
  extractions: Extraction[];
  onSelectCoffee: (coffee: Coffee) => void;
  groupBy?: 'month' | 'coffee';
}

export function CoffeesMobileListView({
  coffees,
  extractions,
  onSelectCoffee,
  groupBy = 'month',
}: CoffeesMobileListViewProps) {
  // Sort coffees by roast date (most recent first)
  const sortedCoffees = [...coffees].sort((a, b) => 
    new Date(b.roastDate).getTime() - new Date(a.roastDate).getTime()
  );

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
        dateLabel = date.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
      }
      
      if (!grouped[dateLabel]) {
        grouped[dateLabel] = [];
      }
      grouped[dateLabel].push(coffee);
    });
  }

  // Get coffee average rating
  const getCoffeeAverageRating = (coffeeId: string): number => {
    const coffeeExtractions = extractions.filter(e => e.coffeeId === coffeeId && e.quality);
    if (coffeeExtractions.length === 0) return 0;
    const sum = coffeeExtractions.reduce((acc, e) => acc + (e.quality || 0), 0);
    return Math.round(sum / coffeeExtractions.length);
  };

  // Get extraction count for a coffee
  const getExtractionCount = (coffeeId: string): number => {
    return extractions.filter(e => e.coffeeId === coffeeId).length;
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

  // Get days old
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
    if (diffDays === 0) return '0 days old';
    if (diffDays === 1) return '1 day old';
    if (diffDays < 7) return `${diffDays} days old`;
    if (diffDays < 14) return '1 week old';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks old`;
    if (diffDays < 60) return '1 month old';
    
    // Calculate years and months for 365+ days
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365);
      const remainingDays = diffDays - (years * 365);
      const months = Math.floor(remainingDays / 30);
      
      if (months === 0) {
        return years === 1 ? '1 year old' : `${years} years old`;
      }
      
      const yearText = years === 1 ? '1 year' : `${years} years`;
      const monthText = months === 1 ? '1 month' : `${months} months`;
      return `${yearText} ${monthText} old`;
    }
    
    return `${Math.floor(diffDays / 30)} months old`;
  };

  return (
    <div className="mobile-list-view -mx-3">
      {Object.entries(grouped).map(([groupLabel, groupCoffees]) => (
        <div key={groupLabel} style={{ marginBottom: 'calc(var(--spacing))' }}>
          {/* Group Header */}
          <div className="px-3 pt-2 pb-1" style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-medium)' }}>
            {groupLabel}
          </div>
          
          {/* Coffee List */}
          <div className="bg-white border-y border-gray-200 overflow-hidden mobile-extraction-card">
            {groupCoffees.map((coffee, index) => {
              const avgRating = getCoffeeAverageRating(coffee.id);
              const extractionCount = getExtractionCount(coffee.id);
              
              return (
                <div key={coffee.id}>
                  <button
                    onClick={() => onSelectCoffee(coffee)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                  >
                    {/* Three-line layout with emoji vertically centered on the right */}
                    <div className="flex items-center gap-3">
                      {/* Left side content - 3 lines */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* Line 1: Roaster – Coffee Name */}
                        <div 
                          className="text-gray-900"
                          style={{ fontWeight: 'var(--font-weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {coffee.roaster} – {coffee.name}
                        </div>
                        
                        {/* Line 2: Roasted date and age */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Roasted {formatRoastDate(coffee.roastDate)} • {getDaysOld(coffee.roastDate)}
                        </div>
                        
                        {/* Line 3: Extraction count */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {extractionCount > 0 
                            ? `${extractionCount} ${extractionCount === 1 ? 'extraction' : 'extractions'}`
                            : 'No extractions'
                          }
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating only (vertically centered) */}
                      <div className="flex-shrink-0 self-center">
                        {avgRating > 0 ? (
                          <span className="text-xl leading-none">
                            {getRatingEmoji(avgRating)}
                          </span>
                        ) : (
                          <span className="text-gray-500" style={{ fontSize: '20px' }}>–</span>
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