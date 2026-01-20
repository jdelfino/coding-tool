#!/bin/bash
# setup-secrets.sh - Start Supabase and create .env.local
# Runs via postStartCommand (every container start)
set -euo pipefail

cd /workspaces/coding-tool

if [ -z "${OP_VAULT:-}" ]; then
    echo "ERROR: OP_VAULT not set"
    exit 1
fi

echo "Starting Supabase..."
supabase start

eval "$(supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "ERROR: Could not extract Supabase keys"
    exit 1
fi

export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

echo "Creating .env.local..."
# envsubst expands shell variables, op inject handles op:// references
if ! envsubst < .env.1password | op inject -o .env.local; then
    echo "ERROR: op inject failed"
    echo "Fix: Create a Secure Note named 'secrets' with fields 'system-admin-email' and 'gemini-api-key'"
    exit 1
fi

echo "Done"
