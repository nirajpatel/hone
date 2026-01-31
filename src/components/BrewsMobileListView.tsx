import { Brew, BrewMethod, User } from '../types';
import { capitalizeBrewMethod, getRatingEmoji } from '../utils/formatters';

interface BrewsMobileListViewProps {
  brews: Brew[];
  onSelectBrew: (brew: Brew) => void;
  groupBy?: 'month' | 'coffee';
  users?: User[];
}

export function BrewsMobileListView({
  brews,
  onSelectBrew,
  groupBy = 'month',
  users = [],
}: BrewsMobileListViewProps) {
  // Sort brews by date (most recent first)
  const sortedBrews = [...brews].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group brews by date or coffee
  const grouped: Record<string, Brew[]> = {};
  
  if (groupBy === 'coffee') {
    // Group by coffee (Roaster – Coffee Name)
    sortedBrews.forEach(brew => {
      const coffeeKey = `${brew.roaster} – ${brew.coffeeName}`;
      if (!grouped[coffeeKey]) {
        grouped[coffeeKey] = [];
      }
      grouped[coffeeKey].push(brew);
    });
  } else {
    // Group by date
    sortedBrews.forEach(brew => {
      const date = new Date(brew.createdAt);
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
      grouped[dateLabel].push(brew);
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
  const formatRecipe = (brew: Brew) => {
    const parts: string[] = [];
    
    // Add dose in → dose out
    if (brew.dosage !== undefined && brew.finalWeight !== undefined) {
      parts.push(`${brew.dosage}g → ${brew.finalWeight}g`);
    }
    
    // Add brew time
    if (brew.brewTime !== undefined) {
      const minutes = Math.floor(brew.brewTime / 60);
      const seconds = brew.brewTime % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      parts.push(timeStr);
    }
    
    return parts.length > 0 ? ` • ${parts.join(' • ')}` : '';
  };

  return (
    <div className="mobile-list-view -mx-3">
      {Object.entries(grouped).map(([groupLabel, groupBrews]) => (
        <div key={groupLabel} style={{ marginBottom: 'calc(var(--spacing))' }}>
          {/* Group Header */}
          <div className="px-3 pt-2 pb-1" style={{ color: 'var(--color-gray-500)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-medium)' }}>
            {groupLabel}
          </div>
          
          {/* Brew List */}
          <div className="bg-white border-y border-gray-200 overflow-hidden mobile-brew-card">
            {groupBrews.map((brew, index) => (
              <div key={brew.id}>
                <button
                  onClick={() => onSelectBrew(brew)}
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
                          className="text-gray-900 truncate"
                          style={{ fontWeight: 'var(--font-weight-medium)' }}
                        >
                          {formatDate(brew.createdAt)}
                        </div>
                        
                        {/* Line 2: Brew Method and Recipe */}
                        <div className="text-sm text-gray-500 truncate">
                          {capitalizeBrewMethod(brew.brewMethod)}{formatRecipe(brew)}
                        </div>
                        
                        {/* Line 3: Time and optional First Name */}
                        <div className="text-sm text-gray-500 truncate">
                          {formatTime(brew.createdAt)}
                          {isMultiUserHousehold && brew.userName && ` • ${brew.userName.split(' ')[0]}`}
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating (vertically centered) */}
                      <div className="flex-shrink-0 self-center">
                        {brew.quality ? (
                          <span className="text-xl leading-none">{getRatingEmoji(brew.quality)}</span>
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
                          className="text-gray-900 truncate"
                          style={{ fontWeight: 'var(--font-weight-medium)' }}
                        >
                          {brew.roaster} – {brew.coffeeName}
                        </div>
                        
                        {/* Line 2: Brew Method and Recipe */}
                        <div className="text-sm text-gray-500 truncate">
                          {capitalizeBrewMethod(brew.brewMethod)}{formatRecipe(brew)}
                        </div>
                        
                        {/* Line 3: Time and optional First Name */}
                        <div className="text-sm text-gray-500 truncate">
                          {formatTime(brew.createdAt)}
                          {isMultiUserHousehold && brew.userName && ` • ${brew.userName.split(' ')[0]}`}
                        </div>
                      </div>
                      
                      {/* Right side - Emoji rating (vertically centered) */}
                      <div className="flex-shrink-0 self-center">
                        {brew.quality ? (
                          <span className="text-xl leading-none">{getRatingEmoji(brew.quality)}</span>
                        ) : (
                          <span className="text-gray-500" style={{ fontSize: '20px' }}>–</span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
                
                {/* Separator line (except for last item) */}
                {index < groupBrews.length - 1 && (
                  <div className="border-b border-gray-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {brews.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-sm">No brews found</p>
        </div>
      )}
    </div>
  );
}