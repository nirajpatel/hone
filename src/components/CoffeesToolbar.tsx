import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { DelayedHelpTooltip } from './ui/delayed-help-tooltip';

interface CoffeesToolbarProps {
  view: 'shelf' | 'table';
  groupBy: 'month' | 'coffee';
  onViewChange: (view: 'shelf' | 'table') => void;
  onGroupByChange: (groupBy: 'month' | 'coffee') => void;
  onNewCoffee: () => void;
  isEmpty?: boolean;
}

export function CoffeesToolbar({
  view,
  groupBy,
  onViewChange,
  onGroupByChange,
  onNewCoffee,
  isEmpty = false,
}: CoffeesToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 desktop-filters">
        {!isEmpty && (
          <>
            {/* View Toggle: Shelf (left) | Table (right) */}
            <div className="view-toggle flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5 flex-none">
              <div className="hidden md:block">
                <DelayedHelpTooltip content="Shelf">
                  <Button
                    variant={view === 'shelf' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onViewChange('shelf')}
                    className="cursor-pointer h-8 px-2"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </DelayedHelpTooltip>
              </div>
              <div className="md:hidden">
                <Button
                  variant={view === 'shelf' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewChange('shelf')}
                  className="cursor-pointer h-8 px-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </div>
              <div className="hidden md:block">
                <DelayedHelpTooltip content="Table">
                  <Button
                    variant={view === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onViewChange('table')}
                    className="cursor-pointer h-8 px-2"
                  >
                    <TableIcon className="w-4 h-4" />
                  </Button>
                </DelayedHelpTooltip>
              </div>
              <div className="md:hidden">
                <Button
                  variant={view === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onViewChange('table')}
                  className="cursor-pointer h-8 px-2"
                >
                  <TableIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Group By */}
            <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as 'month' | 'coffee')}>
              <SelectTrigger className="w-[180px] cursor-default text-sm">
                <span>
                  {groupBy === 'month' && (
                    <>
                      <span className="hidden md:inline">By Roast Month</span>
                      <span className="md:hidden">By Date</span>
                    </>
                  )}
                  {groupBy === 'coffee' && 'By Roaster'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">
                  <span className="hidden md:inline">By Roast Month</span>
                  <span className="md:hidden">By Date</span>
                </SelectItem>
                <SelectItem value="coffee">By Roaster</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <h2 className="mobile-section-header">My Coffees</h2>

      <Button onClick={onNewCoffee} className="cursor-pointer mobile-add-button">
        <Plus className="w-4 h-4" />
        Add Coffee
      </Button>
    </div>
  );
}
