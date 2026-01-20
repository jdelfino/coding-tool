#!/bin/bash
# setup.sh - Configure credentials from 1Password
# Runs via postCreateCommand (container creation)
#
# Required env vars: OP_SERVICE_ACCOUNT_TOKEN, OP_VAULT
set -e

cd /workspaces/coding-tool

echo "=== Devcontainer Setup ==="

# Require environment variables
if [ -z "$OP_SERVICE_ACCOUNT_TOKEN" ]; then
    echo "ERROR: OP_SERVICE_ACCOUNT_TOKEN not set"
    exit 1
fi

if [ -z "$OP_VAULT" ]; then
    echo "ERROR: OP_VAULT not set"
    exit 1
fi

if ! op vault get "$OP_VAULT" --format json &> /dev/null; then
    echo "ERROR: Cannot access vault '$OP_VAULT'"
    exit 1
fi

echo "Using 1Password vault: $OP_VAULT"

# SSH Key - look for tagged item first, then any SSH Key, then named item
echo "Setting up SSH..."
mkdir -p ~/.ssh && chmod 700 ~/.ssh

SSH_ITEM=$(op item list --vault "$OP_VAULT" --tags devcontainer --categories "SSH Key" --format json 2>/dev/null | jq -r '.[0].id // empty')
[ -z "$SSH_ITEM" ] && SSH_ITEM=$(op item list --vault "$OP_VAULT" --categories "SSH Key" --format json 2>/dev/null | jq -r '.[0].id // empty')

if [ -n "$SSH_ITEM" ]; then
    PRIVATE_KEY=$(op item get "$SSH_ITEM" --fields "private key" --reveal 2>/dev/null || echo "")
    if [ -n "$PRIVATE_KEY" ]; then
        echo "$PRIVATE_KEY" > ~/.ssh/id_ed25519
        chmod 600 ~/.ssh/id_ed25519
        ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub 2>/dev/null || true
        echo "SSH key: $(op item get "$SSH_ITEM" --format json | jq -r '.title')"
    fi
else
    PRIVATE_KEY=$(op read "op://${OP_VAULT}/ssh-key/private key" 2>/dev/null || echo "")
    if [ -n "$PRIVATE_KEY" ]; then
        echo "$PRIVATE_KEY" > ~/.ssh/id_ed25519
        chmod 600 ~/.ssh/id_ed25519
        ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub 2>/dev/null || true
        echo "SSH key: ssh-key"
    fi
fi

if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "ERROR: No SSH key found in vault"
    exit 1
fi

ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null

# Git identity
echo "Setting up Git..."
GIT_NAME=$(op read "op://${OP_VAULT}/git-config/name" 2>/dev/null || echo "")
GIT_EMAIL=$(op read "op://${OP_VAULT}/git-config/email" 2>/dev/null || echo "")

if [ -z "$GIT_NAME" ] || [ -z "$GIT_EMAIL" ]; then
    echo "ERROR: git-config item not found (need fields: name, email)"
    exit 1
fi

git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
echo "Git: $GIT_NAME <$GIT_EMAIL>"

# GitHub CLI - use SSH key for auth
echo "Setting up GitHub CLI..."
gh auth login --git-protocol ssh --hostname github.com <<< ""
echo "GitHub CLI authenticated (via SSH)"

# npm
echo "Installing dependencies..."
npm install

echo "=== Setup Complete ==="
