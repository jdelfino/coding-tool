#!/bin/bash
# setup-secrets.sh - Start Supabase and create .env.local
# Runs via postStartCommand (every container start)
set -e

cd /workspaces/coding-tool

echo "Starting Supabase..."
supabase start 2>&1 || true

eval "$(supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "ERROR: Could not extract Supabase keys"
    exit 1
fi

export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo "Creating .env.local..."
op inject -i .env.1password -o .env.local

echo "Done"
