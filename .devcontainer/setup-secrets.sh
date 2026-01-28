#!/bin/bash
# setup-secrets.sh - Start Supabase and load secrets from 1Password into .env.local
# Runs via postStartCommand (every container start)
set -e

# Load token from file if env var not set
if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && [ -f ".op-token" ]; then
    export OP_SERVICE_ACCOUNT_TOKEN=$(cat .op-token)
fi

if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
    echo "Note: OP_SERVICE_ACCOUNT_TOKEN not set, skipping secrets injection"
    exit 0
fi

export OP_VAULT="coding-tool-dev"

# Start Supabase and extract keys
echo "Starting Supabase..."
supabase start

eval "$(supabase status -o env | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY)=')"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "ERROR: Could not extract Supabase keys"
    exit 1
fi

export SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

# Load secrets from 1Password
if [ -f ".env.1password" ] && [ -s ".env.1password" ]; then
    echo "Loading secrets from 1Password..."
    if ! envsubst < .env.1password | op inject -o .env.local; then
        echo "ERROR: op inject failed"
        echo "Fix: Create a Secure Note named 'secrets' with fields 'system-admin-email' and 'gemini-api-key'"
        exit 1
    fi
    echo "Secrets loaded into .env.local"
else
    echo "No .env.1password found or empty, skipping secrets injection"
fi
