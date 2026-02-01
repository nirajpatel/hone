import { useState, useEffect, useRef } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment } from '../types';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Copy, Check, Plus, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getRatingEmoji, capitalizeBrewMethod } from '../utils/formatters';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { BrewsToolbar } from './BrewsToolbar';
import { line, area, curveMonotoneX } from 'd3-shape';

interface BrewsTimelineViewProps {
  brews: Brew[];
  coffees: Coffee[];
  users: User[];
  filterMethod: BrewMethod | 'all';
  onFilterMethodChange: (method: BrewMethod | 'all') => void;
  onNewBrew: () => void;
  onSelectBrew: (brew: Brew) => void;
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
      {/* Toolbar */}
      <BrewsToolbar
        filterMethod={filterMethod}
        onFilterMethodChange={onFilterMethodChange}
        onNewBrew={onNewBrew}
        view={view || 'timeline'}
        onViewChange={onViewChange!}
        equipment={equipment}
        coffees={coffees}
      />

      {/* Timeline Cards */}
      <div className="space-y-2 md:space-y-4 md:mt-0 mt-4">
        {sortedGroups.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {filterMethod !== 'all' ? 'No Brews Found' : 'No Brews Yet'}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {filterMethod !== 'all' ? (
                  'Try changing the filter or create a new brew'
                ) : (
                  'Get started by adding equipment and coffee, then log your first brew'
                )}
              </p>
              {filterMethod === 'all' && (
                <div className="flex gap-3 justify-center">
                  {!hasCompleteEquipment() ? (
                    <Button 
                      onClick={onOpenEquipment}
                      variant="outline"
                      className="cursor-pointer"
                    >
                      Add Equipment
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      className="bg-green-50 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300 cursor-default"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Equipment Added
                    </Button>
                  )}
                  {coffees.length === 0 ? (
                    <Button 
                      onClick={onOpenAddCoffee}
                      variant="outline"
                      className="cursor-pointer"
                    >
                      Add Coffee
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      className="bg-green-50 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-700 hover:border-green-300 cursor-default"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Coffee Added
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          sortedGroups.map(([key, group]) => {
            // Sort brews by date ascending for timeline (oldest to newest left to right)
            const sortedExtractions = [...group.brews].sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            // Get the coffee ID from the first brew
            const coffeeId = sortedExtractions[0]?.coffeeId;

            // Calculate trend for this group
            const trendInfo = calculateTrend(sortedExtractions);

            return (
              <div key={key} className="bg-white rounded-lg border border-gray-200 p-3 md:p-4 mobile-timeline-card">
                {/* Header with Coffee and Method */}
                <div className="mb-3">
                  <h3 className="text-gray-900" style={{ fontWeight: 'var(--font-weight-medium)' }}>{group.roaster} – {group.coffeeName} • {capitalizeBrewMethod(group.method)}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                    <span>{sortedExtractions.length} {sortedExtractions.length === 1 ? 'brew' : 'brews'}</span>
                    <span className="hidden md:inline">•</span>
                    <span className="hidden md:inline">Last brewed {formatLastBrewedDate(group.lastExtractionDate)}</span>
                    {trendInfo && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {trendInfo.icon}
                          <span className="capitalize">{trendInfo.trend}</span>
                        </span>
                      </>
                    )}
                  </p>
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
          })
        )}
      </div>
    </>
  );
}

// Counter for generating unique IDs for each timeline
let timelineIdCounter = 0;

interface TimelineRowProps {
  brews: Brew[];
  onSelectBrew: (brew: Brew) => void;
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

  const mobileGraphPath = calculateGraphPath(true);
  const desktopGraphPath = calculateGraphPath(false);

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
          className="relative overflow-x-auto pb-2 cursor-pointer"
          style={{ 
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f1f5f9'
          }}
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
              {/* Vertical indicator line - positioned relative to content */}
              {/* Don't show line if add button is closest */}
              {hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length && mouseX !== null && (
                <>
                  {/* Mobile line - stops at graph height */}
                  <div
                    className="absolute pointer-events-none md:hidden"
                    style={{
                      left: `${mouseX}px`,
                      top: '0px',
                      height: '90px',
                      width: '2px',
                      background: 'repeating-linear-gradient(to bottom, var(--color-gray-300) 0px, var(--color-gray-300) 4px, transparent 4px, transparent 8px)',
                      transform: 'translateX(-50%)',
                      zIndex: 0
                    }}
                  />
                  {/* Desktop line - stops at graph height */}
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
                </>
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
                <path
                  d={mobileFillPath}
                  fill={`url(#${uniqueId}-mobileGradient)`}
                  mask={`url(#${uniqueId}-mobileMask)`}
                  opacity={hoveredNodeIndex !== null && hoveredNodeIndex < brews.length ? 0.6 : 1}
                />
                <path
                  d={mobileGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredNodeIndex !== null && hoveredNodeIndex < brews.length ? 0.6 : 1}
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
                </defs>
                <path
                  d={desktopFillPath}
                  fill={`url(#${uniqueId}-desktopGradient)`}
                  mask={`url(#${uniqueId}-desktopMask)`}
                  opacity={hoveredNodeIndex !== null && hoveredNodeIndex < brews.length ? 0.6 : 1}
                />
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={hoveredNodeIndex !== null && hoveredNodeIndex < brews.length ? 0.6 : 1}
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

                  return (
                    <div 
                      key={brew.id} 
                      ref={(el) => { nodeRefs.current[index] = el; }}
                      className="flex flex-col items-center min-w-[60px] md:min-w-[80px]"
                      style={{ opacity: hoveredNodeIndex !== null && hoveredNodeIndex !== index ? 0.6 : 1, transition: 'opacity 0.2s' }}
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
                  
                  return (
                    <div 
                      className="flex flex-col items-center min-w-[60px] md:min-w-[80px]"
                      style={{ opacity: hoveredNodeIndex !== null && hoveredNodeIndex !== brews.length ? 0.6 : 1, transition: 'opacity 0.2s' }}
                    >
                      {/* Vertically centered button - responsive for mobile height */}
                      <button
                        onClick={() => onAddExtraction(coffeeId, brewMethod)}
                        onMouseEnter={() => setIsButtonHovered(true)}
                        onMouseLeave={() => setIsButtonHovered(false)}
                        className="w-6 h-6 rounded-full text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 relative z-10"
                        style={{ 
                          marginTop: `${buttonMarginTop}px`,
                          backgroundColor: (isButtonHovered || hoveredNodeIndex === brews.length) ? '#111827' : '#b7bcc5',
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

                return (
                  <div 
                    key={brew.id} 
                    className="flex flex-col items-center text-center min-w-[60px] md:min-w-[80px]"
                    style={{ opacity: hoveredNodeIndex !== null && hoveredNodeIndex !== index ? 0.6 : 1, transition: 'opacity 0.2s' }}
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