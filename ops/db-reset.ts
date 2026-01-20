#!/usr/bin/env npx tsx
/**
 * Database Reset Script
 *
 * Resets the database by dropping all objects and re-running migrations.
 * Use --seed to optionally load seed data after reset.
 *
 * Usage:
 *   npx tsx ops/db-reset.ts --env local           # Reset local Supabase
 *   npx tsx ops/db-reset.ts --env production      # Reset production (requires confirmation)
 *   npx tsx ops/db-reset.ts --env production -y   # Skip confirmation (for CI)
 *   npx tsx ops/db-reset.ts --env local --seed    # Reset and seed local
 *   npx tsx ops/db-reset.ts --env production --dry-run  # Show what would happen
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseArgs,
  validateEnv,
  log,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logStep,
  logDryRun,
  logSection,
  confirmDestructive,
  exec,
} from './lib/index.js';

const HELP = `
Database Reset Script

Drops all database objects and re-runs migrations.

USAGE
  npx tsx ops/db-reset.ts --env <environment> [options]

OPTIONS
  --env, -e <env>   Target environment: "local" or "production" (required)
  --seed            Run seed.sql after migrations (default: false)
  --dry-run         Show what would be executed without making changes
  --yes, -y         Skip confirmation prompts (for CI/automation)
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

EXAMPLES
  # Reset local database (fastest for development)
  npx tsx ops/db-reset.ts --env local

  # Reset local and seed with test data
  npx tsx ops/db-reset.ts --env local --seed

  # Preview production reset
  npx tsx ops/db-reset.ts --env production --dry-run

  # Reset production (will prompt for confirmation)
  npx tsx ops/db-reset.ts --env production

  # Reset production without prompts (CI usage)
  npx tsx ops/db-reset.ts --env production --yes

PREREQUISITES
  - Run from host machine (not devcontainer) for production ops
  - For local: Supabase must be running (npx supabase start)
  - For production:
    - Supabase CLI must be linked (see ops/README.md)
    - 1Password must have supabase-prod/database-url

NOTES
  - Production resets require explicit confirmation unless --yes is passed
  - Seed data is NOT loaded by default (use --seed to include it)
  - After production reset, you'll need to create initial user accounts
`.trim();

// SQL to completely reset the public schema
const RESET_SQL = `
-- Drop and recreate public schema (removes all tables, functions, triggers)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore default grants
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;
`.trim();

async function checkSupabaseLinked(): Promise<boolean> {
  const result = await exec('cat supabase/.temp/project-ref 2>/dev/null', { verbose: false });
  return result.exitCode === 0 && !!result.stdout.trim();
}

async function checkLocalSupabaseRunning(): Promise<boolean> {
  const result = await exec('supabase status 2>/dev/null | grep -q "API URL"', { verbose: false });
  return result.exitCode === 0;
}

async function getFromOnePassword(field: string): Promise<string | null> {
  const vault = process.env.OP_VAULT;
  if (!vault) {
    logError('OP_VAULT environment variable not set');
    return null;
  }

  const result = await exec(`op read "op://${vault}/supabase-prod/${field}" 2>/dev/null`, { verbose: false });
  if (result.exitCode === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

async function executeSQL(databaseUrl: string, sql: string, verbose: boolean): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    if (verbose) {
      logInfo('Connected to database');
    }
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function resetLocal(options: { dryRun: boolean; seed: boolean; verbose: boolean }): Promise<void> {
  const { dryRun, seed, verbose } = options;

  // For local, we can use the simpler `supabase db reset` command
  // which handles everything in one step
  if (seed) {
    logStep(1, 1, 'Resetting local database with seed data...');
    if (dryRun) {
      logDryRun('Would run: supabase db reset');
    } else {
      const result = await exec('supabase db reset', { verbose });
      if (result.exitCode !== 0) {
        logError('Database reset failed');
        logError(result.stderr);
        process.exit(1);
      }
    }
    logSuccess('Database reset with seed data complete');
  } else {
    // Without seed, we need to temporarily move seed.sql
    logStep(1, 1, 'Resetting local database (without seed)...');
    if (dryRun) {
      logDryRun('Would run: mv supabase/seed.sql supabase/seed.sql.bak');
      logDryRun('Would run: supabase db reset');
      logDryRun('Would run: mv supabase/seed.sql.bak supabase/seed.sql');
    } else {
      // Check if seed.sql exists
      const seedExists = await exec('test -f supabase/seed.sql && echo "exists"', { verbose: false });
      const hasSeed = seedExists.stdout.includes('exists');

      if (hasSeed) {
        await exec('mv supabase/seed.sql supabase/seed.sql.bak', { verbose });
      }

      try {
        const result = await exec('supabase db reset', { verbose });
        if (result.exitCode !== 0) {
          logError('Database reset failed');
          logError(result.stderr);
          process.exit(1);
        }
      } finally {
        if (hasSeed) {
          await exec('mv supabase/seed.sql.bak supabase/seed.sql', { verbose });
        }
      }
    }
    logSuccess('Database reset complete (no seed data)');
  }
}

async function resetProduction(options: { dryRun: boolean; seed: boolean; verbose: boolean }): Promise<void> {
  const { dryRun, seed, verbose } = options;
  const totalSteps = seed ? 3 : 2;

  // Get credentials from 1Password
  const databaseUrl = await getFromOnePassword('database-url');
  if (!databaseUrl) {
    logError('Could not get database-url from 1Password');
    logInfo('Add "database-url" field to supabase-prod item in your 1Password vault');
    logInfo('Get this from: Supabase Dashboard > Settings > Database > Connection string (URI)');
    process.exit(1);
  }

  const accessToken = await getFromOnePassword('access-token');
  if (!accessToken) {
    logError('Could not get access-token from 1Password');
    logInfo('Add "access-token" field to supabase-prod item in your 1Password vault');
    logInfo('Get this from: Supabase Dashboard > Account > Access Tokens');
    process.exit(1);
  }

  // Step 1: Drop and recreate schema
  logStep(1, totalSteps, 'Dropping all database objects...');
  if (dryRun) {
    logDryRun('Would execute SQL:');
    log('');
    RESET_SQL.split('\n').forEach((line) => log(`  ${line}`));
    log('');
  } else {
    try {
      await executeSQL(databaseUrl, RESET_SQL, verbose);
    } catch (err) {
      logError('Failed to drop schema');
      logError(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  // Step 2: Push migrations
  logStep(2, totalSteps, 'Running migrations...');
  if (dryRun) {
    logDryRun('Would run: SUPABASE_ACCESS_TOKEN=*** supabase db push');
  } else {
    const result = await exec(`SUPABASE_ACCESS_TOKEN="${accessToken}" supabase db push`, { verbose });
    if (result.exitCode !== 0) {
      logError('Migration failed');
      logError(result.stderr);
      process.exit(1);
    }
  }

  // Step 3 (optional): Run seed
  if (seed) {
    logStep(3, totalSteps, 'Loading seed data...');
    const seedPath = path.join(process.cwd(), 'supabase', 'seed.sql');

    if (dryRun) {
      logDryRun(`Would execute SQL from: ${seedPath}`);
    } else {
      if (!fs.existsSync(seedPath)) {
        logError(`Seed file not found: ${seedPath}`);
        process.exit(1);
      }

      const seedSQL = fs.readFileSync(seedPath, 'utf-8');
      try {
        await executeSQL(databaseUrl, seedSQL, verbose);
      } catch (err) {
        logError('Seed data failed to load');
        logError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
  }

  logSuccess('Production database reset complete');

  if (!seed && !dryRun) {
    log('');
    logWarning('No seed data loaded. You will need to create initial accounts manually:');
    logInfo('  1. Create a system-admin via Supabase Dashboard > Authentication');
    logInfo('  2. Add their user_profiles entry with role="system-admin"');
    logInfo('  3. Use the app to create namespaces and invite instructors');
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    log(HELP);
    process.exit(0);
  }

  const env = validateEnv(args.env);
  const { dryRun, seed, verbose, yes } = args;

  logSection(`Database Reset: ${env.toUpperCase()}`);

  if (dryRun) {
    logWarning('DRY RUN MODE - No changes will be made');
  }

  // Environment-specific checks
  if (env === 'local') {
    if (!dryRun) {
      const running = await checkLocalSupabaseRunning();
      if (!running) {
        logError('Local Supabase is not running. Start it with: npx supabase start');
        process.exit(1);
      }
    }
  } else {
    const linked = await checkSupabaseLinked();
    if (!linked) {
      logError('Supabase CLI is not linked to production project');
      logInfo('This should be configured during devcontainer setup.');
      logInfo('To link manually: npx supabase link --project-ref <project-ref>');
      process.exit(1);
    }
  }

  // Show what will happen
  log('');
  logInfo(`Environment: ${env}`);
  logInfo(`Seed data: ${seed ? 'Yes' : 'No'}`);
  logInfo(`Dry run: ${dryRun ? 'Yes' : 'No'}`);

  // Confirmation for production
  if (env === 'production' && !dryRun && !yes) {
    const confirmed = await confirmDestructive(
      'Reset database (drop all tables, run migrations)',
      'PRODUCTION database'
    );
    if (!confirmed) {
      logWarning('Aborted');
      process.exit(1);
    }
  }

  log('');

  // Execute reset
  if (env === 'local') {
    await resetLocal({ dryRun, seed, verbose });
  } else {
    await resetProduction({ dryRun, seed, verbose });
  }

  log('');
  logSuccess('Done!');
}

main().catch((err) => {
  logError(err.message);
  process.exit(1);
});
