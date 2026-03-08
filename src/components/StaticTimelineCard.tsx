import { useState, useEffect } from 'react';
import { Brew, Coffee } from '../types';
import { capitalizeBrewMethod } from '../utils/formatters';
import { line, area, curveMonotoneX } from 'd3-shape';
import { Sparkles } from 'lucide-react';

interface StaticTimelineCardProps {
  coffee: Coffee;
  brews: Brew[];
}

export function StaticTimelineCard({ coffee, brews }: StaticTimelineCardProps) {
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Generate hardcoded brews based on screen size
  const generateHardcodedBrews = (): Brew[] => {
    const baseBrew: Omit<Brew, 'id' | 'quality'> = {
      coffeeId: coffee.id,
      coffeeName: coffee.name,
      roaster: coffee.roaster,
      brewMethod: 'espresso',
      grindSetting: '5',
      dosage: 18,
      brewTime: 30,
      finalWeight: 36,
      coffeeTemperature: 'room-temperature',
      userId: 'static-user-1',
      userName: 'User',
      createdAt: '',
      timezoneOffset: -480,
    };

    let qualities: (number | null)[] = [];

    if (windowWidth < 768) {
      // Mobile: 10 nodes
      // Right to left (newest to oldest): green, green, green, yellow, yellow, red, yellow, yellow, red, red
      // Array is oldest to newest, so: [1, 1, 2, 2, 1, 2, 2, 3, 3, 3]
      qualities = [1, 1, 2, 1, 2, 1, 2, 2, 3, 3];
    } else if (windowWidth <= 1024) {
      // Tablet: 8 nodes
      // Right to left (newest to oldest): green, green, green, yellow, yellow, red, yellow, red
      // Array is oldest to newest, so: [1, 2, 1, 2, 2, 3, 3, 3]
      qualities = [1, 2, 1, 2, 2, 3, 3, 3];
    } else {
      // Desktop: Keep last 6 nodes from original data, then add a green node at the end
      const sortedOriginal = [...brews].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const last6Nodes = sortedOriginal.slice(-6);
      
      // Add a green node at the end
      const today = new Date();
      const baseBrew: Omit<Brew, 'id' | 'quality'> = {
        coffeeId: sortedOriginal[0]?.coffeeId || coffee.id,
        coffeeName: sortedOriginal[0]?.coffeeName || coffee.name,
        roaster: sortedOriginal[0]?.roaster || coffee.roaster,
        brewMethod: sortedOriginal[0]?.brewMethod || 'espresso',
        grindSetting: sortedOriginal[0]?.grindSetting || '5',
        dosage: sortedOriginal[0]?.dosage || 18,
        brewTime: sortedOriginal[0]?.brewTime || 30,
        finalWeight: sortedOriginal[0]?.finalWeight || 36,
        coffeeTemperature: sortedOriginal[0]?.coffeeTemperature || 'room-temperature',
        userId: sortedOriginal[0]?.userId || 'static-user-1',
        userName: sortedOriginal[0]?.userName || 'User',
        createdAt: '',
        timezoneOffset: sortedOriginal[0]?.timezoneOffset || -480,
      };
      
      const newGreenNode: Brew = {
        ...baseBrew,
        id: `desktop-green-node-${Date.now()}`,
        quality: 3,
        createdAt: today.toISOString(),
        suggestion: {
          concise: { goal: 'Improve extraction', action: 'Increase temperature', confidence: 'High' },
          full: {
            summary: 'Excellent balance achieved',
            primaryIssue: 'None',
            suggestions: [{
              parameter: 'Temperature',
              action: 'Increase temperature',
              effect: 'Improve extraction',
              reasoning: 'Current recipe is dialed in',
              confidence: 'High'
            }]
          }
        }
      } as Brew;
      
      return [...last6Nodes, newGreenNode];
    }

    // Generate brews with hardcoded qualities
    const today = new Date();
    const generatedBrews: Brew[] = qualities.map((quality, index) => {
      const daysFromEnd = qualities.length - 1 - index;
      const brewDate = new Date(today);
      brewDate.setDate(today.getDate() - daysFromEnd);
      
      return {
        ...baseBrew,
        id: `hardcoded-brew-${index}`,
        quality: quality,
        createdAt: brewDate.toISOString(),
        ...(index === qualities.length - 1 && quality === 3 ? {
          suggestion: {
            concise: { goal: 'Improve extraction', action: 'Increase temperature', confidence: 'High' },
            full: {
              summary: 'Excellent balance achieved',
              primaryIssue: 'None',
              suggestions: [{
                parameter: 'Temperature',
                action: 'Increase temperature',
                effect: 'Improve extraction',
                reasoning: 'Current recipe is dialed in',
                confidence: 'High'
              }]
            }
          }
        } : {})
      } as Brew;
    });

    return generatedBrews;
  };

  // Use hardcoded brews based on screen size
  const sortedBrews = generateHardcodedBrews();

  // Format last brewed date
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

  const lastBrewDate = new Date(); // Always use today's date

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
    
    let shouldShowYear = false;
    const currentYear = new Date().getFullYear();
    
    if (nextDateString) {
      const nextDate = new Date(nextDateString);
      const nextYear = nextDate.getFullYear();
      if (year !== nextYear && year !== currentYear) {
        shouldShowYear = true;
      }
    } else {
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

  // Get Y position based on rating
  const getYPosition = (quality: number | null, lastRatedQuality: number | null = null, isMobile: boolean = false) => {
    if (!quality) {
      return lastRatedQuality ? getYPosition(lastRatedQuality, null, isMobile) : (isMobile ? 45 : 60);
    }
    if (isMobile) {
      switch (quality) {
        case 1: return 75;
        case 2: return 45;
        case 3: return 15;
        default: return 45;
      }
    }
    switch (quality) {
      case 1: return 100;
      case 2: return 60;
      case 3: return 20;
      default: return 60;
    }
  };

  // Get dot color
  const getDotColor = (quality: number | null) => {
    if (!quality) return 'bg-gray-300';
    switch (quality) {
      case 1: return '[background-color:oklch(58%_0.23_28)]';
      case 2: return '[background-color:oklch(0.76_0.18_88.84)]';
      case 3: return '[background-color:oklch(58%_0.22_149)]';
      default: return 'bg-gray-300';
    }
  };

  const getDotBorderColor = (quality: number | null) => {
    if (!quality) return 'border-gray-400';
    switch (quality) {
      case 1: return '[border-color:oklch(58%_0.23_28)]';
      case 2: return '[border-color:oklch(0.76_0.18_88.84)]';
      case 3: return '[border-color:oklch(58%_0.22_149)]';
      default: return 'border-gray-400';
    }
  };

  // Calculate SVG dimensions
  const mobileContainerWidth = 60;
  const desktopContainerWidth = 80;
  const mobileGap = 24;
  const desktopGap = 32;
  const mobileSvgHeight = 90;
  const desktopSvgHeight = 120;

  // Calculate graph path
  const calculateGraphPath = (isMobile: boolean) => {
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    const svgHeight = isMobile ? mobileSvgHeight : desktopSvgHeight;
    
    // Calculate SVG width to match node distribution
    const nodeCount = sortedBrews.length;
    const svgWidth = nodeCount > 1 
      ? (nodeCount - 1) * (containerWidth + gap) + containerWidth
      : containerWidth;
    
    let lastRatedQuality: number | null = null;
    
    const allExtractions = sortedBrews.map((brew, index) => {
      if (brew.quality) {
        lastRatedQuality = brew.quality;
      }
      
      // Calculate X position: distribute evenly from first node center to last node center
      const firstNodeX = containerWidth / 2;
      const lastNodeX = svgWidth - containerWidth / 2;
      const x = nodeCount > 1 
        ? firstNodeX + (index / (nodeCount - 1)) * (lastNodeX - firstNodeX)
        : containerWidth / 2;
      
      return {
        brew,
        index,
        x: x,
        y: getYPosition(brew.quality, lastRatedQuality, isMobile),
      };
    });

    if (allExtractions.length === 0) return '';

    const points: [number, number][] = allExtractions.map(item => [item.x, item.y]);
    const lineGenerator = line<[number, number]>()
      .x(d => d[0])
      .y(d => d[1])
      .curve(curveMonotoneX);

    return lineGenerator(points) || '';
  };

  // Calculate fill path
  const calculateFillPath = (isMobile: boolean) => {
    const containerWidth = isMobile ? mobileContainerWidth : desktopContainerWidth;
    const gap = isMobile ? mobileGap : desktopGap;
    const svgHeight = isMobile ? mobileSvgHeight : desktopSvgHeight;
    
    // Calculate SVG width to match node distribution
    const nodeCount = sortedBrews.length;
    const svgWidth = nodeCount > 1 
      ? (nodeCount - 1) * (containerWidth + gap) + containerWidth
      : containerWidth;
    
    let lastRatedQuality: number | null = null;
    
    const allExtractions = sortedBrews.map((brew, index) => {
      if (brew.quality) {
        lastRatedQuality = brew.quality;
      }
      
      // Calculate X position: distribute evenly from first node center to last node center
      const firstNodeX = containerWidth / 2;
      const lastNodeX = svgWidth - containerWidth / 2;
      const x = nodeCount > 1 
        ? firstNodeX + (index / (nodeCount - 1)) * (lastNodeX - firstNodeX)
        : containerWidth / 2;
      
      return {
        brew,
        index,
        x: x,
        y: getYPosition(brew.quality, lastRatedQuality, isMobile),
      };
    });

    if (allExtractions.length === 0) return '';

    const points: [number, number][] = allExtractions.map(item => [item.x, item.y]);
    const areaGenerator = area<[number, number]>()
      .x(d => d[0])
      .y0(svgHeight)
      .y1(d => d[1])
      .curve(curveMonotoneX);

    return areaGenerator(points) || '';
  };

  const mobileGraphPath = calculateGraphPath(true);
  const desktopGraphPath = calculateGraphPath(false);
  const mobileFillPath = calculateFillPath(true);
  const desktopFillPath = calculateFillPath(false);

  // Calculate SVG width - ensure it extends to the rightmost node
  // Mobile: For 7 nodes with mobile spacing: 7 * 60 + 6 * 24 = 420 + 144 = 564
  // Desktop: For 7 nodes with desktop spacing: 7 * 80 + 6 * 32 = 560 + 192 = 752
  const nodeCount = sortedBrews.length;
  const mobileSvgWidth = nodeCount > 1 
    ? (nodeCount - 1) * (mobileContainerWidth + mobileGap) + mobileContainerWidth
    : mobileContainerWidth;
  const desktopSvgWidth = nodeCount > 1 
    ? (nodeCount - 1) * (desktopContainerWidth + desktopGap) + desktopContainerWidth
    : desktopContainerWidth;

  // Get brew method
  const brewMethod = sortedBrews[0]?.brewMethod || 'espresso';

  return (
    <>
      <style>{`
        .mobile-timeline-card {
          padding: 0 !important;
        }
        @media (min-width: 1025px) {
          .static-timeline-card h3 {
            line-height: 1.4 !important;
          }
          .static-timeline-card p {
            line-height: 1.4 !important;
          }
          .static-timeline-card .mb-2 {
            margin-bottom: 0.5rem !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .static-timeline-card {
            width: 75% !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .static-timeline-card .mb-2 {
            text-align: center !important;
            margin-bottom: 0.5rem !important;
          }
          .static-timeline-card h3 {
            text-align: center !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
          }
          .static-timeline-card p {
            text-align: center !important;
            justify-content: center !important;
            line-height: 1.4 !important;
          }
        }
        @media (max-width: 767px) {
          .static-timeline-card .mb-2 {
            text-align: center !important;
            margin-bottom: 0.5em !important;
          }
          .static-timeline-card h3 {
            text-align: center !important;
            font-size: 14px !important;
            line-height: 1.4 !important;
            display: block !important;
            margin-bottom: 0 !important;
          }
          .static-timeline-card p {
            text-align: center !important;
            justify-content: center !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            margin-top: 0 !important;
          }
          .static-timeline-card .roaster-label {
            font-size: 10px !important;
            line-height: 1.4 !important;
          }
          .static-timeline-card p svg {
            width: 12px !important;
            height: 12px !important;
          }
          .static-timeline-card .mobile-gap-container {
            gap: 24px !important;
          }
        }
      `}</style>
      <div 
        className="bg-white rounded-lg p-4 mobile-timeline-card static-timeline-card" 
        style={{ 
          borderRadius: '0.5rem'
        }}
      >
      {/* Header */}
      <div className="mb-2">
        <p className="roaster-label text-xs font-medium text-gray-500 uppercase tracking-wide truncate mb-0">{coffee.roaster}</p>
        <h3 className="text-gray-900 mb-0" style={{ fontWeight: 'var(--font-weight-medium)' }}>
          {coffee.name}
        </h3>
        <p className="text-sm text-gray-500 mt-0 flex items-center gap-1">
          <span>{capitalizeBrewMethod(brewMethod)}</span>
          <span>•</span>
          <Sparkles className="w-3.5 h-3.5" />
          <span>Dialed In</span>
        </p>
      </div>

      {/* Timeline */}
      <div className="relative overflow-x-hidden">
        {/* Left fade gradient */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)'
          }}
        />
        <div className="relative pb-2 flex justify-end" style={{ marginRight: 0, paddingRight: 0 }}>
          <div className="relative min-w-max pl-2" style={{ marginRight: 0, paddingRight: 0 }}>
            {/* Graph */}
            <div className="relative h-[90px] md:h-[120px]">
              {/* SVG Graph - Mobile */}
              <svg 
                className="absolute top-0 left-0 md:hidden pointer-events-none"
                width="100%"
                height={mobileSvgHeight}
                style={{ zIndex: 0 }}
                viewBox={`0 0 ${mobileSvgWidth} ${mobileSvgHeight}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="static-mobile-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={mobileFillPath}
                  fill="url(#static-mobile-gradient)"
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
                width="100%"
                height={desktopSvgHeight}
                style={{ zIndex: 0 }}
                viewBox={`0 0 ${desktopSvgWidth} ${desktopSvgHeight}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="static-desktop-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#d1d5db" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={desktopFillPath}
                  fill="url(#static-desktop-gradient)"
                  opacity="1"
                />
                <path
                  d={desktopGraphPath}
                  fill="none"
                  stroke="#d1d5db"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="1"
                />
              </svg>

              {/* Nodes */}
              <div className="flex items-start md:gap-8 relative justify-end mobile-gap-container">
                {sortedBrews.map((brew, index) => {
                  const dotColor = getDotColor(brew.quality);
                  const dotBorderColor = getDotBorderColor(brew.quality);
                  
                  let lastRatedQuality: number | null = null;
                  for (let i = 0; i < index; i++) {
                    if (sortedBrews[i].quality) {
                      lastRatedQuality = sortedBrews[i].quality;
                    }
                  }
                  
                  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
                  const yPos = getYPosition(brew.quality, lastRatedQuality, isMobile);
                  const isUnrated = !brew.quality;
                  const isNewest = index === sortedBrews.length - 1;

                  return (
                    <div 
                      key={brew.id}
                      className="flex flex-col items-center min-w-[60px] md:min-w-[80px]"
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full relative z-10 border-2 ${
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
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Date labels */}
            <div className="flex items-start md:gap-8 relative mt-3 justify-end mobile-gap-container" style={{ display: 'none' }}>
              {sortedBrews.map((brew, index) => {
                // Calculate date: last node is today, subtract one day for each node to the left
                const today = new Date();
                const daysFromEnd = sortedBrews.length - 1 - index;
                const nodeDate = new Date(today);
                nodeDate.setDate(today.getDate() - daysFromEnd);
                
                // Format the date
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = months[nodeDate.getMonth()];
                const day = nodeDate.getDate();
                const year = nodeDate.getFullYear();
                const currentYear = new Date().getFullYear();
                
                let shouldShowYear = false;
                if (index < sortedBrews.length - 1) {
                  // Check if next node (to the right) is in a different year
                  const nextDaysFromEnd = sortedBrews.length - 1 - (index + 1);
                  const nextNodeDate = new Date(today);
                  nextNodeDate.setDate(today.getDate() - nextDaysFromEnd);
                  const nextYear = nextNodeDate.getFullYear();
                  if (year !== nextYear && year !== currentYear) {
                    shouldShowYear = true;
                  }
                } else {
                  // Last node - show year if not current year
                  if (year !== currentYear) {
                    shouldShowYear = true;
                  }
                }
                
                const dateStr = shouldShowYear 
                  ? `${month} ${day} '${year.toString().slice(-2)}`
                  : `${month} ${day}`;

                return (
                  <div 
                    key={brew.id}
                    className="flex flex-col items-center text-center min-w-[60px] md:min-w-[80px]"
                  >
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {dateStr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
