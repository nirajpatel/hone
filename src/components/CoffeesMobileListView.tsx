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
        <div key={groupLabel} style={{ marginBottom: 'calc(var(--spacing) * 2)' }}>
          {/* Group Header */}
          <div className="px-3 py-2 text-sm text-gray-600">
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
                    {/* Line 1: Coffee Name and Rating with Count */}
                    <div className="flex items-start gap-2 mb-1">
                      <div 
                        className="text-gray-900 truncate flex-1 min-w-0"
                        style={{ fontWeight: 'var(--font-weight-medium)' }}
                      >
                        {coffee.name}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 whitespace-nowrap">
                        {avgRating > 0 && (
                          <span className="text-lg leading-none">
                            {getRatingEmoji(avgRating)}
                          </span>
                        )}
                        {extractionCount > 0 && (
                          <span className="text-sm text-gray-500">
                            ({extractionCount})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Line 2: Different content based on groupBy */}
                    <div className="flex items-center gap-2 text-sm">
                      {groupBy === 'month' ? (
                        // When grouped by date, show roaster (left) and age (right)
                        <>
                          <div className="text-gray-600 truncate flex-1 min-w-0">
                            {coffee.roaster}
                          </div>
                          <div className="text-gray-500 flex-shrink-0 whitespace-nowrap text-right">
                            {getDaysOld(coffee.roastDate)}
                          </div>
                        </>
                      ) : (
                        // When grouped by roaster, show roast date (left) and age (right)
                        <>
                          <div className="text-gray-600 truncate flex-1 min-w-0">
                            {formatRoastDate(coffee.roastDate)}
                          </div>
                          <div className="text-gray-500 flex-shrink-0 whitespace-nowrap text-right">
                            {getDaysOld(coffee.roastDate)}
                          </div>
                        </>
                      )}
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