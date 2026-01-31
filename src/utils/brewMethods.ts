import { BrewMethod } from '../types';

/**
 * Configuration for each brew method
 */
export interface BrewMethodConfig {
  id: BrewMethod;
  displayName: string;
  supportsStages: boolean;
  defaults?: {
    extractionTime?: number;
    finalWeight?: number;
  };
}

/**
 * Registry of all supported brew methods
 * To add a new method, just add an entry here
 */
export const BREW_METHODS: Record<BrewMethod, BrewMethodConfig> = {
  'espresso': {
    id: 'espresso',
    displayName: 'Espresso',
    supportsStages: false,
    defaults: {
      extractionTime: 30,
      finalWeight: 40,
    },
  },
  'pour over': {
    id: 'pour over',
    displayName: 'Pour Over',
    supportsStages: true,
    defaults: {
      extractionTime: 180,
      finalWeight: 300,
    },
  },
  'immersion': {
    id: 'immersion',
    displayName: 'Immersion',
    supportsStages: false,
    defaults: {
      extractionTime: 240,
      finalWeight: 350,
    },
  },
};

/**
 * Check if a brew method supports multi-stage brewing
 */
export function supportsStages(method: BrewMethod): boolean {
  return BREW_METHODS[method]?.supportsStages ?? false;
}

/**
 * Get all brew methods as an array
 */
export function getAllBrewMethods(): BrewMethod[] {
  return Object.keys(BREW_METHODS) as BrewMethod[];
}

/**
 * Get all brew method configurations as an array
 */
export function getAllBrewMethodConfigs(): BrewMethodConfig[] {
  return Object.values(BREW_METHODS);
}