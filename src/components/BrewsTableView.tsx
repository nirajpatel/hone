import { useState } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment } from '../types';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { SimpleTooltip } from './ui/simple-tooltip';
import { capitalizeBrewMethod, getRatingEmoji, getRatingText } from '../utils/formatters';
import { BrewsToolbar } from './BrewsToolbar';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { BrewsMobileListView } from './BrewsMobileListView';

interface BrewsTableViewProps {
  brews: Brew[];
  coffees: Coffee[];
  users: User[];
  filterMethod: BrewMethod | 'all';
  groupBy: 'month' | 'coffee';
  onFilterMethodChange: (method: BrewMethod | 'all') => void;
  onGroupByChange: (groupBy: 'month' | 'coffee') => void;
  onNewBrew: () => void;
  onSelectBrew: (brew: Brew) => void;
  onEditBrew: (brew: Brew) => void;
  onDeleteBrew: (id: string) => void;
  onDuplicateBrew: (brew: Brew) => void;
  hoveredBrewRating: { id: string; rating: number } | null;
  onHoverBrewRating: (data: { id: string; rating: number } | null) => void;
  view?: 'table' | 'timeline';
  onViewChange?: (view: 'table' | 'timeline') => void;
  equipment: Equipment[];
  onAddBrewForCoffee?: (coffeeId: string, brewMethod: BrewMethod) => void;
  onOpenEquipment?: () => void;
  onOpenAddCoffee?: () => void;
}

export function BrewsTableView({
  brews,
  coffees,
  users,
  filterMethod,
  groupBy,
  onFilterMethodChange,
  onGroupByChange,
  onNewBrew,
  onSelectBrew,
  onEditBrew,
  onDeleteBrew,
  onDuplicateBrew,
  hoveredBrewRating,
  onHoverBrewRating,
  view = 'table',
  onViewChange,
  equipment,
  onAddBrewForCoffee,
  onOpenEquipment,
  onOpenAddCoffee,
}: BrewsTableViewProps) {
  // Get all brew method configs
  const brewMethodConfigs = getAllBrewMethodConfigs();

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if we should show the barista column (only if multiple users in household)
  const showBaristaColumn = users.length > 1;

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

  // Format date for display
  const formatDate = (dateString: string, showYear: boolean) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    // Check if date is today or yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Use simplified format for today/yesterday regardless of grouping
    if (checkDate.getTime() === today.getTime()) {
      return `Today at ${displayHours}:${displayMinutes}${ampm}`;
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${displayHours}:${displayMinutes}${ampm}`;
    } else {
      const dateStr = showYear 
        ? `${month} ${day}, ${year}` 
        : `${month} ${day}`;
      return `${dateStr} at ${displayHours}:${displayMinutes}${ampm}`;
    }
  };

  // Filter brews
  const filteredBrews = filterMethod === 'all' 
    ? brews 
    : brews.filter(b => b.brewMethod === filterMethod);

  // Sort brews by date (most recent first) before grouping
  const sortedBrews = [...filteredBrews].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group brews
  const groupedBrews: Record<string, Brew[]> = {};
  
  if (groupBy === 'month') {
    sortedBrews.forEach(brew => {
      const date = new Date(brew.createdAt);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groupedBrews[monthYear]) {
        groupedBrews[monthYear] = [];
      }
      groupedBrews[monthYear].push(brew);
    });
  } else {
    sortedBrews.forEach(brew => {
      const label = `${brew.roaster} — ${brew.coffeeName}`;
      if (!groupedBrews[label]) {
        groupedBrews[label] = [];
      }
      groupedBrews[label].push(brew);
    });
  }

  return (
    <>
      {/* Toolbar */}
      <BrewsToolbar
        filterMethod={filterMethod}
        groupBy={groupBy}
        onFilterMethodChange={onFilterMethodChange}
        onGroupByChange={onGroupByChange}
        onNewBrew={onNewBrew}
        view={view}
        onViewChange={onViewChange!}
        equipment={equipment}
        coffees={coffees}
      />

      {/* Table */}
      {filteredBrews.length === 0 ? (
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
        <>
          {/* Mobile View (iOS messages style) - shown on small screens */}
          <div className="md:hidden">
            <BrewsMobileListView
              brews={filteredBrews}
              onSelectBrew={onSelectBrew}
              groupBy={groupBy}
              users={users}
            />
          </div>
          
          {/* Desktop Table View - shown on md and larger */}
          <div className="hidden md:block bg-white rounded-lg border border-gray-200">
            <Table>
              <TableHeader className="border-b-0">
                <TableRow>
                  <TableHead className="px-6">Date & Time</TableHead>
                  {showBaristaColumn && <TableHead className="px-6">By</TableHead>}
                  <TableHead className="px-6">Coffee</TableHead>
                  <TableHead className="px-6">Method</TableHead>
                  <TableHead className="px-6">Recipe</TableHead>
                  <TableHead className="px-6 w-40">Quality</TableHead>
                  <TableHead className="px-6 min-w-48">Notes</TableHead>
                  <TableHead className="px-6 w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBrews.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showBaristaColumn ? 8 : 7} className="py-8 whitespace-normal">
                      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500 font-normal max-w-md mx-auto">
                        {filterMethod !== 'all' ? (
                          'No brews found. Try changing the filter or create a new one!'
                        ) : (
                          <>
                            No brews found. Add{' '}
                            <button
                              onClick={onOpenEquipment}
                              className="text-blue-600 hover:text-blue-800 underline cursor-pointer text-sm"
                            >
                              equipment
                            </button>
                            {' '}and{' '}
                            <button
                              onClick={onOpenAddCoffee}
                              className="text-blue-600 hover:text-blue-800 underline cursor-pointer text-sm"
                            >
                              coffee
                            </button>
                            {' '}to log your first brew.
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(groupedBrews).map(([groupLabel, groupBrews]) => (
                    <>
                      <TableRow key={`group-${groupLabel}`}>
                        <TableCell colSpan={showBaristaColumn ? 8 : 7} className="px-6 py-3 bg-gray-100 mobile-group-header">
                          <span className="text-gray-900" style={{ fontWeight: 'var(--font-weight-medium)' }}>{groupLabel}</span>
                        </TableCell>
                      </TableRow>
                      {groupBrews.map((brew) => {
                        const user = users.find(u => u.name === brew.userName);
                        const firstName = brew.userName?.split(' ')[0] || '';
                        
                        return (
                        <TableRow
                          key={brew.id}
                          className="hover:bg-gray-50"
                        >
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Date & Time:">{formatDate(brew.createdAt, groupBy !== 'month')}</TableCell>
                          {showBaristaColumn && (
                            <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="By:">{firstName}</TableCell>
                          )}
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Coffee:">
                            {brew.roaster} <span className="text-gray-500">–</span> {brew.coffeeName}
                          </TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Method:">{capitalizeBrewMethod(brew.brewMethod)}</TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Recipe:">
                            <div className="text-sm">
                              {brew.dosage}g <span className="text-gray-500">→</span> {brew.finalWeight}g <span className="text-gray-500">•</span> {formatTime(brew.brewTime)}
                            </div>
                          </TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Quality:">
                            {brew.quality ? (
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-lg">{getRatingEmoji(brew.quality)}</span>
                                <span className="text-gray-900 text-sm">{getRatingText(brew.quality)}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 cursor-pointer" onClick={() => onSelectBrew(brew)} data-label="Notes:">
                            {(() => {
                              if (!brew.tastingNotes || brew.tastingNotes.trim() === '') {
                                return <span className="text-gray-400">—</span>;
                              }
                              const notes = brew.tastingNotes.split(', ').filter(n => n.trim());
                              if (notes.length === 0) {
                                return <span className="text-gray-400">—</span>;
                              }
                              const visibleNotes = notes.slice(0, 2);
                              const hiddenNotes = notes.slice(2);
                              const hiddenCount = hiddenNotes.length;
                              return (
                                <div className="flex flex-nowrap items-center gap-1">
                                  {visibleNotes.map((note, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm whitespace-nowrap"
                                    >
                                      {note}
                                    </span>
                                  ))}
                                  {hiddenCount > 0 && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <SimpleTooltip 
                                        content={hiddenNotes.join(', ')}
                                        asChild={false}
                                      >
                                        <span className="text-gray-500 text-sm whitespace-nowrap ml-1 cursor-pointer">
                                          +{hiddenCount} more
                                        </span>
                                      </SimpleTooltip>
                                    </div>
                                  )}
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
                                <DropdownMenuItem onSelect={() => onEditBrew(brew)}>
                                  <Pencil className="w-4 h-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onDuplicateBrew(brew)}>
                                  <Copy className="w-4 h-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onDeleteBrew(brew.id)}>
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </>
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