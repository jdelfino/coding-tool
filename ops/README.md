# Operational Scripts

Scripts for database operations, deployments, and other administrative tasks.

**Important:** These scripts are designed to run from your **host machine**, not from inside a devcontainer. This ensures proper network access to production resources.

## Design Principles

1. **Run from host** - Not from devcontainers (network access to production)
2. **TypeScript scripts** - Reuse project types, run via `npx tsx ops/script.ts`
3. **Explicit environment targeting** - Always require `--env local` or `--env production`
4. **Confirmation for destructive ops** - Interactive prompts showing exactly what will happen
5. **Dry-run support** - `--dry-run` shows what would happen without executing
6. **Self-documenting** - Every script has `--help`

## Quick Reference

```bash
# Get help for any script
npx tsx ops/db-reset.ts --help

# Dry run to preview changes
npx tsx ops/db-reset.ts --env production --dry-run

# Execute with confirmation prompt
npx tsx ops/db-reset.ts --env production

# Skip prompts (CI/automation)
npx tsx ops/db-reset.ts --env production --yes
```

## Available Scripts

### db-reset.ts

Reset the database by dropping all objects and re-running migrations.

```bash
# Reset local (no seed data)
npx tsx ops/db-reset.ts --env local

# Reset local with seed data
npx tsx ops/db-reset.ts --env local --seed

# Reset production (prompts for confirmation)
npx tsx ops/db-reset.ts --env production

# Reset production, skip prompts
npx tsx ops/db-reset.ts --env production --yes
```

**Prerequisites:**
- Local: Supabase must be running (`npx supabase start`)
- Production: Supabase CLI must be linked (see Production Setup below)

## Production Setup (1Password)

Production ops require credentials from 1Password and Supabase CLI to be linked to production.

**Required 1Password item:** Create a Secure Note called `supabase-prod` in your vault with:
- `project-ref`: Your Supabase project reference (from dashboard URL)
- `access-token`: A Supabase personal access token
- `database-url`: PostgreSQL connection string for direct DB access

**To get these values:**
1. Go to your Supabase Dashboard
2. Project ref is in the URL: `https://supabase.com/dashboard/project/<project-ref>`
3. For access token: Account → Access Tokens → Generate new token
4. For database-url: Settings → Database → Connection string (URI)

**Option 1: Run from host**
```bash
# One-time: link Supabase CLI to production
PROJECT_REF=$(op read "op://${OP_VAULT}/supabase-prod/project-ref")
ACCESS_TOKEN=$(op read "op://${OP_VAULT}/supabase-prod/access-token")
SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase link --project-ref "$PROJECT_REF"

# Run ops
npx tsx ops/db-reset.ts --env production
```

**Option 2: Use ops devcontainer**

A lightweight container with host networking:
```bash
devpod up https://github.com/jdelfino/coding-tool \
  --devcontainer-path .devcontainer/ops/devcontainer.json \
  --id ops \
  --ide none && devpod ssh ops

# Container auto-links to production, ready for ops
npx tsx ops/db-reset.ts --env production
```

## Adding New Scripts

1. Create `ops/your-script.ts`
2. Import utilities from `./lib/index.js`
3. Implement standard options: `--env`, `--dry-run`, `--yes`, `--help`, `--verbose`
4. Add entry to this README
5. Optionally add npm script to `package.json`

### Template

```typescript
#!/usr/bin/env npx tsx
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
  confirm,
  confirmDestructive,
  exec,
} from './lib/index.js';

const HELP = `
Your Script Name

Description of what this script does.

USAGE
  npx tsx ops/your-script.ts --env <environment> [options]

OPTIONS
  --env, -e <env>   Target environment (required)
  --dry-run         Preview changes
  --yes, -y         Skip confirmations
  --verbose, -v     Show details
  --help, -h        Show help
`.trim();

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    log(HELP);
    process.exit(0);
  }

  const env = validateEnv(args.env);
  const { dryRun, verbose, yes } = args;

  // Your implementation here
}

main().catch((err) => {
  logError(err.message);
  process.exit(1);
});
```

## Shared Library (`lib/index.ts`)

### Argument Parsing
- `parseArgs()` - Parse CLI arguments into typed object
- `validateEnv()` - Validate and return environment type

### Output
- `log(msg)` - Plain output
- `logInfo(msg)` - Blue info icon
- `logSuccess(msg)` - Green checkmark
- `logWarning(msg)` - Yellow warning
- `logError(msg)` - Red X
- `logStep(n, total, msg)` - Progress indicator
- `logDryRun(msg)` - Magenta dry-run prefix
- `logSection(title)` - Section header with underline

### Interaction
- `confirm(msg)` - Y/N prompt, returns boolean
- `confirmDestructive(action, target)` - Red warning + confirmation

### Execution
- `exec(cmd, opts)` - Run shell command, returns `{stdout, stderr, exitCode}`
- `getRequiredEnvVar(name)` - Get env var or exit with error
- `getOptionalEnvVar(name, default)` - Get env var with fallback
