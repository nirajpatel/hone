import { Extraction, BrewMethod } from '../types';
import { capitalizeBrewMethod, getRatingEmoji } from '../utils/formatters';

interface ExtractionsMobileListViewProps {
  extractions: Extraction[];
  onSelectExtraction: (extraction: Extraction) => void;
  groupBy?: 'month' | 'coffee';
}

export function ExtractionsMobileListView({
  extractions,
  onSelectExtraction,
  groupBy = 'month',
}: ExtractionsMobileListViewProps) {
  // Sort extractions by date (most recent first)
  const sortedExtractions = [...extractions].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group extractions by date or coffee
  const grouped: Record<string, Extraction[]> = {};
  
  if (groupBy === 'coffee') {
    // Group by coffee (Roaster – Coffee Name)
    sortedExtractions.forEach(extraction => {
      const coffeeKey = `${extraction.roaster} – ${extraction.coffeeName}`;
      if (!grouped[coffeeKey]) {
        grouped[coffeeKey] = [];
      }
      grouped[coffeeKey].push(extraction);
    });
  } else {
    // Group by date
    sortedExtractions.forEach(extraction => {
      const date = new Date(extraction.createdAt);
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
      grouped[dateLabel].push(extraction);
    });
  }

  // Format time for display (e.g., "9:07am")
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes}${ampm}`;
  };

  // Format date for display when grouped by coffee (e.g., "Jan 30" or "9:07am" for today)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // If today, just show time
    if (checkDate.getTime() === today.getTime()) {
      return formatTime(dateString);
    }
    
    // Otherwise show abbreviated date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Format recipe information (e.g., "18g → 38g • 0:28")
  const formatRecipe = (extraction: Extraction) => {
    const parts = [];
    
    // Add dose in → dose out
    if (extraction.dosage !== undefined && extraction.finalWeight !== undefined) {
      parts.push(`${extraction.dosage}g → ${extraction.finalWeight}g`);
    }
    
    // Add extraction time
    if (extraction.extractionTime !== undefined) {
      const minutes = Math.floor(extraction.extractionTime / 60);
      const seconds = extraction.extractionTime % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      parts.push(timeStr);
    }
    
    return parts.length > 0 ? ` • ${parts.join(' • ')}` : '';
  };

  return (
    <div className="mobile-list-view -mx-3">
      {Object.entries(grouped).map(([groupLabel, groupExtractions]) => (
        <div key={groupLabel} style={{ marginBottom: 'calc(var(--spacing))' }}>
          {/* Group Header */}
          <div className="px-3 py-2 text-sm text-gray-600">
            {groupLabel}
          </div>
          
          {/* Extraction List */}
          <div className="bg-white border-y border-gray-200 overflow-hidden mobile-extraction-card">
            {groupExtractions.map((extraction, index) => (
              <div key={extraction.id}>
                <button
                  onClick={() => onSelectExtraction(extraction)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                >
                  {groupBy === 'coffee' ? (
                    // When grouped by coffee: Show brew method on line 1, date/time and quality on line 2
                    <>
                      {/* Line 1: Brew Method and Recipe */}
                      <div className="flex items-start gap-2 mb-1">
                        <div 
                          className="text-gray-900 truncate flex-1 min-w-0"
                          style={{ fontWeight: 'var(--font-weight-medium)' }}
                        >
                          {capitalizeBrewMethod(extraction.brewMethod)}{formatRecipe(extraction)}
                        </div>
                        {extraction.quality && (
                          <div className="text-lg leading-none flex-shrink-0 whitespace-nowrap">
                            {getRatingEmoji(extraction.quality)}
                          </div>
                        )}
                      </div>
                      
                      {/* Line 2: Date */}
                      <div className="text-sm text-gray-500 truncate">
                        {formatDate(extraction.createdAt)}
                      </div>
                    </>
                  ) : (
                    // When grouped by date: Show coffee name on line 1, brew method and time on line 2
                    <>
                      {/* Line 1: Roaster – Coffee Name and Quality */}
                      <div className="flex items-start gap-2 mb-1">
                        <div 
                          className="text-gray-900 truncate flex-1 min-w-0"
                          style={{ fontWeight: 'var(--font-weight-medium)' }}
                        >
                          {extraction.roaster} – {extraction.coffeeName}
                        </div>
                        {extraction.quality && (
                          <div className="text-lg leading-none flex-shrink-0 whitespace-nowrap">
                            {getRatingEmoji(extraction.quality)}
                          </div>
                        )}
                      </div>
                      
                      {/* Line 2: Brew Method, Recipe, and Time */}
                      <div className="flex items-center gap-2 text-sm">
                        <div className="text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap" style={{ flex: '1 1 auto', minWidth: 0 }}>
                          {capitalizeBrewMethod(extraction.brewMethod)}{formatRecipe(extraction)}
                        </div>
                        <div className="text-gray-500 whitespace-nowrap text-right" style={{ flex: '0 0 auto' }}>
                          {formatTime(extraction.createdAt)}
                        </div>
                      </div>
                    </>
                  )}
                </button>
                
                {/* Separator line (except for last item) */}
                {index < groupExtractions.length - 1 && (
                  <div className="border-b border-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {extractions.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">No extractions found</p>
        </div>
      )}
    </div>
  );
}