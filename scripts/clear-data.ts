#!/usr/bin/env tsx
/**
 * Clear all application data by deleting data files
 * 
 * This script deletes all JSON data files in the data/ directory to guarantee
 * a clean state. When migrating to a database, this will be updated to truncate
 * tables or reload a fresh schema.
 * 
 * Usage:
 *   npm run clear-data
 *   # or
 *   tsx scripts/clear-data.ts
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

const DATA_FILES = [
  'users.json',
  'classes.json',
  'sections.json',
  'memberships.json',
  'sessions.json',
  'auth-sessions.json',
  'revisions.json',
];

/**
 * Delete a data file and recreate it with empty content
 */
async function clearDataFile(filename: string): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  
  try {
    await fs.writeFile(filePath, '{}', 'utf-8');
    console.log(`   ✅ ${filename}`);
  } catch (error) {
    console.error(`   ❌ ${filename}: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

/**
 * Clear the problems directory
 */
async function clearProblemsDir(): Promise<void> {
  const problemsDir = path.join(DATA_DIR, 'problems');
  
  try {
    // Check if directory exists
    try {
      await fs.access(problemsDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(problemsDir, { recursive: true });
    }
    
    // Remove all files in problems directory
    const files = await fs.readdir(problemsDir);
    for (const file of files) {
      await fs.unlink(path.join(problemsDir, file));
    }
    
    // Create empty index.json
    const indexPath = path.join(problemsDir, 'index.json');
    await fs.writeFile(
      indexPath,
      JSON.stringify({ problems: [], lastUpdated: new Date().toISOString() }, null, 2),
      'utf-8'
    );
    
    console.log(`   ✅ problems/ (${files.length} files deleted, index.json created)`);
  } catch (error) {
    console.error(`   ❌ problems/: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🗑️  Clearing all application data...\n');
    
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Clear all JSON files
    for (const file of DATA_FILES) {
      await clearDataFile(file);
    }
    
    // Clear problems directory
    await clearProblemsDir();
    
    console.log('\n✅ All data cleared successfully!');
    console.log('\n💡 Run "npm run seed-data" to populate with test data');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
