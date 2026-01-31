import { Extraction, BrewMethod, User } from '../types';
import { capitalizeBrewMethod, getRatingEmoji } from '../utils/formatters';

interface ExtractionsMobileListViewProps {
  extractions: Extraction[];
  onSelectExtraction: (extraction: Extraction) => void;
  groupBy?: 'month' | 'coffee';
  users?: User[];
}

export function ExtractionsMobileListView({
  extractions,
  onSelectExtraction,
  groupBy = 'month',
  users = [],
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

  // Check if user is in a household with multiple people
  const isMultiUserHousehold = users.length > 1;

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

  // Format date for display when grouped by coffee (e.g., "Jan 30, 2026")
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format recipe information (e.g., "18g → 38g • 0:28")
  const formatRecipe = (extraction: Extraction) => {
    const parts: string[] = [];
    
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
          <div className="px-3 pt-2 pb-1" style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-medium)' }}>
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
                    // When grouped by coffee: Show date on line 1, brew method on line 2, time on line 3
                    // Emoji vertically centered on the right
                    <div className="flex items-center gap-3">
                      {/* Left side content - 3 lines */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* Line 1: Date */}
                        <div 
                          className="text-gray-900"
                          style={{ fontWeight: 'var(--font-weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {formatDate(extraction.createdAt)}
                        </div>
                        
                        {/* Line 2: Brew Method and Recipe */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {capitalizeBrewMethod(extraction.brewMethod)}{formatRecipe(extraction)}
                        </div>
                        
                        {/* Line 3: Time and optional First Name */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatTime(extraction.createdAt)}
                          {isMultiUserHousehold && extraction.userName && ` • ${extraction.userName.split(' ')[0]}`}
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating (vertically centered) */}
                      <div className="flex-shrink-0 self-center">
                        {extraction.quality ? (
                          <span className="text-xl leading-none">{getRatingEmoji(extraction.quality)}</span>
                        ) : (
                          <span className="text-gray-500" style={{ fontSize: '20px' }}>–</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // When grouped by date: Show coffee name on line 1, brew method on line 2, time on line 3
                    // Emoji vertically centered on the right
                    <div className="flex items-center gap-3">
                      {/* Left side content - 3 lines */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        {/* Line 1: Roaster – Coffee Name */}
                        <div 
                          className="text-gray-900"
                          style={{ fontWeight: 'var(--font-weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {extraction.roaster} – {extraction.coffeeName}
                        </div>
                        
                        {/* Line 2: Brew Method and Recipe */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {capitalizeBrewMethod(extraction.brewMethod)}{formatRecipe(extraction)}
                        </div>
                        
                        {/* Line 3: Time and optional First Name */}
                        <div className="text-sm text-gray-500" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatTime(extraction.createdAt)}
                          {isMultiUserHousehold && extraction.userName && ` • ${extraction.userName.split(' ')[0]}`}
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating (vertically centered) */}
                      <div className="flex-shrink-0 self-center">
                        {extraction.quality ? (
                          <span className="text-xl leading-none">{getRatingEmoji(extraction.quality)}</span>
                        ) : (
                          <span className="text-gray-500" style={{ fontSize: '20px' }}>–</span>
                        )}
                      </div>
                    </div>
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