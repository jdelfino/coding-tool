#!/bin/bash
# Minimal setup for production ops container
set -euo pipefail

cd /workspaces/coding-tool

echo "Installing dependencies..."
npm install

# Link to production Supabase if not already linked
if [ -f "supabase/.temp/project-ref" ]; then
    echo "Already linked to production: $(cat supabase/.temp/project-ref)"
else
    echo "Linking to production Supabase..."
    if [ -z "${OP_VAULT:-}" ]; then
        echo "WARNING: OP_VAULT not set, skipping auto-link"
    else
        PROJECT_REF=$(op read "op://${OP_VAULT}/supabase-prod/project-ref" 2>/dev/null) || true
        ACCESS_TOKEN=$(op read "op://${OP_VAULT}/supabase-prod/access-token" 2>/dev/null) || true

        if [ -n "$PROJECT_REF" ] && [ -n "$ACCESS_TOKEN" ]; then
            if SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN" supabase link --project-ref "$PROJECT_REF"; then
                echo "Linked to production: $PROJECT_REF"
            else
                echo "WARNING: Failed to link to production Supabase"
            fi
        else
            echo "WARNING: supabase-prod credentials not found in 1Password"
        fi
    fi
fi

echo "Ops container ready"
echo "Available: npx tsx ops/db-reset.ts --help"
