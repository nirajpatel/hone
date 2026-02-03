import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Activity, Table as TableIcon } from 'lucide-react';
import { BrewMethod, Equipment, Coffee } from '../types';
import { getAllBrewMethodConfigs } from '../utils/brewMethods';
import { SimpleTooltip } from './ui/simple-tooltip';
import { DelayedHelpTooltip } from './ui/delayed-help-tooltip';

interface BrewsToolbarProps {
  view: 'table' | 'timeline';
  filterMethod: BrewMethod | 'all';
  groupBy?: 'month' | 'coffee';
  onViewChange: (view: 'table' | 'timeline') => void;
  onFilterMethodChange: (method: BrewMethod | 'all') => void;
  onGroupByChange?: (groupBy: 'month' | 'coffee') => void;
  onNewBrew: () => void;
  equipment: Equipment[];
  coffees: Coffee[];
}

export function BrewsToolbar({
  view,
  filterMethod,
  groupBy,
  onViewChange,
  onFilterMethodChange,
  onGroupByChange,
  onNewBrew,
  equipment,
  coffees,
}: BrewsToolbarProps) {
  const brewMethodConfigs = getAllBrewMethodConfigs();

  // Check if there's at least one coffee, one brewer, and one grinder
  const hasBrewers = equipment.some(e => e.type === 'brewer' && e.active);
  const hasGrinders = equipment.some(e => e.type === 'grinder' && e.active);
  const hasCoffees = coffees.length > 0;
  const canCreateBrew = hasBrewers && hasGrinders && hasCoffees;

  // Generate tooltip text
  const getTooltipText = () => {
    if (canCreateBrew) return undefined;
    
    const missing = [];
    if (!hasCoffees) missing.push('at least one coffee');
    if (!hasBrewers) missing.push('at least one brewer');
    if (!hasGrinders) missing.push('at least one grinder');
    
    return `Add ${missing.join(', ')} to create brews`;
  };

  const button = (
    <Button 
      onClick={onNewBrew} 
      className="cursor-pointer mobile-add-button"
      disabled={!canCreateBrew}
    >
      <Plus className="w-4 h-4" />
      New Brew
    </Button>
  );

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2 desktop-filters">
        {/* View Toggle Buttons */}
        <div className="view-toggle flex items-center gap-0.5 border border-gray-200 rounded-md p-0.5 flex-none">
          <div className="hidden md:block">
            <DelayedHelpTooltip content="Timeline">
              <Button
                variant={view === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewChange('timeline')}
                className="cursor-pointer h-8 px-2"
              >
                <Activity className="w-4 h-4" />
              </Button>
            </DelayedHelpTooltip>
          </div>
          <div className="md:hidden">
            <Button
              variant={view === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange('timeline')}
              className="cursor-pointer h-8 px-2"
            >
              <Activity className="w-4 h-4" />
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
        
        <Select value={filterMethod} onValueChange={(v) => onFilterMethodChange(v as BrewMethod | 'all')}>
          <SelectTrigger className="w-[180px] cursor-default text-sm">
            <SelectValue placeholder="All Methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {brewMethodConfigs.map(config => (
              <SelectItem key={config.id} value={config.id}>{config.displayName || config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {groupBy && onGroupByChange && (
          <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as 'month' | 'coffee')}>
            <SelectTrigger className="w-[180px] cursor-default text-sm">
              <span>
                {groupBy === 'month' && (
                  <>
                    <span className="hidden md:inline">By Month</span>
                    <span className="md:hidden">By Date</span>
                  </>
                )}
                {groupBy === 'coffee' && 'By Coffee'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">
                <span className="hidden md:inline">By Month</span>
                <span className="md:hidden">By Date</span>
              </SelectItem>
              <SelectItem value="coffee">By Coffee</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Mobile Header */}
      <h2 className="mobile-section-header">
        Previous Brews
      </h2>
      
      {!canCreateBrew ? (
        <SimpleTooltip content={getTooltipText()!}>
          {button}
        </SimpleTooltip>
      ) : button}
    </div>
  );
}