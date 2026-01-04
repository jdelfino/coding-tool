# Data Management Scripts

This directory contains utility scripts for managing application data.

## Scripts

### clear-data.ts

Clears all application data by deleting data files directly.

**Usage:**
```bash
npm run clear-data
```

**What it does:**
1. Deletes all JSON data files in `data/` directory
2. Empties the `data/problems/` directory
3. Creates empty data structures to ensure clean state
4. Guarantees a completely fresh start

**Files cleared:**
- `users.json`
- `classes.json`
- `sections.json`
- `memberships.json`
- `sessions.json`
- `auth-sessions.json`
- `revisions.json`
- `problems/` directory (including `index.json`)

**Note:** When migrating to a database, this script will be updated to truncate tables or reload a fresh schema.

### seed-data.ts

Populates the application with a preset test dataset.

**Usage:**
```bash
npm run seed-data
```

**What it creates:**
- 1 namespace-admin user named "admin" (with namespace-admin role)
- 1 teacher user named "teach"
- 1 class: "Introduction to Programming"
- 1 section: "Section A" (Fall 2025)
- 4 student users: "stu1", "stu2", "stu3", "stu4"
- Students enrolled in the section
- 1 problem: "Hello World"

**How it works:**
- Creates admin user directly in `users.json` with admin role
- Uses API endpoints for all other data creation
- Ensures consistent test environment

## Typical Workflow

```bash
# 1. Clear all existing data
npm run clear-data

# 2. Seed with test data
npm run seed-data
```

This gives you a clean, consistent test environment with predefined users and data.

## Design Philosophy

- **clear-data**: Operates directly on files for guaranteed clean state. Will be updated to truncate database tables after migration.
- **seed-data**: Creates admin user in data file, then uses API for everything else. This hybrid approach ensures we have proper admin permissions while respecting business logic.

## Troubleshooting

**"Failed to load problem index"**
- The `data/problems/` directory may be missing `index.json`
- Run `npm run clear-data` to recreate it

**Server not responding**
- Ensure the development server is running: `npm run dev`
- The seed-data script requires an active server to call the API endpoints
