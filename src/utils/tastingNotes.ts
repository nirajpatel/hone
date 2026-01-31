/**
 * Get tasting note suggestions based on quality rating
 * @param qualityRating 1 = Bad, 2 = Decent, 3 = Exceptional
 * @returns Array of suggested tasting notes
 */
export function getTastingNoteSuggestions(qualityRating: number): string[] {
  if (qualityRating === 3) {
    // Exceptional (🔥)
    return ['Balanced', 'Sweet', 'Clear', 'Juicy', 'Silky', 'Rounded', 'Clean Finish', 'Layered', 'Complex'];
  } else if (qualityRating === 2) {
    // Decent (👍)
    return ['Thin', 'Flat', 'Muted', 'Dry', 'Heavy', 'One-Note', 'Short Finish', 'Lacks Sweetness'];
  } else if (qualityRating === 1) {
    // Bad (👎)
    return ['Sour', 'Bitter', 'Astringent', 'Watery', 'Harsh', 'Burnt', 'Hollow', 'Weak', 'Unbalanced', 'Drying'];
  }
  // Default suggestions if no rating selected
  return ['Under-Extracted', 'Over-Extracted', 'Bitter', 'Sour', 'Bland', 'Balanced', 'Sweet', 'Syrupy', 'Clarity', 'Rounded'];
}