/**
 * Server-side brew method configuration
 * Keep in sync with /utils/brewMethods.ts
 */

export type BrewMethod = 'espresso' | 'pour over' | 'immersion';

export interface BrewMethodConfig {
  id: BrewMethod;
  displayName: string;
  supportsStages: boolean;
}

export const BREW_METHODS: Record<BrewMethod, BrewMethodConfig> = {
  'espresso': {
    id: 'espresso',
    displayName: 'Espresso',
    supportsStages: false,
  },
  'pour over': {
    id: 'pour over',
    displayName: 'Pour Over',
    supportsStages: true,
  },
  'immersion': {
    id: 'immersion',
    displayName: 'Immersion',
    supportsStages: false,
  },
};

/**
 * Check if a brew method supports multi-stage brewing
 */
export function supportsStages(method: BrewMethod): boolean {
  return BREW_METHODS[method]?.supportsStages ?? false;
}

/**
 * Format extraction details for AI prompt based on brew method
 */
export function formatExtractionForPrompt(extraction: any, method: BrewMethod): string {
  const config = BREW_METHODS[method];
  if (!config) return '';

  let details = '';
  
  if (config.supportsStages && extraction.stages) {
    // Pour over: show stages
    details += `\n- Stages: ${extraction.stages.map((s: any, i: number) => `Stage ${i + 1}: ${s.endTime}s / ${s.endWeight}g`).join(', ')}`;
  } else {
    // Espresso and other single-stage methods: show extraction time and final weight
    details += `\n- Extraction Time: ${extraction.extractionTime}s\n- Final Weight: ${extraction.finalWeight}g`;
  }
  
  return details;
}