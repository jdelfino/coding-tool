#!/bin/bash
# setup_env.sh - One-stop devcontainer setup script
# Run this from the host machine to build and configure the devcontainer
#
# Prerequisites: devcontainer CLI (npm install -g @devcontainers/cli)
# Optional: 1Password CLI with OP_SERVICE_ACCOUNT_TOKEN for auto-secrets
#
# Usage: ./setup_env.sh
set -e

WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WORKSPACE_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Coding Tool - Devcontainer Setup             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# Check prerequisites
# =============================================================================
print_step "Checking prerequisites..."

if ! command -v devcontainer &> /dev/null; then
    print_error "devcontainer CLI not found"
    echo "  Install with: npm install -g @devcontainers/cli"
    exit 1
fi
print_success "devcontainer CLI"

if ! command -v docker &> /dev/null; then
    print_error "Docker not found"
    echo "  Install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running"
    echo "  Please start Docker Desktop and try again"
    exit 1
fi
print_success "Docker"

echo ""

# =============================================================================
# Check for 1Password configuration
# =============================================================================
print_step "Checking 1Password configuration..."

if [ -n "$OP_SERVICE_ACCOUNT_TOKEN" ]; then
    print_success "OP_SERVICE_ACCOUNT_TOKEN is set"
    OP_CONFIGURED=true
else
    print_warning "OP_SERVICE_ACCOUNT_TOKEN not set"
    echo "  Secrets will need to be configured manually in .env.local"
    echo "  See docs/DEVCONTAINER.md for 1Password setup instructions"
    OP_CONFIGURED=false
fi

echo ""

# =============================================================================
# Detect host credentials to copy
# =============================================================================
print_step "Detecting host credentials to copy..."

CREDS_TO_COPY=()

# GitHub CLI credentials
GH_CONFIG_DIR="${HOME}/.config/gh"
if [ -d "$GH_CONFIG_DIR" ] && [ -f "$GH_CONFIG_DIR/hosts.yml" ]; then
    print_success "GitHub CLI credentials found"
    CREDS_TO_COPY+=("gh")
else
    print_warning "GitHub CLI not authenticated (optional)"
fi

# Claude Code credentials
CLAUDE_DIR="${HOME}/.claude"
if [ -d "$CLAUDE_DIR" ] && [ -f "$CLAUDE_DIR/.credentials.json" ]; then
    print_success "Claude Code credentials found"
    CREDS_TO_COPY+=("claude")
else
    print_warning "Claude Code not authenticated"
    echo "  You'll need to run 'claude auth' in the container"
fi

# Git global config
GIT_CONFIG="${HOME}/.gitconfig"
if [ -f "$GIT_CONFIG" ] && git config --global user.email &> /dev/null; then
    GIT_NAME=$(git config --global user.name)
    GIT_EMAIL=$(git config --global user.email)
    print_success "Git identity: $GIT_NAME <$GIT_EMAIL>"
    CREDS_TO_COPY+=("git")
else
    print_warning "Git global identity not configured"
fi

echo ""

# =============================================================================
# Build devcontainer
# =============================================================================
print_step "Building devcontainer (this may take a few minutes on first run)..."

devcontainer build --workspace-folder "$WORKSPACE_DIR" 2>&1 | while read line; do
    # Show progress but filter verbose output
    if [[ "$line" == *"Step"* ]] || [[ "$line" == *"=>"* ]] || [[ "$line" == *"Successfully"* ]]; then
        echo "  $line"
    fi
done

print_success "Devcontainer built"
echo ""

# =============================================================================
# Start devcontainer
# =============================================================================
print_step "Starting devcontainer..."

devcontainer up --workspace-folder "$WORKSPACE_DIR" > /dev/null 2>&1

print_success "Devcontainer started"
echo ""

# =============================================================================
# Copy credentials into container
# =============================================================================
if [ ${#CREDS_TO_COPY[@]} -gt 0 ]; then
    print_step "Copying credentials into container..."

    # Get container ID
    CONTAINER_ID=$(docker ps --filter "label=devcontainer.local_folder=$WORKSPACE_DIR" --format "{{.ID}}" | head -1)

    if [ -z "$CONTAINER_ID" ]; then
        print_warning "Could not find running container, skipping credential copy"
    else
        # Copy GitHub CLI config
        if [[ " ${CREDS_TO_COPY[@]} " =~ " gh " ]]; then
            docker exec "$CONTAINER_ID" mkdir -p /home/node/.config/gh
            docker cp "$GH_CONFIG_DIR/hosts.yml" "$CONTAINER_ID:/home/node/.config/gh/hosts.yml"
            docker exec "$CONTAINER_ID" chown -R node:node /home/node/.config/gh
            print_success "GitHub CLI credentials copied"
        fi

        # Copy Claude Code credentials
        if [[ " ${CREDS_TO_COPY[@]} " =~ " claude " ]]; then
            docker exec "$CONTAINER_ID" mkdir -p /home/node/.claude
            docker cp "$CLAUDE_DIR/.credentials.json" "$CONTAINER_ID:/home/node/.claude/.credentials.json"
            # Copy settings too if present
            if [ -f "$CLAUDE_DIR/settings.json" ]; then
                docker cp "$CLAUDE_DIR/settings.json" "$CONTAINER_ID:/home/node/.claude/settings.json"
            fi
            docker exec "$CONTAINER_ID" chown -R node:node /home/node/.claude
            print_success "Claude Code credentials copied"
        fi

        # Copy Git config
        if [[ " ${CREDS_TO_COPY[@]} " =~ " git " ]]; then
            docker cp "$GIT_CONFIG" "$CONTAINER_ID:/home/node/.gitconfig"
            docker exec "$CONTAINER_ID" chown node:node /home/node/.gitconfig
            print_success "Git config copied"
        fi
    fi
    echo ""
fi

# =============================================================================
# Run secrets setup inside container
# =============================================================================
print_step "Setting up secrets and starting Supabase..."

# Forward OP_SERVICE_ACCOUNT_TOKEN if set
if [ "$OP_CONFIGURED" = true ]; then
    devcontainer exec --workspace-folder "$WORKSPACE_DIR" \
        --remote-env "OP_SERVICE_ACCOUNT_TOKEN=$OP_SERVICE_ACCOUNT_TOKEN" \
        bash ./.devcontainer/setup-secrets.sh
else
    devcontainer exec --workspace-folder "$WORKSPACE_DIR" \
        bash ./.devcontainer/setup-secrets.sh
fi

echo ""

# =============================================================================
# Post-setup checklist
# =============================================================================
print_step "Post-setup checklist..."

# Check what still needs manual setup
NEEDS_MANUAL=()

if [[ ! " ${CREDS_TO_COPY[@]} " =~ " claude " ]]; then
    NEEDS_MANUAL+=("Claude Code: run 'claude auth' in container")
fi

if [[ ! " ${CREDS_TO_COPY[@]} " =~ " git " ]]; then
    NEEDS_MANUAL+=("Git identity: run 'git config --global user.name/email' in container")
fi

if [ "$OP_CONFIGURED" = false ]; then
    NEEDS_MANUAL+=("Edit .env.local with SYSTEM_ADMIN_EMAIL and GEMINI_API_KEY")
fi

if [ ${#NEEDS_MANUAL[@]} -gt 0 ]; then
    echo ""
    print_warning "Manual setup required:"
    for item in "${NEEDS_MANUAL[@]}"; do
        echo "  • $item"
    done
fi

echo ""

# =============================================================================
# Done!
# =============================================================================
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Setup Complete!                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Open in VS Code:  code ."
echo "     Then: Cmd/Ctrl+Shift+P → 'Reopen in Container'"
echo ""
echo "  2. Or attach directly:"
echo "     devcontainer exec --workspace-folder . bash"
echo ""
echo "  3. Start dev server (inside container):"
echo "     npm run dev"
echo ""
echo "For more info: docs/DEVCONTAINER.md"
echo ""
