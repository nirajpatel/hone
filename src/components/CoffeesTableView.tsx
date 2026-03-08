import { Coffee, BrewMethod } from '../types';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Plus, MoreVertical, Pencil, Trash2, QrCode } from 'lucide-react';
import { SimpleTooltip } from './ui/simple-tooltip';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { getRatingEmoji, getRatingText } from '../utils/formatters';
import React from 'react';
import { CoffeesMobileListView } from './CoffeesMobileListView';

interface CoffeesTableViewProps {
  coffees: Coffee[];
  brews: Brew[];
  filterMethod: BrewMethod | 'all';
  groupBy: 'month' | 'coffee';
  onNewCoffee: () => void;
  onSelectCoffee: (coffee: Coffee) => void;
  onEditCoffee: (coffee: Coffee) => void;
  onDuplicateCoffee?: (coffee: Coffee) => void;
  onDeleteCoffee: (id: string) => void;
  onPrintQR?: (coffee: Coffee) => void;
}

export function CoffeesTableView({
  coffees,
  brews,
  filterMethod,
  groupBy,
  onNewCoffee,
  onSelectCoffee,
  onEditCoffee,
  onDuplicateCoffee,
  onDeleteCoffee,
  onPrintQR,
}: CoffeesTableViewProps) {
  // Format date for display (same as brews table)
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[date.getMonth()];
    const dayNum = date.getDate();
    const yearNum = date.getFullYear();
    const currentYear = new Date().getFullYear();
    
    // Check if date is today or yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (checkDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    // Show year only if different from current year
    if (yearNum !== currentYear) {
      return `${monthName} ${dayNum}, ${yearNum}`;
    }
    return `${monthName} ${dayNum}`;
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

  // Get days old
  const getDaysOld = (roastDate: string): string => {
    if (!roastDate) return '–';
    
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

  const getExactDaysOld = (roastDate: string): string => {
    const [year, month, day] = roastDate.split('-').map(Number);
    const roast = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    roast.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - roast.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} old`;
  };

  // Get coffee average rating
  const getCoffeeAverageRating = (coffeeId: string): { rating: number; count: number } => {
    const coffeeBrews = brews.filter(e => e.coffeeId === coffeeId && e.quality);
    if (coffeeBrews.length === 0) return { rating: 0, count: 0 };
    const sum = coffeeBrews.reduce((acc, e) => acc + (e.quality || 0), 0);
    return { 
      rating: Math.round(sum / coffeeBrews.length),
      count: coffeeBrews.length
    };
  };

  // Filter coffees
  const filteredCoffees = coffees.filter(coffee => {
    if (filterMethod === 'all') return true;
    const coffeeBrews = brews.filter(e => e.coffeeId === coffee.id);
    return coffeeBrews.some(e => e.brewMethod === filterMethod);
  });

  // Sort coffees by roast date descending (most recent first)
  // Coffees without roast dates go to the end
  const sortedCoffees = [...filteredCoffees].sort((a, b) => {
    // If both have roast dates, sort normally
    if (a.roastDate && b.roastDate) {
    const dateA = new Date(a.roastDate);
    const dateB = new Date(b.roastDate);
    return dateB.getTime() - dateA.getTime();
    }
    // If only a has no roast date, put it after b
    if (!a.roastDate && b.roastDate) return 1;
    // If only b has no roast date, put it after a
    if (a.roastDate && !b.roastDate) return -1;
    // If both have no roast date, maintain order
    return 0;
  });

  // Group coffees
  const groupedCoffees: Record<string, Coffee[]> = {};
  
  if (groupBy === 'month') {
    sortedCoffees.forEach(coffee => {
      if (!coffee.roastDate) {
        // Add to Unknown group
        if (!groupedCoffees['Unknown']) {
          groupedCoffees['Unknown'] = [];
        }
        groupedCoffees['Unknown'].push(coffee);
      } else {
      const [year, monthNum] = coffee.roastDate.split('-').map(Number);
      const date = new Date(year, monthNum - 1);
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const month = months[date.getMonth()];
      const monthYear = `${month} ${date.getFullYear()}`;
      if (!groupedCoffees[monthYear]) {
        groupedCoffees[monthYear] = [];
      }
      groupedCoffees[monthYear].push(coffee);
      }
    });
  } else {
    sortedCoffees.forEach(coffee => {
      const label = coffee.roaster;
      if (!groupedCoffees[label]) {
        groupedCoffees[label] = [];
      }
      groupedCoffees[label].push(coffee);
    });
  }

  return (
    <>
      {/* Table */}
      {filteredCoffees.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-8rem)] flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center min-h-0">
            <div className="empty-state-card-md bg-white rounded-lg border border-gray-200 p-0 md:p-16 text-center" style={{ marginTop: '-2rem' }}>
            <div className="max-w-lg mx-auto">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {filterMethod !== 'all' ? 'No Coffees Found' : 'No coffees yet'}
              </h3>
              <p className="text-base text-gray-600 mb-6">
                {filterMethod !== 'all' ? (
                  'Try changing the filter or add a new coffee'
                ) : (
                  'Add your coffee to start logging brews and getting personalized guidance.'
                )}
              </p>
              <Button onClick={onNewCoffee} className="cursor-pointer">
                <Plus className="w-4 h-4" />
                Add Beans
              </Button>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile View (iOS messages style) - shown on small screens */}
          <div className="md:hidden">
            <CoffeesMobileListView
              coffees={filteredCoffees}
              brews={brews}
              onSelectCoffee={onSelectCoffee}
              groupBy={groupBy}
            />
          </div>
          
          {/* Desktop Table View - shown on md and larger */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader className="border-b-0">
                <TableRow>
                  <TableHead className="px-6">Coffee Name</TableHead>
                  <TableHead className="px-6">Roaster</TableHead>
                  <TableHead className="px-6">Freshness</TableHead>
                  <TableHead className="px-6">Roast Date</TableHead>
                  <TableHead className="px-6">Extraction Quality</TableHead>
                  <TableHead className="px-6 w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoffees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 whitespace-normal">
                      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500 font-normal max-w-md mx-auto">
                        No coffees found. {filterMethod !== 'all' ? 'Try changing the filter or add a new one!' : 'Add your first one!'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(groupedCoffees)
                    .sort((a, b) => {
                      // Put "Unknown" group at the end
                      if (a[0] === 'Unknown') return 1;
                      if (b[0] === 'Unknown') return -1;
                      // For month grouping, sort by date descending (most recent first)
                      if (groupBy === 'month') {
                        const dateA = new Date(a[0]);
                        const dateB = new Date(b[0]);
                        // If dates are invalid (shouldn't happen), maintain order
                        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
                        return dateB.getTime() - dateA.getTime();
                      }
                      // For roaster grouping, sort alphabetically
                      return a[0].localeCompare(b[0]);
                    })
                    .map(([groupLabel, groupCoffees]) => (
                    <React.Fragment key={`group-${groupLabel}`}>
                      <TableRow>
                        <TableCell colSpan={7} className="px-6 py-3 bg-gray-100 mobile-group-header" style={{ textAlign: 'left' }}>
                          <span className="text-gray-900" style={{ fontWeight: 'var(--font-weight-medium)' }}>{groupLabel}</span>
                        </TableCell>
                      </TableRow>
                      {groupCoffees.map((coffee) => {
                        const freshness = getFreshness(coffee.roastDate);
                        return (
                        <TableRow key={coffee.id} className="hover:bg-gray-50">
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectCoffee(coffee)} data-label="Coffee:">{coffee.name}</TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectCoffee(coffee)} data-label="Roaster:">{coffee.roaster}</TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectCoffee(coffee)} data-label="Freshness:">
                            {!coffee.roastDate ? (
                              <span className="text-gray-400">—</span>
                            ) : freshness.tooltip ? (
                              <SimpleTooltip content={
                                <div className="text-xs">
                                  {freshness.tooltip.split('\n').map((line, index) => (
                                    <div key={index}>{line}</div>
                                  ))}
                                </div>
                              }>
                                <div className="flex items-center gap-2 cursor-help">
                                  <span>{freshness.emoji}</span>
                                  <span className="text-sm text-gray-900">{freshness.label} • {getDaysOld(coffee.roastDate)}</span>
                                </div>
                              </SimpleTooltip>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span>{freshness.emoji}</span>
                                <span className="text-sm text-gray-900">{freshness.label} • {getDaysOld(coffee.roastDate)}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectCoffee(coffee)} data-label="Roast Date:">
                            {!coffee.roastDate ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              formatDate(coffee.roastDate)
                            )}
                          </TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectCoffee(coffee)} data-label="Quality:">
                            {(() => {
                              const { rating, count } = getCoffeeAverageRating(coffee.id);
                              if (!rating) {
                                return <span className="text-gray-400">—</span>;
                              }
                              return (
                                <div className="flex items-center gap-1 md:gap-2">
                                  <span className="text-lg">{getRatingEmoji(rating)}</span>
                                  <span className="text-gray-900 text-sm">
                                    {getRatingText(rating)}
                                    {count > 0 && ` (${count} brew${count !== 1 ? 's' : ''})`}
                                  </span>
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="px-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer active:bg-accent data-[state=open]:bg-accent transition-colors">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {onDuplicateCoffee && (
                                  <DropdownMenuItem onSelect={() => onDuplicateCoffee(coffee)} className="cursor-pointer">
                                    <Plus className="w-4 h-4" />
                                    Add Another Bag
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onEditCoffee(coffee)} className="cursor-pointer">
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </DropdownMenuItem>
                                {onPrintQR && (
                                  <DropdownMenuItem onSelect={() => onPrintQR(coffee)} className="cursor-pointer">
                                    <QrCode className="w-4 h-4" />
                                    Print Label
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => onDeleteCoffee(coffee.id)} className="cursor-pointer">
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}