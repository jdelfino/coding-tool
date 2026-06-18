#!/bin/bash
# post-create.sh - Install tools and configure the development environment
# Runs via postCreateCommand (after container creation)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install beads and git hooks
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
bd hooks install 2>/dev/null || true

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Fix ownership of node_modules volume (Docker named volumes default to root)
sudo chown vscode:vscode /workspaces/coding-tool/node_modules

# Project-specific tools
npm install
npx playwright install-deps chromium
npx playwright install chromium
"$SCRIPT_DIR/install-nsjail.sh"
