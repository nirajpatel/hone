import * as kv from './kv_store.tsx';

/**
 * Migration script to copy extraction keys to brew keys
 * and rename extractionTime field to brewTime
 * 
 * SAFE: This keeps the old extraction: keys for manual verification
 * Run cleanupOldExtractions() after verifying everything works
 */
export async function migrateExtractionToBrew(): Promise<{ success: boolean; migrated: number; skipped: number; errors: any[] }> {
  console.log('Starting SAFE migration: extraction -> brew (keeping old data)');
  
  let migratedCount = 0;
  let skippedCount = 0;
  const errors: any[] = [];
  
  try {
    // Get all extraction entries
    const extractions = await kv.getByPrefix('extraction:');
    console.log(`Found ${extractions.length} extraction entries to migrate`);
    
    // Check if brew keys already exist
    const existingBrews = await kv.getByPrefix('brew:');
    const existingBrewIds = new Set(existingBrews.map(b => b.id));
    
    for (const extraction of extractions) {
      try {
        // Skip if brew already exists (migration already run)
        if (existingBrewIds.has(extraction.id)) {
          skippedCount++;
          console.log(`Skipped (already exists): brew:${extraction.id}`);
          continue;
        }
        
        // Create new brew object with renamed field
        const brew = {
          ...extraction,
          brewTime: extraction.extractionTime,
        };
        
        // Remove old extractionTime field
        delete (brew as any).extractionTime;
        
        // Save with new key prefix (KEEPING old extraction key)
        const newKey = `brew:${extraction.id}`;
        await kv.set(newKey, brew);
        
        migratedCount++;
        console.log(`✓ Copied: extraction:${extraction.id} -> brew:${extraction.id}`);
      } catch (err) {
        console.error(`Error migrating extraction ${extraction.id}:`, err);
        errors.push({ id: extraction.id, error: String(err) });
      }
    }
    
    console.log(`Migration complete: ${migratedCount} entries copied, ${skippedCount} skipped, ${errors.length} errors`);
    console.log('Old extraction: keys preserved. Run cleanupOldExtractions() after verification.');
    
    return {
      success: errors.length === 0,
      migrated: migratedCount,
      skipped: skippedCount,
      errors,
    };
  } catch (err) {
    console.error('Migration failed:', err);
    return {
      success: false,
      migrated: migratedCount,
      skipped: skippedCount,
      errors: [{ error: String(err) }],
    };
  }
}

/**
 * Cleanup function to delete old extraction: keys after verification
 * 
 * DESTRUCTIVE: Only run this after verifying brew: keys work correctly!
 */
export async function cleanupOldExtractions(): Promise<{ success: boolean; deleted: number; errors: any[] }> {
  console.log('Starting cleanup: deleting old extraction: keys');
  
  let deletedCount = 0;
  const errors: any[] = [];
  
  try {
    // Get all extraction entries
    const extractions = await kv.getByPrefix('extraction:');
    console.log(`Found ${extractions.length} extraction entries to delete`);
    
    for (const extraction of extractions) {
      try {
        await kv.deleteKey(`extraction:${extraction.id}`);
        deletedCount++;
        console.log(`✓ Deleted: extraction:${extraction.id}`);
      } catch (err) {
        console.error(`Error deleting extraction ${extraction.id}:`, err);
        errors.push({ id: extraction.id, error: String(err) });
      }
    }
    
    console.log(`Cleanup complete: ${deletedCount} entries deleted, ${errors.length} errors`);
    
    return {
      success: errors.length === 0,
      deleted: deletedCount,
      errors,
    };
  } catch (err) {
    console.error('Cleanup failed:', err);
    return {
      success: false,
      deleted: deletedCount,
      errors: [{ error: String(err) }],
    };
  }
}
