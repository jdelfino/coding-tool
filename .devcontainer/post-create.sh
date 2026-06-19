#!/bin/bash
# post-create.sh - Install tools and configure the development environment
# Runs via postCreateCommand (after container creation)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install beads (git hooks are orchestrated by lefthook — see lefthook.yml —
# which calls `bd hooks run <stage>`, so we do NOT run `bd hooks install`).
curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash

# Install Claude Code
curl -fsSL https://claude.ai/install.sh | bash

# Fix ownership of node_modules volume (Docker named volumes default to root)
sudo chown vscode:vscode /workspaces/coding-tool/node_modules

# Project-specific tools
npm install
npx playwright install-deps chromium
npx playwright install chromium
"$SCRIPT_DIR/install-nsjail.sh"

# Install gitleaks (secret scanner used by the pre-commit hook). No Go toolchain
# in this container, so fetch the release binary. Best-effort: the pre-commit
# hook skips the secret scan gracefully if gitleaks is absent.
if ! command -v gitleaks >/dev/null 2>&1; then
    case "$(uname -m)" in
        x86_64|amd64) GL_ARCH=x64 ;;
        aarch64|arm64) GL_ARCH=arm64 ;;
        *) GL_ARCH="" ;;
    esac
    GL_VER=$(curl -fsSL https://api.github.com/repos/gitleaks/gitleaks/releases/latest 2>/dev/null \
        | grep -oP '"tag_name":\s*"v\K[^"]+' | head -1)
    if [ -n "$GL_ARCH" ] && [ -n "$GL_VER" ]; then
        curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GL_VER}/gitleaks_${GL_VER}_linux_${GL_ARCH}.tar.gz" \
            | sudo tar -xz -C /usr/local/bin gitleaks 2>/dev/null \
            && echo "Installed gitleaks ${GL_VER}" \
            || echo "gitleaks install failed — pre-commit secret scan will skip"
    else
        echo "Skipping gitleaks install (unsupported arch or version lookup failed) — secret scan will skip"
    fi
fi

# Install git hooks (lefthook orchestrates beads sync + quality gates).
npx lefthook install
