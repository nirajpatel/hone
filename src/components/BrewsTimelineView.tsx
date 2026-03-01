import { useState, useEffect, useRef } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment } from '../types';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Copy, Check, Plus, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { getRatingEmoji, capitalizeBrewMethod } from '../utils/formatters';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { BrewsToolbar } from './BrewsToolbar';
import { BrewsEmptyState } from './BrewsEmptyState';
import { line, area, curveMonotoneX } from 'd3-shape';

interface BrewsTimelineViewProps {
  brews: Brew[];
  coffees: Coffee[];
  users: User[];
  filterMethod: BrewMethod | 'all';
  onFilterMethodChange: (method: BrewMethod | 'all') => void;
  onNewBrew: () => void;
  onSelectBrew: (brew: Brew, scrollToGuidance?: boolean) => void;
  view?: 'table' | 'timeline';
  onViewChange?: (view: 'table' | 'timeline') => void;
  equipment: Equipment[];
  onAddBrewForCoffee?: (coffeeId: string, brewMethod: BrewMethod) => void;
  onOpenEquipment?: () => void;
  onOpenAddCoffee?: () => void;
}

export function BrewsTimelineView({
  brews,
  coffees,
  users,
  filterMethod,
  onFilterMethodChange,
  onNewBrew,
  onSelectBrew,
  view,
  onViewChange,
  equipment,
  onAddBrewForCoffee,
  onOpenEquipment,
  onOpenAddCoffee,
}: BrewsTimelineViewProps) {
  // Filter brews
  const filteredBrews = filterMethod === 'all' 
    ? brews 
    : brews.filter(b => b.brewMethod === filterMethod);

  // Get all brew method configs
  const brewMethodConfigs = getAllBrewMethodConfigs();

  // Check if equipment is complete (at least 1 brewer and 1 grinder for the same brew method)
  const hasCompleteEquipment = () => {
    // Get all unique brew methods from equipment
    const brewMethods = [...new Set(equipment.map(e => e.brewMethod))];
    
    // Check if any brew method has both a brewer and a grinder
    return brewMethods.some(method => {
      const hasBrewer = equipment.some(e => e.brewMethod === method && e.type === 'brewer');
      const hasGrinder = equipment.some(e => e.brewMethod === method && e.type === 'grinder');
      return hasBrewer && hasGrinder;
    });
  };

  // Group brews by coffee (name + roaster) AND method
  const coffeeMethodGroups: Record<string, {
    coffeeName: string;
    roaster: string;
    method: string;
    methodLabel: string;
    brews: Brew[];
    lastExtractionDate: Date;
  }> = {};

  filteredBrews.forEach(brew => {
    const coffee = coffees.find(c => c.id === brew.coffeeId);
    if (!coffee) return;

    const methodConfig = brewMethodConfigs.find(c => c.id === brew.brewMethod);
    const methodLabel = methodConfig?.label || brew.brewMethod;
    const key = `${coffee.name}|||${coffee.roaster}|||${brew.brewMethod}`;
    
    if (!coffeeMethodGroups[key]) {
      coffeeMethodGroups[key] = {
        coffeeName: coffee.name,
        roaster: coffee.roaster,
        method: brew.brewMethod,
        methodLabel: methodLabel,
        brews: [],
        lastExtractionDate: new Date(brew.createdAt),
      };
    }

    // Update last brew date
    const brewDate = new Date(brew.createdAt);
    if (brewDate > coffeeMethodGroups[key].lastExtractionDate) {
      coffeeMethodGroups[key].lastExtractionDate = brewDate;
    }

    coffeeMethodGroups[key].brews.push(brew);
  });

  // Sort coffee+method groups by last brew descending
  const sortedGroups = Object.entries(coffeeMethodGroups).sort((a, b) => 
    b[1].lastExtractionDate.getTime() - a[1].lastExtractionDate.getTime()
  );

  // Format date/time for node
  const formatNodeDateTime = (dateString: string, nextDateString: string | null = null) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    // Check if this is the oldest node in a year (timeline goes newest to oldest)
    // Show year on the oldest node of a year if the next node (older) is in a different year
    let shouldShowYear = false;
    const currentYear = new Date().getFullYear();
    
    if (nextDateString) {
      const nextDate = new Date(nextDateString);
      const nextYear = nextDate.getFullYear();
      // Show year if next node (older) is in a different year
      if (year !== nextYear) {
        // Only show year if it's not the current year
        if (year !== currentYear) {
          shouldShowYear = true;
        }
      }
    } else {
      // Last node (oldest) - show year if not current year
      if (year !== currentYear) {
        shouldShowYear = true;
      }
    }
    
    const dateStr = shouldShowYear 
      ? `${month} ${day} '${year.toString().slice(-2)}`
      : `${month} ${day}`;
    
    return {
      date: dateStr,
      time: `${displayHours}:${displayMinutes} ${ampm}`,
    };
  };

  // Format last brewed date (full month name, only show year if not current year)
  const formatLastBrewedDate = (date: Date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    
    if (year !== currentYear) {
      return `${month} ${day}, ${year}`;
    }
    return `${month} ${day}`;
  };

  // Calculate trend from rated brews
  const calculateTrend = (brews: Brew[]) => {
    // Filter to only rated brews
    const ratedBrews = brews.filter(b => b.quality);
    const count = ratedBrews.length;
    
    // If less than 2 rated brews: show "No trend"
    if (count < 2) {
      return { 
        trend: 'no trend', 
        icon: <Minus className="w-3.5 h-3.5" />
      };
    }
    
    // Check if last 2 are both Bad (quality === 1)
    if (count >= 2) {
      const last2 = ratedBrews.slice(-2);
      if (last2[0].quality === 1 && last2[1].quality === 1) {
        return { 
          trend: 'needs work', 
          icon: <TrendingDown className="w-3.5 h-3.5" />
        };
      }
    }
    
    // If 4 or more rated brews: use split-halves average
    if (count >= 4) {
      const last4 = ratedBrews.slice(-4);
      const ratings = last4.map(b => b.quality!);
      
      // Split into halves: first 2 (earlier) and last 2 (recent)
      const earlier = ratings.slice(0, 2);
      const recent = ratings.slice(2, 4);
      
      // Calculate averages
      const avgEarlier = (earlier[0] + earlier[1]) / 2;
      const avgRecent = (recent[0] + recent[1]) / 2;
      
      // Determine trend
      const diff = avgRecent - avgEarlier;
      
      // If both averages round down to 1 (bad), always show "needs work"
      if (Math.floor(avgEarlier) === 1 && Math.floor(avgRecent) === 1) {
        return { 
          trend: 'needs work', 
          icon: <TrendingDown className="w-3.5 h-3.5" />
        };
      }
      
      if (diff >= 0.5) {
        return { 
          trend: 'improving', 
          icon: <TrendingUp className="w-3.5 h-3.5" />
        };
      } else if (diff <= -0.5) {
        return { 
          trend: 'needs work', 
          icon: <TrendingDown className="w-3.5 h-3.5" />
        };
      } else {
        return { 
          trend: 'stable', 
          icon: <Minus className="w-3.5 h-3.5" />
        };
      }
    }
    
    // Else (2 or 3 rated brews): compare first vs last
    const firstQuality = ratedBrews[0].quality!;
    const lastQuality = ratedBrews[ratedBrews.length - 1].quality!;
    const diff = lastQuality - firstQuality;
    
    // If both qualities are 1 (bad), always show "needs work"
    if (firstQuality === 1 && lastQuality === 1) {
      return { 
        trend: 'needs work', 
        icon: <TrendingDown className="w-3.5 h-3.5" />
      };
    }
    
    if (diff >= 0.5) {
      return { 
        trend: 'improving', 
        icon: <TrendingUp className="w-3.5 h-3.5" />
      };
    } else if (diff <= -0.5) {
      return { 
        trend: 'needs work', 
        icon: <TrendingDown className="w-3.5 h-3.5" />
      };
    } else {
      return { 
        trend: 'stable', 
        icon: <Minus className="w-3.5 h-3.5" />
      };
    }
  };

  return (
    <>
      {/* Toolbar - hidden during empty state */}
      {sortedGroups.length > 0 && (
        <BrewsToolbar
          filterMethod={filterMethod}
          onFilterMethodChange={onFilterMethodChange}
          onNewBrew={onNewBrew}
          view={view || 'timeline'}
          onViewChange={onViewChange!}
          equipment={equipment}
          coffees={coffees}
        />
      )}

      {/* Timeline Cards */}
      {sortedGroups.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8rem)] flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center min-h-0">
            <BrewsEmptyState
              filterMethod={filterMethod}
              hasEquipment={hasCompleteEquipment()}
              hasCoffees={coffees.length > 0}
              hasBrews={brews.length > 0}
              onOpenEquipment={onOpenEquipment ?? (() => {})}
              onOpenAddCoffee={onOpenAddCoffee ?? (() => {})}
              onNewBrew={onNewBrew}
            />
          </div>
        </div>
      ) : (
        <div className="timeline-cards-mobile-mt space-y-2 md:space-y-4">
          {sortedGroups.map(([key, group]) => {
            // Sort brews by date ascending for timeline (oldest to newest left to right)
            const sortedExtractions = [...group.brews].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Get the coffee ID from the first brew
            const coffeeId = sortedExtractions[0]?.coffeeId;

            // Calculate trend for this group
            const trendInfo = calculateTrend(sortedExtractions);

            // Get the newest brew (last in sorted array) for suggestion display
            const newestBrew = sortedExtractions[sortedExtractions.length - 1];
            const isExceptional = newestBrew?.quality === 3;
            const firstSuggestion = newestBrew?.suggestion?.full?.suggestions?.[0];
            const hasSuggestion = firstSuggestion && 
              (firstSuggestion.confidence === 'Medium' || firstSuggestion.confidence === 'High');
            
            // Override trend for exceptional brews
            const displayTrendInfo = isExceptional 
              ? { trend: 'Dialed In', icon: <Sparkles className="w-3.5 h-3.5" /> }
              : trendInfo;

            return (
              <div key={key} className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mobile-timeline-card">
                {/* Header with Coffee and Method */}
                <div className="mb-3">
                  <h3 className="text-gray-900 mb-0" style={{ fontWeight: 'var(--font-weight-medium)' }}>{group.roaster} – {group.coffeeName} • {capitalizeBrewMethod(group.method)}</h3>
                  <p className="text-sm text-gray-500 mt-0 flex items-center gap-1">
                    <span>{sortedExtractions.length} {sortedExtractions.length === 1 ? 'brew' : 'brews'}</span>
                    <span className="hidden md:inline">•</span>
                    <span className="hidden md:inline">Last brewed {formatLastBrewedDate(group.lastExtractionDate)}</span>
                    {/* Mobile: Show trend on second line */}
                    {(hasSuggestion || isExceptional) && (
                      <>
                        <span className="md:hidden">•</span>
                        <span className="md:hidden flex items-center gap-1">
                          {displayTrendInfo && (
                            <>
                              {displayTrendInfo.icon}
                              <span>{displayTrendInfo.trend.charAt(0).toUpperCase() + displayTrendInfo.trend.slice(1)}</span>
                            </>
                          )}
                        </span>
                      </>
                    )}
                  </p>
                  {/* Desktop: Show trend and guidance on third line */}
                  {(hasSuggestion || isExceptional) && (
                    <p className="text-sm text-gray-500 mt-0 flex items-center gap-1 hidden md:flex">
                      {displayTrendInfo && (
                        <>
                          <span className="flex items-center gap-1">
                            {displayTrendInfo.icon}
                            <span>{displayTrendInfo.trend.charAt(0).toUpperCase() + displayTrendInfo.trend.slice(1)}</span>
                          </span>
                          <span>•</span>
                        </>
                      )}
                      {isExceptional ? (
                        'No adjustment needed'
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectBrew(newestBrew, true)}
                          className="text-sm text-gray-500 text-left cursor-pointer"
                          style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'rgba(107,114,128,0.4)', textUnderlineOffset: '3px' }}
                        >
                          {(() => {
                            if (!firstSuggestion) return '';
                            
                            // Extract action: remove magnitude/details, keep core action (2-4 words)
                            let action = firstSuggestion.action;
                            action = action.replace(/\s+by\s+.*$/i, '');
                            action = action.replace(/\s+to\s+\d+.*$/i, '');
                            action = action.replace(/\s+~?[\d.–-]+.*$/i, '');
                            action = action.replace(/\s+on\s+.*$/i, '');
                            action = action.trim();
                            const actionWords = action.split(/\s+/);
                            if (actionWords.length > 4) {
                              action = actionWords.slice(0, 4).join(' ');
                            }
                            
                            // Extract goal from effect: look for key phrases (2-3 words)
                            let goal = '';
                            const effect = firstSuggestion.effect || '';
                            
                            // Common goal patterns - prioritize negative outcomes to fix
                            const goalPatterns = [
                              /(?:reduce|decrease|fix|eliminate|minimize)\s+(?:sourness|bitterness|astringency|channeling|under[- ]extraction|over[- ]extraction|acidity|harshness)/i,
                              /(?:increase|improve|enhance|boost)\s+(?:strength|body|extraction|balance|clarity|sweetness|viscosity)/i,
                              /(?:fix|resolve|address|prevent)\s+(?:channeling|uneven\s+extraction|flow\s+issues)/i,
                            ];
                            
                            for (const pattern of goalPatterns) {
                              const match = effect.match(pattern);
                              if (match) {
                                const matchedText = match[0];
                                const words = matchedText.split(/\s+/);
                                goal = words.slice(0, Math.min(3, words.length)).join(' ');
                                goal = goal.charAt(0).toUpperCase() + goal.slice(1);
                                break;
                              }
                            }
                            
                            // Fallback: extract from effect text more generically
                            if (!goal) {
                              if (effect.match(/reduce.*sour/i)) {
                                goal = 'Reduce sourness';
                              } else if (effect.match(/increase.*strength/i)) {
                                goal = 'Increase strength';
                              } else if (effect.match(/increase.*body/i)) {
                                goal = 'Increase body';
                              } else if (effect.match(/reduce.*bitter/i)) {
                                goal = 'Reduce bitterness';
                              } else if (effect.match(/improve.*extraction/i)) {
                                goal = 'Improve extraction';
                              } else {
                                // Final fallback based on parameter and action direction
                                const parameter = (firstSuggestion.parameter || '').toLowerCase();
                                const actionLower = action.toLowerCase();
                                
                                if (parameter.includes('grind')) {
                                  goal = actionLower.includes('finer') ? 'Increase extraction' : 'Reduce bitterness';
                                } else if (parameter.includes('temperature')) {
                                  goal = actionLower.includes('increase') ? 'Increase extraction' : 'Reduce bitterness';
                                } else if (parameter.includes('weight') || parameter.includes('ratio')) {
                                  goal = actionLower.includes('increase') ? 'Increase strength' : 'Reduce bitterness';
                                } else {
                                  goal = 'Improve balance';
                                }
                              }
                            }
                            
                            // Capitalize first letter of action, lowercase first letter of goal
                            const capitalizedAction = action.charAt(0).toUpperCase() + action.slice(1);
                            const lowercasedGoal = goal.charAt(0).toLowerCase() + goal.slice(1);
                            return `${capitalizedAction} to ${lowercasedGoal}`;
                          })()}
                        </button>
                      )}
                    </p>
                  )}
                  {/* Mobile: Show guidance on third line */}
                  {(hasSuggestion || isExceptional) && (
                    <p className="text-sm text-gray-500 mt-0 flex items-center gap-1 md:hidden">
                      {isExceptional ? (
                        'No adjustment needed'
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectBrew(newestBrew, true)}
                          className="text-sm text-gray-500 text-left cursor-pointer"
                          style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'rgba(107,114,128,0.4)', textUnderlineOffset: '3px' }}
                        >
                          {(() => {
                            if (!firstSuggestion) return '';
                            
                            // Extract action: remove magnitude/details, keep core action (2-4 words)
                            let action = firstSuggestion.action;
                            action = action.replace(/\s+by\s+.*$/i, '');
                            action = action.replace(/\s+to\s+\d+.*$/i, '');
                            action = action.replace(/\s+~?[\d.–-]+.*$/i, '');
                            action = action.replace(/\s+on\s+.*$/i, '');
                            action = action.trim();
                            const actionWords = action.split(/\s+/);
                            if (actionWords.length > 4) {
                              action = actionWords.slice(0, 4).join(' ');
                            }
                            
                            // Extract goal from effect: look for key phrases (2-3 words)
                            let goal = '';
                            const effect = firstSuggestion.effect || '';
                            
                            // Common goal patterns - prioritize negative outcomes to fix
                            const goalPatterns = [
                              /(?:reduce|decrease|fix|eliminate|minimize)\s+(?:sourness|bitterness|astringency|channeling|under[- ]extraction|over[- ]extraction|acidity|harshness)/i,
                              /(?:increase|improve|enhance|boost)\s+(?:strength|body|extraction|balance|clarity|sweetness|viscosity)/i,
                              /(?:fix|resolve|address|prevent)\s+(?:channeling|uneven\s+extraction|flow\s+issues)/i,
                            ];
                            
                            for (const pattern of goalPatterns) {
                              const match = effect.match(pattern);
                              if (match) {
                                const matchedText = match[0];
                                const words = matchedText.split(/\s+/);
                                goal = words.slice(0, Math.min(3, words.length)).join(' ');
                                goal = goal.charAt(0).toUpperCase() + goal.slice(1);
                                break;
                              }
                            }
                            
                            // Fallback: extract from effect text more generically
                            if (!goal) {
                              if (effect.match(/reduce.*sour/i)) {
                                goal = 'Reduce sourness';
                              } else if (effect.match(/increase.*strength/i)) {
                                goal = 'Increase strength';
                              } else if (effect.match(/increase.*body/i)) {
                                goal = 'Increase body';
                              } else if (effect.match(/reduce.*bitter/i)) {
                                goal = 'Reduce bitterness';
                              } else if (effect.match(/improve.*extraction/i)) {
                                goal = 'Improve extraction';
                              } else {
                                // Final fallback based on parameter and action direction
                                const parameter = (firstSuggestion.parameter || '').toLowerCase();
                                const actionLower = action.toLowerCase();
                                
                                if (parameter.includes('grind')) {
                                  goal = actionLower.includes('finer') ? 'Increase extraction' : 'Reduce bitterness';
                                } else if (parameter.includes('temperature')) {
                                  goal = actionLower.includes('increase') ? 'Increase extraction' : 'Reduce bitterness';
                                } else if (parameter.includes('weight') || parameter.includes('ratio')) {
                                  goal = actionLower.includes('increase') ? 'Increase strength' : 'Reduce bitterness';
                                } else {
                                  goal = 'Improve balance';
                                }
                              }
                            }
                            
                            // Capitalize first letter of action, lowercase first letter of goal
                            const capitalizedAction = action.charAt(0).toUpperCase() + action.slice(1);
                            const lowercasedGoal = goal.charAt(0).toLowerCase() + goal.slice(1);
                            return `${capitalizedAction} to ${lowercasedGoal}`;
                          })()}
                        </button>
                      )}
                    </p>
                  )}
                </div>

                {/* Timeline */}
                <TimelineRow
                  brews={sortedExtractions}
                  onSelectBrew={onSelectBrew}
                  formatNodeDateTime={formatNodeDateTime}
                  coffeeId={coffeeId}
                  brewMethod={group.method as BrewMethod}
                  onAddExtraction={onAddBrewForCoffee}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Counter for generating unique IDs for each timeline
let timelineIdCounter = 0;

interface TimelineRowProps {
  brews: Brew[];
  onSelectBrew: (brew: Brew, scrollToGuidance?: boolean) => void;
  formatNodeDateTime: (dateString: string, nextDateString?: string | null) => { date: string; time: string };
  coffeeId?: string;
  brewMethod?: BrewMethod;
  onAddExtraction?: (coffeeId: string, brewMethod: BrewMethod) => void;
}

function TimelineRow({ brews, onSelectBrew, formatNodeDateTime, coffeeId, brewMethod, onAddExtraction }: TimelineRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [hoveredNodeIndex, setHoveredNodeIndex] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);

  // Generate unique IDs for this timeline's SVG elements using incrementor
  const uniqueId = useRef(`timeline-${timelineIdCounter++}`).current;

  // Handle scroll to check if fades should be visible
  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    // Show left fade when scrolled right (content hidden on left)
    setShowLeftFade(scrollLeft > 0);
    
    // Show right fade when there's more content to scroll (content hidden on right)
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1); // -1 for rounding
  };

  // Scroll to show more of the graph on mount - on mobile show partial scroll, on desktop scroll all the way
  useEffect(() => {
    if (scrollRef.current) {
      const isMobile = window.innerWidth < 768;
      const { scrollWidth, clientWidth } = scrollRef.current;
      const contentOverflows = scrollWidth > clientWidth;
      
      if (isMobile) {
        if (contentOverflows) {
          // Graph extends beyond viewport - start scrolled to show the rightmost part
          scrollRef.current.scrollLeft = scrollWidth - clientWidth;
        } else {
          // Graph fits within viewport - no scroll needed (show from left)
          scrollRef.current.scrollLeft = 0;
        }
      } else {
        // On desktop, scroll all the way to the right
        scrollRef.current.scrollLeft = scrollWidth;
      }
      handleScroll();
    }
  }, []);

  // Add scroll listener
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      // Check initial state
      handleScroll();
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [brews]);

  // Set initial mouseX position for default display (first node) - TEMPORARY for styling
  useEffect(() => {
    if (brews.length > 0 && nodeRefs.current[0]) {
      const nodeElement = nodeRefs.current[0];
      const contentDiv = scrollRef.current?.querySelector('.relative.min-w-max') as HTMLElement;
      if (nodeElement && contentDiv) {
        const nodeRect = nodeElement.getBoundingClientRect();
        const contentRect = contentDiv.getBoundingClientRect();
        const nodeCenterX = nodeRect.left + nodeRect.width / 2 - contentRect.left;
        setMouseX(nodeCenterX);
      } else {
        // Fallback to calculated position
        const isMobile = window.innerWidth < 768;
        const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
        const gap = isMobile ? mobileGap : desktopGap;
        const nodeX = 0 * (containerWidth + gap) + containerWidth / 2;
        setMouseX(nodeX);
      }
    }
  }, [brews.length]);

  // Get dot color based on rating
  const getDotColor = (quality: number | null) => {
    if (!quality) return 'bg-gray-300';
    switch (quality) {
      case 1: return '[background-color:oklch(58%_0.23_28)]'; // Bad
      case 2: return '[background-color:oklch(0.76_0.18_88.84)]'; // Decent
      case 3: return '[background-color:oklch(58%_0.22_149)]'; // Good
      default: return 'bg-gray-300';
    }
  };

  // Get dot border color (same as fill - no shading)
  const getDotBorderColor = (quality: number | null) => {
    if (!quality) return 'border-gray-400';
    switch (quality) {
      case 1: return '[border-color:oklch(58%_0.23_28)]'; // Bad
      case 2: return '[border-color:oklch(0.76_0.18_88.84)]'; // Decent
      case 3: return '[border-color:oklch(58%_0.22_149)]'; // Good
      default: return 'border-gray-400';
    }
  };

  // Get Y position based on rating for graph
  const getYPosition = (quality: number | null, lastRatedQuality: number | null = null, isMobile: boolean = false) => {
    // If unrated, use the last rated brew's position
    if (!quality) {
      return lastRatedQuality ? getYPosition(lastRatedQuality, null, isMobile) : (isMobile ? 45 : 60);
    }
    // Mobile: 25% reduction in height, so scale Y positions accordingly
    if (isMobile) {
      switch (quality) {
        case 1: return 75; // Bottom (bad) - was 100
        case 2: return 45;  // Middle (decent) - was 60
        case 3: return 15;  // Top (exceptional) - was 20
        default: return 45;
      }
    }
    // Desktop: unchanged
    switch (quality) {
      case 1: return 100; // Bottom (bad)
      case 2: return 60;  // Middle (decent)
      case 3: return 20;  // Top (exceptional)
      default: return 60;
    }
  };

  // Get RGB color values based on rating
  const getRGBColor = (quality: number | null): [number, number, number] => {
    if (!quality) return [209, 213, 219]; // gray-300
    switch (quality) {
      case 1: return [160, 83, 58]; // oklch(58% 0.23 28)
      case 2: return [186, 192, 118]; // oklch(68% 0.20 80)
      case 3: return [56, 150, 140]; // oklch(58% 0.22 149)
      default: return [209, 213, 219]; // gray-300
    }
  };

  // Calculate SVG dimensions (needed for fill path calculation)
  const mobileContainerWidth = 60; // 25% reduction from 80px
  const desktopContainerWidth = 80;
  const mobileGap = 8; // gap-2 (8px / 0.5rem)
  const desktopGap = 32;
  const mobileSvgHeight = 90; // 25% reduction from 120px
  const desktopSvgHeight = 120;
  const hasButton = coffeeId && brewMethod && onAddExtraction;

  // Calculate graph path for rated brews
  const calculateGraphPath = (isMobile: boolean) => {
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    const svgHeight = isMobile ? mobileSvgHeight : desktopSvgHeight;
    
    // Track the last rated quality to use for unrated brews
    let lastRatedQuality: number | null = null;
    
    // Get ALL brews with their positions (including unrated)
    const allExtractions = brews.map((brew, index) => {
      if (brew.quality) {
        lastRatedQuality = brew.quality;
      }
      
      return {
        brew,
        index,
        x: index * (containerWidth + gap) + containerWidth / 2, // Center of each node
        y: getYPosition(brew.quality, lastRatedQuality, isMobile),
      };
    });

    if (allExtractions.length === 0) return '';

    // Build points array - include button if it exists
    const points: [number, number][] = allExtractions.map(item => [item.x, item.y]);
    
    // If button exists, add intermediate point at 90% then button
    if (coffeeId && brewMethod && onAddExtraction) {
      const lastExtractionX = allExtractions[allExtractions.length - 1].x;
      const buttonCenterX = brews.length * (containerWidth + gap) + containerWidth / 2;
      const buttonY = isMobile ? 45 : 60; // Responsive center position
      
      // Add intermediate point at 90% of the distance, at vertical center
      const intermediateX = lastExtractionX + 0.9 * (buttonCenterX - lastExtractionX);
      points.push([intermediateX, buttonY]);
      
      // Then add the button point
      points.push([buttonCenterX, buttonY]);
    }

    const lineGenerator = line<[number, number]>()
      .x(d => d[0])
      .y(d => d[1])
      .curve(curveMonotoneX);

    return lineGenerator(points) || '';
  };

  // Calculate gradient mask stops for highlight effect (desktop only)
  // Returns the X positions for the gradient stops to create a fade effect
  const calculateHighlightGradientStops = (hoveredIndex: number | null) => {
    if (hoveredIndex === null || hoveredIndex < 0 || hoveredIndex >= brews.length) {
      return null;
    }

    const containerWidth = desktopContainerWidth;
    const gap = desktopGap;
    
    const hoveredX = hoveredIndex * (containerWidth + gap) + containerWidth / 2;
    const nodeSpacing = containerWidth + gap;
    const fadeDistance = nodeSpacing * 0.3; // Fade distance for smooth transitions
    
    // Calculate X positions for gradient stops
    const prevNodeX = hoveredIndex > 0 
      ? (hoveredIndex - 1) * (containerWidth + gap) + containerWidth / 2
      : hoveredX - nodeSpacing;
    const nextNodeX = hoveredIndex < brews.length - 1
      ? (hoveredIndex + 1) * (containerWidth + gap) + containerWidth / 2
      : hoveredX + nodeSpacing;
    
    // Second nodes out (for 80% opacity zone)
    const secondLeftX = hoveredIndex > 1
      ? (hoveredIndex - 2) * (containerWidth + gap) + containerWidth / 2
      : prevNodeX - nodeSpacing;
    const secondRightX = hoveredIndex < brews.length - 2
      ? (hoveredIndex + 2) * (containerWidth + gap) + containerWidth / 2
      : nextNodeX + nodeSpacing;
    
    return {
      hoveredX,
      // 100% opacity zone: segments to left and right of node (including node)
      immediateLeftX: prevNodeX,
      immediateRightX: nextNodeX,
      // 80% opacity zone: segments to left of left segment and right of right segment
      secondLeftX,
      secondRightX,
      // Fade boundaries
      leftFadeStart: Math.max(0, prevNodeX),
      leftFadeEnd: hoveredX - fadeDistance,
      rightFadeStart: hoveredX + fadeDistance,
      rightFadeEnd: nextNodeX,
    };
  };

  const mobileGraphPath = calculateGraphPath(true);
  const desktopGraphPath = calculateGraphPath(false);

  // Calculate gradient stops for highlight effect (desktop only)
  const desktopGradientStops = hoveredNodeIndex !== null && hoveredNodeIndex < brews.length
    ? calculateHighlightGradientStops(hoveredNodeIndex)
    : null;

  // Calculate fill area path using area generator with the same curve
  const calculateFillPath = (isMobile: boolean) => {
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    const svgHeight = isMobile ? mobileSvgHeight : desktopSvgHeight;
    
    // Track the last rated quality to use for unrated brews
    let lastRatedQuality: number | null = null;
    
    // Get ALL brews with their positions (including unrated)
    const allExtractions = brews.map((brew, index) => {
      if (brew.quality) {
        lastRatedQuality = brew.quality;
      }
      
      return {
        brew,
        index,
        x: index * (containerWidth + gap) + containerWidth / 2,
        y: getYPosition(brew.quality, lastRatedQuality, isMobile),
      };
    });

    if (allExtractions.length === 0) return '';

    // Build points array - include button if it exists to match the line curve
    const points: [number, number][] = allExtractions.map(item => [item.x, item.y]);
    
    // If button exists, add intermediate point at 90% then button (match the line path)
    if (coffeeId && brewMethod && onAddExtraction) {
      const lastExtractionX = allExtractions[allExtractions.length - 1].x;
      const buttonCenterX = brews.length * (containerWidth + gap) + containerWidth / 2;
      const buttonY = isMobile ? 45 : 60; // Responsive center position
      
      // Add intermediate point at 90% of the distance, at vertical center
      const intermediateX = lastExtractionX + 0.9 * (buttonCenterX - lastExtractionX);
      points.push([intermediateX, buttonY]);
      
      // Then add the button point
      points.push([buttonCenterX, buttonY]);
    }

    const areaGenerator = area<[number, number]>()
      .x(d => d[0])
      .y0(svgHeight)
      .y1(d => d[1])
      .curve(curveMonotoneX);

    return areaGenerator(points) || '';
  };

  const mobileFillPath = calculateFillPath(true);
  const desktopFillPath = calculateFillPath(false);

  // Get the X position where the mask should cut off (at center of last brew)
  const getMaskCutoffX = (isMobile: boolean) => {
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    const lastExtractionX = (brews.length - 1) * (containerWidth + gap) + containerWidth / 2;
    return {
      cutoffStart: lastExtractionX,
      cutoffEnd: lastExtractionX + 1 // Immediate fade over 1px
    };
  };

  const mobileMaskCutoff = getMaskCutoffX(true);
  const desktopMaskCutoff = getMaskCutoffX(false);

  // Handle mouse move to find closest node
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!graphContainerRef.current || !scrollRef.current) return;
    
    const scrollRect = scrollRef.current.getBoundingClientRect();
    const scrollLeft = scrollRef.current.scrollLeft;
    // Account for padding (px-2 = 8px)
    const padding = 8;
    const x = e.clientX - scrollRect.left + scrollLeft - padding;
    
    const isMobile = window.innerWidth < 768;
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    
    // Find closest node (including add button if it exists)
    let closestIndex: number | null = 0;
    let minDistance = Infinity;
    const isButtonAvailable = coffeeId && brewMethod && onAddExtraction;
    
    // Check all brew nodes
    brews.forEach((brew, index) => {
      const nodeX = index * (containerWidth + gap) + containerWidth / 2;
      const distance = Math.abs(x - nodeX);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Check add button position if it exists
    if (isButtonAvailable) {
      const buttonX = brews.length * (containerWidth + gap) + containerWidth / 2;
      const buttonDistance = Math.abs(x - buttonX);
      if (buttonDistance < minDistance) {
        minDistance = buttonDistance;
        closestIndex = brews.length; // Use brews.length as the index for the button
      }
    }
    
    setHoveredNodeIndex(closestIndex);
    
    // Get actual rendered position of the node/button
    if (closestIndex === brews.length && isButtonAvailable) {
      // Handle button position
      const buttonX = brews.length * (containerWidth + gap) + containerWidth / 2;
      setMouseX(buttonX);
    } else if (closestIndex !== null && closestIndex < brews.length) {
      // Handle regular node position - get position relative to graph container
      const nodeElement = nodeRefs.current[closestIndex];
      const graphContainer = graphContainerRef.current;
      if (nodeElement && graphContainer) {
        const nodeRect = nodeElement.getBoundingClientRect();
        const graphRect = graphContainer.getBoundingClientRect();
        // Calculate node center relative to graph container
        const nodeCenterX = nodeRect.left + nodeRect.width / 2 - graphRect.left;
        setMouseX(nodeCenterX);
      } else {
        // Fallback to calculated position
        const nodeX = closestIndex * (containerWidth + gap) + containerWidth / 2;
        setMouseX(nodeX);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredNodeIndex(null);
    setMouseX(null);
  };

  const handleClick = () => {
    if (hoveredNodeIndex === null) return;
    
    // If clicking on the add button
    if (hoveredNodeIndex === brews.length && coffeeId && brewMethod && onAddExtraction) {
      onAddExtraction(coffeeId, brewMethod);
    } 
    // If clicking on a brew node
    else if (hoveredNodeIndex < brews.length && brews[hoveredNodeIndex]) {
      onSelectBrew(brews[hoveredNodeIndex]);
    }
  };

  // Calculate SVG dimensions
  const mobileSvgWidth = hasButton 
    ? brews.length * (mobileContainerWidth + mobileGap) + mobileContainerWidth
    : brews.length * (mobileContainerWidth + mobileGap) + mobileContainerWidth;
  const desktopSvgWidth = hasButton
    ? brews.length * (desktopContainerWidth + desktopGap) + desktopContainerWidth
    : brews.length * (desktopContainerWidth + desktopGap) + desktopContainerWidth;
  
  return (
    <div>
      {/* Timeline Container with fade overlay */}
      <div className="relative">
        {/* Left fade gradient - shows when scrolled right (content hidden on left) */}
        {showLeftFade && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none z-20"
            style={{
              background: 'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)'
            }}
          />
        )}
        
        {/* Right fade gradient - shows when scrolled left (content hidden on right) */}
        {showRightFade && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-20"
            style={{
              background: 'linear-gradient(to left, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)'
            }}
          />
        )}
        
        <div 
          ref={scrollRef}
          className="relative overflow-x-auto pb-2 cursor-pointer scrollbar-hide"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <div className="relative min-w-max px-2">
            {/* Graph */}
            <div 
              ref={graphContainerRef}
              className="relative h-[90px] md:h-[120px]"
            >
              {/* Vertical indicator line - desktop only (hover doesn't work on mobile) */}
              {/* Don't show line if add button is closest */}
              {hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length && mouseX !== null && (
                <div
                  className="absolute pointer-events-none hidden md:block"
                  style={{
                    left: `${mouseX}px`,
                    top: '0px',
                    height: '120px',
                    width: '2px',
                    background: 'repeating-linear-gradient(to bottom, var(--color-gray-300) 0px, var(--color-gray-300) 4px, transparent 4px, transparent 8px)',
                    transform: 'translateX(-50%)',
                    zIndex: 0
                  }}
                />
              )}
              {/* SVG Graph - Mobile */}
              <svg 
                className="absolute top-0 left-0 md:hidden pointer-events-none"
                width={mobileSvgWidth}
                height={mobileSvgHeight}
                style={{ zIndex: 0 }}
              >
                <defs>
                  <linearGradient id={`${uniqueId}-mobileGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`${uniqueId}-mobileFadeMask`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                    <stop offset={`${(mobileMaskCutoff.cutoffStart / mobileSvgWidth) * 100}%`} stopColor="white" stopOpacity="1" />
                    <stop offset={`${(mobileMaskCutoff.cutoffEnd / mobileSvgWidth) * 100}%`} stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <mask id={`${uniqueId}-mobileMask`}>
                    <rect x="0" y="0" width={mobileSvgWidth} height={mobileSvgHeight} fill={`url(#${uniqueId}-mobileFadeMask)`} />
                  </mask>
                </defs>
                {/* Mobile: Base graph always at 100% opacity (no hover effects) */}
                <path
                  d={mobileFillPath}
                  fill={`url(#${uniqueId}-mobileGradient)`}
                  mask={`url(#${uniqueId}-mobileMask)`}
                  opacity="1"
                />
                <path
                  d={mobileGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="1"
                />
              </svg>

              {/* SVG Graph - Desktop */}
              <svg 
                className="absolute top-0 left-0 hidden md:block pointer-events-none"
                width={desktopSvgWidth}
                height={desktopSvgHeight}
                style={{ zIndex: 0 }}
              >
                <defs>
                  <linearGradient id={`${uniqueId}-desktopGradient`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`${uniqueId}-desktopFadeMask`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="white" stopOpacity="1" />
                    <stop offset={`${(desktopMaskCutoff.cutoffStart / desktopSvgWidth) * 100}%`} stopColor="white" stopOpacity="1" />
                    <stop offset={`${(desktopMaskCutoff.cutoffEnd / desktopSvgWidth) * 100}%`} stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <mask id={`${uniqueId}-desktopMask`}>
                    <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopFadeMask)`} />
                  </mask>
                  {/* Gradient mask for highlight effect - peaks at hovered node, fades to 0 at edges */}
                  {desktopGradientStops && (() => {
                    const { hoveredX, leftFadeStart, leftFadeEnd, rightFadeStart, rightFadeEnd, immediateLeftX, immediateRightX, secondLeftX, secondRightX } = desktopGradientStops;
                    const leftFadeStartPercent = (leftFadeStart / desktopSvgWidth) * 100;
                    const leftFadeEndPercent = (leftFadeEnd / desktopSvgWidth) * 100;
                    const hoveredPercent = (hoveredX / desktopSvgWidth) * 100;
                    const rightFadeStartPercent = (rightFadeStart / desktopSvgWidth) * 100;
                    const rightFadeEndPercent = Math.min((rightFadeEnd / desktopSvgWidth) * 100, 100);
                    const immediateLeftPercent = Math.max(0, (immediateLeftX / desktopSvgWidth) * 100);
                    const immediateRightPercent = Math.min((immediateRightX / desktopSvgWidth) * 100, 100);
                    const secondLeftPercent = Math.max(0, (secondLeftX / desktopSvgWidth) * 100);
                    const secondRightPercent = Math.min((secondRightX / desktopSvgWidth) * 100, 100);
                    const fadeCutoffPercent = (desktopMaskCutoff.cutoffStart / desktopSvgWidth) * 100;
                    
                    return (
                      <>
                        {/* Line opacity masks: 100% for immediate segments, 80% for second segments, 60% elsewhere */}
                        {/* 100% opacity mask: segments connecting to hovered node - linear transition 100% to 80% */}
                        <linearGradient 
                          id={`${uniqueId}-desktopLine100Gradient`} 
                          x1="0%" 
                          y1="0%" 
                          x2="100%" 
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="white" stopOpacity="0" />
                          {/* Hidden before immediate segments */}
                          <stop offset={`${Math.max(0, immediateLeftPercent - 0.001)}%`} stopColor="white" stopOpacity="0" />
                          {/* Linear transition from 80% (at node 1 step away) to 100% (at hovered node) */}
                          <stop offset={`${immediateLeftPercent}%`} stopColor="white" stopOpacity="0.8" />
                          <stop offset={`${hoveredPercent}%`} stopColor="white" stopOpacity="1" />
                          {/* Linear transition from 100% (at hovered node) to 80% (at node 1 step away) */}
                          <stop offset={`${immediateRightPercent}%`} stopColor="white" stopOpacity="0.8" />
                          <stop offset={`${Math.min(100, immediateRightPercent + 0.001)}%`} stopColor="white" stopOpacity="0" />
                          <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </linearGradient>
                        <mask id={`${uniqueId}-desktopLine100Mask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopLine100Gradient)`} />
                        </mask>
                        {/* 80% opacity mask: segments connecting nodes 1 step away to nodes 2 steps away - linear transition 80% to 60% */}
                        <linearGradient 
                          id={`${uniqueId}-desktopLine80Gradient`} 
                          x1="0%" 
                          y1="0%" 
                          x2="100%" 
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="white" stopOpacity="0" />
                          {/* Hidden before second segments */}
                          <stop offset={`${Math.max(0, secondLeftPercent - 0.001)}%`} stopColor="white" stopOpacity="0" />
                          {/* Linear transition from 60% (at node 2 steps away) to 80% (at node 1 step away) */}
                          <stop offset={`${secondLeftPercent}%`} stopColor="white" stopOpacity="0.6" />
                          <stop offset={`${immediateLeftPercent - 0.001}%`} stopColor="white" stopOpacity="0.8" />
                          {/* Hidden in immediate segments (100% zone) */}
                          <stop offset={`${immediateLeftPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${immediateRightPercent - 0.001}%`} stopColor="white" stopOpacity="0" />
                          {/* Linear transition from 80% (at node 1 step away) to 60% (at node 2 steps away) */}
                          <stop offset={`${immediateRightPercent}%`} stopColor="white" stopOpacity="0.8" />
                          <stop offset={`${secondRightPercent}%`} stopColor="white" stopOpacity="0.6" />
                          <stop offset={`${Math.min(100, secondRightPercent + 0.001)}%`} stopColor="white" stopOpacity="0" />
                          <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </linearGradient>
                        <mask id={`${uniqueId}-desktopLine80Mask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopLine80Gradient)`} />
                        </mask>
                        {/* 60% opacity mask: everywhere else (shows at 60% visibility) */}
                        <linearGradient 
                          id={`${uniqueId}-desktopLine60Gradient`} 
                          x1="0%" 
                          y1="0%" 
                          x2="100%" 
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                          {/* Show 60% layer everywhere - ends exactly at center of nodes 2 steps away */}
                          <stop offset={`${secondLeftPercent - 0.001}%`} stopColor="white" stopOpacity="0.6" />
                          {/* Hide in 80% and 100% zones - starts exactly at center of nodes 2 steps away */}
                          <stop offset={`${secondLeftPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${immediateLeftPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${immediateRightPercent}%`} stopColor="white" stopOpacity="0" />
                          {/* Show 60% layer again - starts exactly at center of nodes 2 steps away */}
                          <stop offset={`${secondRightPercent - 0.001}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${secondRightPercent}%`} stopColor="white" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="white" stopOpacity="0.6" />
                        </linearGradient>
                        <mask id={`${uniqueId}-desktopLine60Mask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopLine60Gradient)`} />
                        </mask>
                        {/* Legacy masks for backward compatibility - will be removed */}
                        <mask id={`${uniqueId}-desktopHighlightMask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopLine100Gradient)`} />
                        </mask>
                        <mask id={`${uniqueId}-desktopDimmingMask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopLine60Gradient)`} />
                        </mask>
                        {/* Fill opacity gradient: overlay shows in 100% and 80% zones, hidden in 60% zones (where base layer shows) */}
                        <linearGradient 
                          id={`${uniqueId}-desktopFillOpacityGradient`} 
                          x1="0%" 
                          y1="0%" 
                          x2="100%" 
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="white" stopOpacity="0" />
                          {/* Overlay hidden in 60% zones - base layer shows here */}
                          <stop offset={`${Math.max(0, secondLeftPercent - 0.001)}%`} stopColor="white" stopOpacity="0" />
                          {/* Linear transition from 0% (at node 2 steps away) to 80% (at node 1 step away) */}
                          <stop offset={`${secondLeftPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${immediateLeftPercent - 0.001}%`} stopColor="white" stopOpacity="0.8" />
                          {/* Linear transition from 80% (at node 1 step away) to 100% (at hovered node) */}
                          <stop offset={`${immediateLeftPercent}%`} stopColor="white" stopOpacity="0.8" />
                          <stop offset={`${hoveredPercent}%`} stopColor="white" stopOpacity="1" />
                          {/* Linear transition from 100% (at hovered node) to 80% (at node 1 step away) */}
                          <stop offset={`${immediateRightPercent}%`} stopColor="white" stopOpacity="0.8" />
                          {/* Linear transition from 80% (at node 1 step away) to 0% (at node 2 steps away) */}
                          <stop offset={`${secondRightPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${Math.min(100, secondRightPercent + 0.001)}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${Math.min(fadeCutoffPercent, secondRightPercent + 5)}%`} stopColor="white" stopOpacity="0" />
                          {/* Original fade mask cutoff - overlay hidden */}
                          <stop offset={`${fadeCutoffPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </linearGradient>
                        <mask id={`${uniqueId}-desktopFillOpacityMask`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopFillOpacityGradient)`} />
                        </mask>
                        {/* Base fill mask: completely hide base layer in highlighted areas (100% and 80% zones), show it elsewhere */}
                        <linearGradient 
                          id={`${uniqueId}-desktopFillBaseMask`} 
                          x1="0%" 
                          y1="0%" 
                          x2="100%" 
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="white" stopOpacity="1" />
                          {/* Show base layer (60% opacity) everywhere - linear transition to 0% at nodes 2 steps away */}
                          <stop offset={`${Math.max(0, secondLeftPercent - 0.001)}%`} stopColor="white" stopOpacity="1" />
                          {/* Linear transition from 1 (60% visible) to 0 (hidden) as overlay fades in from 0% to 80% */}
                          <stop offset={`${secondLeftPercent}%`} stopColor="white" stopOpacity="1" />
                          <stop offset={`${immediateLeftPercent - 0.001}%`} stopColor="white" stopOpacity="0" />
                          {/* Hidden in 80% and 100% zones */}
                          <stop offset={`${immediateLeftPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${immediateRightPercent - 0.001}%`} stopColor="white" stopOpacity="0" />
                          {/* Linear transition from 0 (hidden) to 1 (60% visible) as overlay fades out from 80% to 0% */}
                          <stop offset={`${immediateRightPercent}%`} stopColor="white" stopOpacity="0" />
                          <stop offset={`${secondRightPercent}%`} stopColor="white" stopOpacity="1" />
                          {/* Original fade mask cutoff - base layer should fade out here */}
                          <stop offset={`${fadeCutoffPercent}%`} stopColor="white" stopOpacity="1" />
                          <stop offset="100%" stopColor="white" stopOpacity="0" />
                        </linearGradient>
                        <mask id={`${uniqueId}-desktopFillBaseMaskElement`}>
                          <rect x="0" y="0" width={desktopSvgWidth} height={desktopSvgHeight} fill={`url(#${uniqueId}-desktopFillBaseMask)`} />
                        </mask>
                      </>
                    );
                  })()}
                </defs>
                {/* Base fill - always rendered, opacity controlled for smooth transitions */}
                {/* Smooth transition when entering hover, no transition when leaving to prevent darker appearance */}
                <path
                  d={desktopFillPath}
                  fill={`url(#${uniqueId}-desktopGradient)`}
                  mask={desktopGradientStops ? `url(#${uniqueId}-desktopFillBaseMaskElement)` : `url(#${uniqueId}-desktopMask)`}
                  opacity={desktopGradientStops ? "0.6" : "1"}
                  style={desktopGradientStops ? { 
                    transition: 'opacity 0.2s ease-out',
                  } : {
                    // No transition when not hovering - ensures instant update
                  }}
                />
                {/* Fill overlay with gradient opacity - 100% for immediate segments, 80% for second segments, 60% for rest */}
                {/* Appears instantly when entering, disappears instantly when leaving to prevent darker appearance */}
                <path
                  d={desktopFillPath}
                  fill={`url(#${uniqueId}-desktopGradient)`}
                  mask={desktopGradientStops ? `url(#${uniqueId}-desktopFillOpacityMask)` : `url(#${uniqueId}-desktopMask)`}
                  opacity={desktopGradientStops ? "1" : "0"}
                  style={{ 
                    transition: 'opacity 0s',
                    pointerEvents: 'none',
                    willChange: 'opacity',
                  }}
                />
                {/* Base line - always rendered, opacity controlled for instant transitions */}
                {/* Line at 60% opacity - mask controls visibility to 60% */}
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  mask={desktopGradientStops ? `url(#${uniqueId}-desktopLine60Mask)` : undefined}
                  opacity={desktopGradientStops ? "1" : "0"}
                />
                {/* Line at 80% opacity - mask controls visibility to 80% */}
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  mask={desktopGradientStops ? `url(#${uniqueId}-desktopLine80Mask)` : undefined}
                  opacity={desktopGradientStops ? "1" : "0"}
                />
                {/* Line at 100% opacity - mask controls visibility to 100% */}
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  mask={desktopGradientStops ? `url(#${uniqueId}-desktopLine100Mask)` : undefined}
                  opacity={desktopGradientStops ? "1" : "0"}
                />
                {/* Base line at full opacity when not hovering */}
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={desktopGradientStops ? "0" : "1"}
                />
              </svg>

              {/* Nodes */}
              <div className="flex items-start gap-2 md:gap-8 relative"> {/* Mobile gap-2 (8px) */}
                {brews.map((brew, index) => {
                  const dotColor = getDotColor(brew.quality);
                  const dotBorderColor = getDotBorderColor(brew.quality);
                  
                  // Calculate Y position with last rated quality tracking
                  let lastRatedQuality: number | null = null;
                  for (let i = 0; i < index; i++) {
                    if (brews[i].quality) {
                      lastRatedQuality = brews[i].quality;
                    }
                  }
                  
                  // Use window width to determine if mobile for node positioning
                  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                  const yPos = getYPosition(brew.quality, lastRatedQuality, isMobile);
                  const isUnrated = !brew.quality;
                  const isNewest = index === brews.length - 1;

                  const isHovered = hoveredNodeIndex === index;
                  
                  // Calculate opacity: desktop only - hovered node = 1.0, adjacent nodes = 0.8, others = 0.6
                  let nodeOpacity = 1;
                  if (!isMobile && hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length) {
                    if (isHovered) {
                      nodeOpacity = 1.0; // Hovered node at full opacity
                    } else if (Math.abs(index - hoveredNodeIndex) === 1) {
                      nodeOpacity = 0.8; // Adjacent nodes at 80%
                    } else {
                      nodeOpacity = 0.6; // Everything else at 60%
                    }
                  }

                  return (
                    <div 
                      key={brew.id} 
                      ref={(el) => { nodeRefs.current[index] = el; }}
                      className="flex flex-col items-center min-w-[60px] md:min-w-[80px]"
                      style={{ opacity: nodeOpacity, transition: 'opacity 0.2s' }}
                    >
                      {/* Node Circle - centered on the curve */}
                      <button
                        onClick={() => onSelectBrew(brew)}
                        className={`w-2.5 h-2.5 rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 relative z-10 border-2 ${
                          isUnrated 
                            ? 'border-dashed bg-transparent border-gray-400' 
                            : `${dotColor} ${dotBorderColor} ${isNewest ? 'animate-radiate' : ''}`
                        }`}
                        style={{ 
                          marginTop: `${yPos - 5}px`,
                          opacity: 1,
                          backgroundColor: isUnrated ? 'transparent' : undefined,
                          ...(brew.quality === 2 ? {
                            backgroundColor: 'oklch(0.76 0.18 88.84)',
                            borderColor: 'oklch(0.76 0.18 88.84)'
                          } : {})
                        }}
                        title={isUnrated ? 'Click to rate this brew' : ''}
                      >
                      </button>
                    </div>
                  );
                })}

                {/* Add Extraction Button */}
                {coffeeId && brewMethod && onAddExtraction && (() => {
                  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                  const buttonMarginTop = isMobile ? 33 : 48; // Mobile: 45-12=33, Desktop: 60-12=48
                  
                  const isOtherNodeHovered = hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length;
                  
                  return (
                    <div 
                      className="flex flex-col items-center min-w-[60px] md:min-w-[80px]"
                      style={{ opacity: 1 }}
                    >
                      {/* Vertically centered button - responsive for mobile height */}
                      <button
                        onClick={() => onAddExtraction(coffeeId, brewMethod)}
                        onMouseEnter={() => setIsButtonHovered(true)}
                        onMouseLeave={() => setIsButtonHovered(false)}
                        className="w-6 h-6 rounded-full text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 relative z-10"
                        style={{ 
                          marginTop: `${buttonMarginTop}px`,
                          backgroundColor: (isButtonHovered || hoveredNodeIndex === brews.length) 
                            ? '#111827' 
                            : (isOtherNodeHovered ? '#d1d5db' : '#b7bcc5'),
                          transition: 'background-color 0.2s',
                          boxShadow: hoveredNodeIndex === brews.length ? '0 0 0 2px #d1d5db' : undefined
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Date/Time labels below graph */}
            <div className="flex items-start gap-2 md:gap-8 relative mt-3"> {/* Match node spacing gap-2 */}
              {brews.map((brew, index) => {
                const { date, time } = formatNodeDateTime(brew.createdAt, index < brews.length - 1 ? brews[index + 1].createdAt : null);
                const isHovered = hoveredNodeIndex === index;
                
                // Calculate opacity: desktop only - hovered node = 1.0, adjacent nodes = 0.8, others = 0.6
                let labelOpacity = 1;
                const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
                if (!isMobileView && hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length) {
                  if (isHovered) {
                    labelOpacity = 1.0; // Hovered node at full opacity
                  } else if (Math.abs(index - hoveredNodeIndex) === 1) {
                    labelOpacity = 0.8; // Adjacent nodes at 80%
                  } else {
                    labelOpacity = 0.6; // Everything else at 60%
                  }
                }

                const firstSuggestion = brew.suggestion?.full?.suggestions?.[0];
                const hasSuggestion = firstSuggestion && 
                  (firstSuggestion.confidence === 'Medium' || firstSuggestion.confidence === 'High');

                return (
                  <div 
                    key={brew.id} 
                    className="flex flex-col items-center text-center min-w-[60px] md:min-w-[80px]"
                    style={{ opacity: labelOpacity, transition: 'opacity 0.2s' }}
                  >
                    <div 
                      className="text-xs text-gray-900 whitespace-nowrap"
                      style={{ 
                        fontWeight: 'var(--font-weight-normal)'
                      }}
                    >
                      {date}
                    </div>
                    <div 
                      className="text-xs text-gray-500 whitespace-nowrap"
                      style={{ 
                        fontWeight: 'var(--font-weight-normal)'
                      }}
                    >
                      {time}
                    </div>
                  </div>
                );
              })}

              {/* Empty space for button alignment */}
              {coffeeId && brewMethod && onAddExtraction && (
                <div className="min-w-[60px] md:min-w-[80px]"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}