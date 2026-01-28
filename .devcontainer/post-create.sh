#!/bin/bash
# post-create.sh - Install tools and configure the development environment
# Runs via postCreateCommand (after container creation)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install 1Password CLI
"$SCRIPT_DIR/install-1password-cli.sh"

# Install beads and git hooks
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
bd hooks install 2>/dev/null || true

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Fix ownership of node_modules volume (Docker volumes default to root)
sudo chown vscode:vscode /workspaces/coding-tool/node_modules

# Project-specific tools
npx playwright install-deps chromium
npx playwright install chromium
"$SCRIPT_DIR/install-nsjail.sh"
npm install

# Configure 1Password vault access
"$SCRIPT_DIR/setup.sh"
