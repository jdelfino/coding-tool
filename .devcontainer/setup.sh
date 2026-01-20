#!/bin/bash
# setup.sh - Configure credentials from 1Password
# Runs via postCreateCommand (container creation)
#
# Required env vars: OP_SERVICE_ACCOUNT_TOKEN, OP_VAULT
set -euo pipefail

cd /workspaces/coding-tool

echo "=== Devcontainer Setup ==="

# Require environment variables
if [ -z "${OP_SERVICE_ACCOUNT_TOKEN:-}" ]; then
    echo "ERROR: OP_SERVICE_ACCOUNT_TOKEN not set"
    echo "Fix: export OP_SERVICE_ACCOUNT_TOKEN=<token from 1Password service account>"
    exit 1
fi

if [ -z "${OP_VAULT:-}" ]; then
    echo "ERROR: OP_VAULT not set"
    echo "Fix: export OP_VAULT=<your vault name>"
    exit 1
fi

if ! op vault get "$OP_VAULT" --format json > /dev/null; then
    echo "ERROR: Cannot access vault '$OP_VAULT'"
    echo "Fix: Check OP_SERVICE_ACCOUNT_TOKEN has access to this vault"
    exit 1
fi

echo "Using 1Password vault: $OP_VAULT"

# SSH Key
echo "Setting up SSH..."
mkdir -p ~/.ssh && chmod 700 ~/.ssh

SSH_ITEM=$(op item list --vault "$OP_VAULT" --tags devcontainer --categories "SSH Key" --format json | jq -r '.[0].id')
if [ "$SSH_ITEM" = "null" ] || [ -z "$SSH_ITEM" ]; then
    echo "ERROR: No SSH Key found"
    echo "Fix: In 1Password, create an SSH Key item and tag it 'devcontainer'"
    exit 1
fi

if ! op item get "$SSH_ITEM" --fields "private key" --reveal > ~/.ssh/id_ed25519; then
    echo "ERROR: Could not read SSH private key"
    exit 1
fi

chmod 600 ~/.ssh/id_ed25519
ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub
ssh-keyscan github.com >> ~/.ssh/known_hosts
echo "SSH key configured"

# Git identity
echo "Setting up Git..."
if ! GIT_NAME=$(op read "op://${OP_VAULT}/git-config/name"); then
    echo "ERROR: Could not read git-config/name"
    echo "Fix: In 1Password, create a Secure Note named 'git-config' with field 'name'"
    exit 1
fi

if ! GIT_EMAIL=$(op read "op://${OP_VAULT}/git-config/email"); then
    echo "ERROR: Could not read git-config/email"
    echo "Fix: In 1Password, create a Secure Note named 'git-config' with field 'email'"
    exit 1
fi

git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
echo "Git: $GIT_NAME <$GIT_EMAIL>"

# GitHub CLI
echo "Setting up GitHub CLI..."
gh auth login --git-protocol ssh --hostname github.com <<< ""
echo "GitHub CLI authenticated"

# npm
echo "Installing dependencies..."
npm install

echo "=== Setup Complete ==="
