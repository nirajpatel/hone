import { useState, type KeyboardEvent } from 'react';
import { Brew, Coffee, User, BrewMethod, Equipment } from '../types';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger, PopoverArrow } from './ui/popover';
import { MoreVertical, Pencil, Trash2, RotateCcw, Check, ChevronDown, X, Plus } from 'lucide-react';
import { SimpleTooltip } from './ui/simple-tooltip';
import { capitalizeBrewMethod, getRatingEmoji, getRatingText } from '../utils/formatters';
import { BrewsToolbar } from './BrewsToolbar';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { BrewsMobileListView } from './BrewsMobileListView';
import { getTastingNoteSuggestions } from '../utils/tastingNotes';

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
  onUpdateQuality?: (id: string, quality: number | undefined) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
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
  onUpdateQuality,
  onUpdateNotes,
}: BrewsTableViewProps) {
  // Get all brew method configs
  const brewMethodConfigs = getAllBrewMethodConfigs();
  
  // Track which dropdowns are open
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  // Track which row is hovered
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  // Track which notes popover is open
  const [openNotesPopover, setOpenNotesPopover] = useState<string | null>(null);
  // Track notes editing state per brew
  const [notesEditingState, setNotesEditingState] = useState<Record<string, { pills: string[]; input: string }>>({});
  
  const handleDropdownOpenChange = (brewId: string, open: boolean) => {
    setOpenDropdowns(prev => {
      const next = new Set(prev);
      if (open) {
        next.add(brewId);
      } else {
        next.delete(brewId);
      }
      return next;
    });
  };

  // Notes editing helpers
  const initializeNotesEditing = (brewId: string, existingNotes: string) => {
    const notes = existingNotes ? existingNotes.split(', ').filter(n => n.trim()) : [];
    setNotesEditingState(prev => ({
      ...prev,
      [brewId]: {
        pills: notes,
        input: '',
      },
    }));
  };

  const addNotesPill = (brewId: string) => {
    const state = notesEditingState[brewId];
    if (!state) return;
    const trimmedInput = state.input.trim();
    if (trimmedInput && !state.pills.includes(trimmedInput)) {
      setNotesEditingState(prev => ({
        ...prev,
        [brewId]: {
          pills: [...state.pills, trimmedInput],
          input: '',
        },
      }));
    }
  };

  const removeNotesPill = (brewId: string, index: number) => {
    const state = notesEditingState[brewId];
    if (!state) return;
    setNotesEditingState(prev => ({
      ...prev,
      [brewId]: {
        pills: state.pills.filter((_, i) => i !== index),
        input: state.input,
      },
    }));
  };

  const handleNotesKeyPress = (e: KeyboardEvent<HTMLInputElement>, brewId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNotesPill(brewId);
    }
  };

  const handleSaveNotes = (brewId: string) => {
    const state = notesEditingState[brewId];
    if (state && onUpdateNotes) {
      const notesString = state.pills.join(', ');
      onUpdateNotes(brewId, notesString);
    }
    setOpenNotesPopover(null);
  };

  const handleDiscardNotes = (brewId: string) => {
    setOpenNotesPopover(null);
    setNotesEditingState(prev => {
      const next = { ...prev };
      delete next[brewId];
      return next;
    });
  };

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
      // Only show year if different from current year
      const currentYear = new Date().getFullYear();
      const shouldShowYear = showYear && year !== currentYear;
      const dateStr = shouldShowYear 
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
                        const isDropdownOpen = openDropdowns.has(brew.id);
                        
                        return (
                        <TableRow
                          key={brew.id}
                          className="hover:bg-gray-50 group"
                          onMouseEnter={() => setHoveredRowId(brew.id)}
                          onMouseLeave={() => setHoveredRowId(null)}
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
                          <TableCell className="px-6 cursor-pointer relative" data-label="Quality:">
                            {onUpdateQuality ? (
                              <DropdownMenu open={isDropdownOpen} onOpenChange={(open) => handleDropdownOpenChange(brew.id, open)}>
                                <DropdownMenuTrigger asChild>
                                  <div className="flex items-center gap-1 md:gap-2 w-full pr-6 relative" onClick={(e) => e.stopPropagation()}>
                                    {brew.quality ? (
                                      <>
                                        <span className="text-lg">{getRatingEmoji(brew.quality)}</span>
                                        <span className="text-gray-900 text-sm">{getRatingText(brew.quality)}</span>
                                      </>
                                    ) : (
                                      <>
                                        {hoveredRowId === brew.id || isDropdownOpen ? (
                                          <span className="text-gray-500 text-sm">Rate</span>
                                        ) : (
                                          <span className="text-gray-400">—</span>
                                        )}
                                      </>
                                    )}
                                    <ChevronDown className={`absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 transition-opacity duration-150 pointer-events-none ${isDropdownOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                                  </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem
                                    className="gap-1.5"
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      onUpdateQuality(brew.id, 3);
                                    }}
                                  >
                                    <span className="text-lg mr-0">🔥</span>
                                    Exceptional
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-1.5"
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      onUpdateQuality(brew.id, 2);
                                    }}
                                  >
                                    <span className="text-lg mr-0">👍</span>
                                    Decent
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="gap-1.5"
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      onUpdateQuality(brew.id, 1);
                                    }}
                                  >
                                    <span className="text-lg mr-0">👎</span>
                                    Bad
                                  </DropdownMenuItem>
                                  {brew.quality && (
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        onUpdateQuality(brew.id, undefined);
                                      }}
                                    >
                                      Clear rating
                                    </DropdownMenuItem>
                                  )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                              <div className="flex items-center gap-1 md:gap-2" onClick={() => onSelectBrew(brew)}>
                                {brew.quality ? (
                                  <>
                                    <span className="text-lg">{getRatingEmoji(brew.quality)}</span>
                                    <span className="text-gray-900 text-sm">{getRatingText(brew.quality)}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-6 relative" data-label="Notes:" onClick={(e) => {
                            if (!onUpdateNotes) {
                              onSelectBrew(brew);
                            }
                          }}>
                            {onUpdateNotes ? (
                              <Popover open={openNotesPopover === brew.id} onOpenChange={(open) => {
                                if (open) {
                                  initializeNotesEditing(brew.id, brew.tastingNotes || '');
                                  setOpenNotesPopover(brew.id);
                                } else {
                                  setOpenNotesPopover(null);
                                }
                              }}>
                                <div className="flex flex-nowrap items-center gap-1 relative min-h-[24px] w-full">
                                  {(() => {
                                    if (!brew.tastingNotes || brew.tastingNotes.trim() === '') {
                                      return (
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className={`inline-flex items-center gap-1 border border-dashed border-gray-300 bg-transparent hover:bg-gray-50 px-2 py-0.5 rounded-full text-sm whitespace-nowrap text-gray-600 hover:text-gray-900 transition-opacity cursor-pointer ${hoveredRowId === brew.id ? 'opacity-100' : 'opacity-0'}`}
                                            onClick={(e) => {
                                              if (openNotesPopover !== brew.id) {
                                                initializeNotesEditing(brew.id, brew.tastingNotes || '');
                                                setOpenNotesPopover(brew.id);
                                              }
                                            }}
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Add Note</span>
                                          </button>
                                        </PopoverTrigger>
                                      );
                                    }
                                    const notes = brew.tastingNotes.split(', ').filter(n => n.trim());
                                    if (notes.length === 0) {
                                      return (
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className={`inline-flex items-center gap-1 border border-dashed border-gray-300 bg-transparent hover:bg-gray-50 px-2 py-0.5 rounded-full text-sm whitespace-nowrap text-gray-600 hover:text-gray-900 transition-opacity cursor-pointer ${hoveredRowId === brew.id ? 'opacity-100' : 'opacity-0'}`}
                                            onClick={(e) => {
                                              if (openNotesPopover !== brew.id) {
                                                initializeNotesEditing(brew.id, brew.tastingNotes || '');
                                                setOpenNotesPopover(brew.id);
                                              }
                                            }}
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Add Note</span>
                                          </button>
                                        </PopoverTrigger>
                                      );
                                    }
                                    const visibleNotes = notes.slice(0, 2);
                                    const hiddenNotes = notes.slice(2);
                                    const hiddenCount = hiddenNotes.length;
                                    return (
                                      <>
                                        <div className="flex flex-nowrap items-center gap-1 cursor-pointer" onClick={(e) => {
                                          if (openNotesPopover !== brew.id) {
                                            initializeNotesEditing(brew.id, brew.tastingNotes || '');
                                            setOpenNotesPopover(brew.id);
                                          }
                                        }}>
                                          {visibleNotes.map((note, index) => (
                                            <span
                                              key={index}
                                              className="inline-flex items-center bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm whitespace-nowrap"
                                            >
                                              {note}
                                            </span>
                                          ))}
                                        </div>
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
                                        <PopoverTrigger asChild>
                                          <button
                                            type="button"
                                            className={`inline-block text-gray-500 text-xs whitespace-nowrap ml-1 cursor-pointer hover:text-gray-900 transition-opacity bg-transparent border-none p-0 ${hoveredRowId === brew.id ? 'opacity-100' : 'opacity-0'}`}
                                          >
                                            Edit
                                          </button>
                                        </PopoverTrigger>
                                      </>
                                    );
                                  })()}
                                </div>
                                <PopoverContent 
                                  className="w-64 p-3 relative" 
                                  align="center"
                                  side="bottom"
                                  sideOffset={8}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <PopoverArrow className="fill-white" width={20} height={10} style={{ fill: 'white' }} />
                                  <div className="space-y-3">
                                    <div>
                                      <label className="text-xs font-medium mb-2 block text-gray-700">Notes</label>
                                      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1 min-h-[36px] border border-input rounded-md bg-input-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-[color,box-shadow]">
                                        {notesEditingState[brew.id]?.pills.map((pill, index) => (
                                          <span
                                            key={index}
                                            className="inline-flex items-center gap-1 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded-full text-sm"
                                          >
                                            {pill}
                                            <button
                                              type="button"
                                              onClick={() => removeNotesPill(brew.id, index)}
                                              className="hover:bg-gray-200 rounded-full p-0.5 cursor-pointer"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </span>
                                        ))}
                                        <input
                                          value={notesEditingState[brew.id]?.input || ''}
                                          onChange={(e) => setNotesEditingState(prev => ({
                                            ...prev,
                                            [brew.id]: {
                                              ...prev[brew.id],
                                              input: e.target.value,
                                            },
                                          }))}
                                          onKeyDown={(e) => handleNotesKeyPress(e, brew.id)}
                                          onBlur={() => addNotesPill(brew.id)}
                                          placeholder={notesEditingState[brew.id]?.pills.length === 0 ? "Balanced, Sweet, Syrupy" : ""}
                                          className="flex-1 min-w-[120px] outline-none bg-transparent placeholder:text-muted-foreground text-base md:text-sm"
                                          autoFocus
                                        />
                                      </div>
                                      {brew.quality && getTastingNoteSuggestions(brew.quality).length > 0 && (
                                        <div className="mt-2.5 space-y-1.5">
                                          <span className="text-xs text-gray-500">Suggestions:</span>
                                          <div className="flex flex-wrap gap-1.5">
                                            {getTastingNoteSuggestions(brew.quality).map((suggestion) => {
                                            const state = notesEditingState[brew.id];
                                            const isSelected = state?.pills.includes(suggestion);
                                            return (
                                              <button
                                                key={suggestion}
                                                type="button"
                                                onClick={() => {
                                                  if (!state) return;
                                                  if (!isSelected) {
                                                    setNotesEditingState(prev => ({
                                                      ...prev,
                                                      [brew.id]: {
                                                        pills: [...state.pills, suggestion],
                                                        input: state.input,
                                                      },
                                                    }));
                                                  }
                                                }}
                                                className={`text-sm px-2 py-0.5 rounded-full border transition-colors ${
                                                  isSelected
                                                    ? 'bg-blue-100 border-blue-300 text-blue-900'
                                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                } cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                                                disabled={isSelected}
                                              >
                                                {suggestion}
                                              </button>
                                            );
                                          })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 mt-1 border-t">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-3 text-sm cursor-pointer"
                                        onClick={() => handleDiscardNotes(brew.id)}
                                      >
                                        Discard
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-7 px-3 text-sm cursor-pointer"
                                        onClick={() => handleSaveNotes(brew.id)}
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <div className="flex flex-nowrap items-center gap-1">
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
                                    <>
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
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer active:bg-accent data-[state=open]:bg-accent transition-colors">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => onDuplicateBrew(brew)}>
                                  <RotateCcw className="w-4 h-4" />
                                  Brew From This
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onEditBrew(brew)}>
                                  <Pencil className="w-4 h-4" />
                                  Edit
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