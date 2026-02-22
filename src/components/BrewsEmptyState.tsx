import { Plus, Check } from 'lucide-react';
import { Button } from './ui/button';

export interface BrewsEmptyStateProps {
  /** Shown when filter is "all" and no brews; otherwise show simple "No Brews Found" message */
  filterMethod: 'all' | string;
  hasEquipment: boolean;
  hasCoffees: boolean;
  hasBrews: boolean;
  onOpenEquipment: () => void;
  onOpenAddCoffee: () => void;
  onNewBrew: () => void;
}

export function BrewsEmptyState({
  filterMethod,
  hasEquipment,
  hasCoffees,
  hasBrews,
  onOpenEquipment,
  onOpenAddCoffee,
  onNewBrew,
}: BrewsEmptyStateProps) {
  if (filterMethod !== 'all') {
    return (
      <div className="empty-state-card-md bg-white rounded-lg border border-gray-200 p-8 md:p-16 text-center" style={{ marginTop: '-2rem' }}>
        <div className="max-w-lg mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Brews Found</h3>
          <p className="text-sm text-gray-600">Try changing the filter or create a new brew</p>
        </div>
      </div>
    );
  }

  const step1Done = hasCoffees;
  const step2Done = hasEquipment;
  const step3Done = hasBrews;

  // First step (in order 1→2→3) that isn't done yet — people may complete steps out of order
  const firstIncomplete =
    !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : null;

  const nextAction =
    !step1Done
      ? { label: 'Add Coffee', onClick: onOpenAddCoffee }
      : !step2Done
        ? { label: 'Add Equipment', onClick: onOpenEquipment }
        : { label: 'New Brew', onClick: onNewBrew };

  return (
    <div className="empty-state-card-md bg-white rounded-lg border border-gray-200 p-8 md:p-16 text-center" style={{ marginTop: '-2rem' }}>
      <div className="max-w-lg mx-auto">
        <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">Let's dial in your first coffee</h3>
        <p className="text-base text-gray-600 mb-8 text-center">
          Start by adding your coffee and equipment,
          <br />
          then log your brews to get personalized guidance and improve every cup.
        </p>

        {/* Horizontal stepper — only the first incomplete step (in order) is unmuted */}
        <div className="flex flex-wrap items-center justify-center gap-y-1 text-sm mb-6" style={{ gap: '0 0.25rem' }}>
          <span className={step1Done ? 'text-gray-500' : firstIncomplete === 1 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {step1Done ? <Check className="w-4 h-4 inline-block align-middle mr-1" /> : '①'}
            {' '}Add Coffee
          </span>
          <span className="shrink-0 text-gray-300" style={{ marginLeft: '0.125rem', marginRight: '0.125rem' }}>——</span>
          <span className={step2Done ? 'text-gray-500' : firstIncomplete === 2 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {step2Done ? <Check className="w-4 h-4 inline-block align-middle mr-1" /> : '②'}
            {' '}Add Equipment
          </span>
          <span className="shrink-0 text-gray-300" style={{ marginLeft: '0.125rem', marginRight: '0.125rem' }}>——</span>
          <span className={step3Done ? 'text-gray-500' : firstIncomplete === 3 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {step3Done ? <Check className="w-4 h-4 inline-block align-middle mr-1" /> : '③'}
            {' '}Log First Brew
          </span>
        </div>

        {/* Next step button */}
        <Button onClick={nextAction.onClick} className="cursor-pointer">
          <Plus className="w-4 h-4" />
          {nextAction.label}
        </Button>
      </div>
    </div>
  );
}
