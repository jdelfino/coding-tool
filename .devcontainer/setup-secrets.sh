#!/bin/bash
# setup-secrets.sh - Runs inside the devcontainer to configure secrets
# Called by setup_env.sh via devcontainer exec
set -e

cd /workspaces/coding-tool

echo "=== Setting up secrets ==="
echo ""

# Start Supabase and capture credentials
echo "Starting Supabase..."
OUTPUT=$(npx supabase start 2>&1) || true

# Extract keys from supabase start output
SUPABASE_ANON_KEY=$(echo "$OUTPUT" | grep -E "anon key:" | awk '{print $3}')
SUPABASE_SERVICE_ROLE_KEY=$(echo "$OUTPUT" | grep -E "service_role key:" | awk '{print $3}')

# If keys weren't in output (already running), try supabase status
if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "Supabase may already be running, checking status..."
    STATUS_OUTPUT=$(npx supabase status 2>&1) || true
    SUPABASE_ANON_KEY=$(echo "$STATUS_OUTPUT" | grep -E "anon key:" | awk '{print $3}')
    SUPABASE_SERVICE_ROLE_KEY=$(echo "$STATUS_OUTPUT" | grep -E "service_role key:" | awk '{print $3}')
fi

if [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "ERROR: Could not extract Supabase keys"
    echo "Please ensure Docker is running and try again"
    exit 1
fi

export SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY

echo "✓ Supabase started"
echo ""

# Create .env.local
if [ -n "$OP_SERVICE_ACCOUNT_TOKEN" ]; then
    echo "Injecting secrets from 1Password..."
    # op inject substitutes both op:// references AND ${VAR} shell variables
    op inject -i .env.1password -o .env.local
    echo "✓ .env.local created from 1Password"
else
    echo "OP_SERVICE_ACCOUNT_TOKEN not set. Creating .env.local from template..."
    # Use envsubst to replace shell variables, leave op:// references as placeholders
    envsubst < .env.1password > .env.local

    # Replace op:// references with empty values for manual editing
    sed -i 's/op:\/\/[^[:space:]]*//' .env.local

    echo "✓ .env.local created (manual editing required)"
    echo ""
    echo "⚠️  1Password not configured. Edit .env.local to set:"
    echo "   - SYSTEM_ADMIN_EMAIL"
    echo "   - GEMINI_API_KEY (optional)"
fi

echo ""
echo "=== Secrets setup complete ==="
