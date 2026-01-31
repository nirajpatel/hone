import { BrewMethod } from '../types';
import { BREW_METHODS } from './brewMethods';
import type { Equipment } from '../types';

/**
 * Capitalize and format a brew method for display
 */
export function capitalizeBrewMethod(method: BrewMethod): string {
  return BREW_METHODS[method].displayName;
}

/**
 * Get emoji for quality rating
 */
export function getRatingEmoji(rating?: number): string {
  if (!rating || rating === 0) return '';
  switch (rating) {
    case 1:
      return '👎';
    case 2:
      return '👍';
    case 3:
      return '🔥';
    default:
      return '';
  }
}

/**
 * Get text label for quality rating
 */
export function getRatingText(rating?: number): string {
  if (!rating || rating === 0) return 'Not rated';
  switch (rating) {
    case 1:
      return 'Bad';
    case 2:
      return 'Decent';
    case 3:
      return 'Exceptional';
    default:
      return 'Not rated';
  }
}

/**
 * Get emoji and text for quality rating
 */
export function getRatingDisplay(rating?: number): string {
  if (!rating || rating === 0) return 'Not rated';
  return `${getRatingEmoji(rating)} ${getRatingText(rating)}`;
}

/**
 * Format time in seconds to MM:SS format
 */
export function formatTimeDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format weight with units
 */
export function formatWeight(grams: number): string {
  return `${grams}g`;
}

/**
 * Format temperature with units
 */
export function formatTemperature(fahrenheit: number): string {
  return `${fahrenheit}°F`;
}

/**
 * Format ratio (dose to final weight)
 */
export function formatRatio(dosage: number, finalWeight: number): string {
  const ratio = finalWeight / dosage;
  return `1:${ratio.toFixed(1)}`;
}

/**
 * Format equipment name (company + model)
 * For backwards compatibility, falls back to name field if company/model not set
 */
export function formatEquipmentName(equipment: Equipment | { company?: string; model?: string; name?: string }): string {
  if (equipment.company && equipment.model) {
    return `${equipment.company} ${equipment.model}`;
  }
  if (equipment.company) {
    return equipment.company;
  }
  if (equipment.model) {
    return equipment.model;
  }
  return equipment.name || '';
}