#!/bin/bash
# setup_env.sh - One-stop devcontainer setup script
# Run this from the host machine to build and configure the devcontainer
#
# This script uses a Docker volume for the workspace (not a bind mount) for
# better performance on macOS. The code is cloned from git into the volume.
# Multiple named instances can run concurrently, each with isolated code.
#
# Prerequisites: devcontainer CLI (npm install -g @devcontainers/cli)
# Optional: 1Password CLI with OP_SERVICE_ACCOUNT_TOKEN for auto-secrets
#
# Usage: ./setup_env.sh [--name <instance>] [--rebuild]
#   --name <instance>  Name for this instance (default: "default")
#                      Allows multiple concurrent containers
#   --rebuild          Remove existing container and rebuild from scratch
#                      (volume with code is preserved, only container is rebuilt)
#
# Examples:
#   ./setup_env.sh                    # Single default instance
#   ./setup_env.sh --name agent1      # Named instance for concurrent use
#   ./setup_env.sh --name agent2      # Another concurrent instance
#   ./setup_env.sh --name agent1 --rebuild  # Rebuild specific instance
set -e

WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_NAME="$(basename "$WORKSPACE_DIR")"
cd "$WORKSPACE_DIR"

# Get the git remote URL for cloning into volume
GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

# Parse arguments
REBUILD=false
INSTANCE_NAME="default"
while [[ $# -gt 0 ]]; do
    case $1 in
        --rebuild)
            REBUILD=true
            shift
            ;;
        --name)
            INSTANCE_NAME="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Derived names based on instance
# Volume name must match what devcontainer.json uses: ${localWorkspaceFolderBasename}-workspace
# Since localWorkspaceFolderBasename will be the instance name, volume is <instance>-workspace
VOLUME_NAME="${INSTANCE_NAME}-workspace"
INSTANCE_DIR="${WORKSPACE_DIR}/.devcontainer-instances/${INSTANCE_NAME}"

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
echo "Instance: $INSTANCE_NAME"
echo "Volume:   $VOLUME_NAME"
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
# Setup instance directory
# =============================================================================
print_step "Setting up instance directory..."

# Create instance directory with .devcontainer subfolder
INSTANCE_DEVCONTAINER_DIR="${INSTANCE_DIR}/.devcontainer"
mkdir -p "$INSTANCE_DEVCONTAINER_DIR"

# Copy all .devcontainer files to instance
# devcontainer.json uses ${localWorkspaceFolderBasename} which resolves to instance name
cp -r "${WORKSPACE_DIR}/.devcontainer/"* "$INSTANCE_DEVCONTAINER_DIR/"

print_success "Instance directory: $INSTANCE_DIR"
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
# Validate host credentials (will be mounted into container)
# =============================================================================
print_step "Validating host credentials for mounting..."

MISSING_CREDS=()

# SSH agent (for git push/pull)
if [ -z "$SSH_AUTH_SOCK" ] || [ ! -S "$SSH_AUTH_SOCK" ]; then
    print_warning "SSH agent not running"
    echo "  Run: eval \$(ssh-agent) && ssh-add"
    MISSING_CREDS+=("ssh-agent")
else
    print_success "SSH agent: $SSH_AUTH_SOCK"
fi

# Git global config
GIT_CONFIG="${HOME}/.gitconfig"
if [ -f "$GIT_CONFIG" ] && git config --global user.email &> /dev/null; then
    GIT_NAME=$(git config --global user.name)
    GIT_EMAIL=$(git config --global user.email)
    print_success "Git identity: $GIT_NAME <$GIT_EMAIL>"
else
    print_warning "Git config not found: ~/.gitconfig"
    MISSING_CREDS+=("gitconfig")
fi

# GitHub CLI credentials
GH_CONFIG_DIR="${HOME}/.config/gh"
if [ -d "$GH_CONFIG_DIR" ] && [ -f "$GH_CONFIG_DIR/hosts.yml" ]; then
    print_success "GitHub CLI credentials found"
else
    print_warning "GitHub CLI not authenticated: ~/.config/gh"
    MISSING_CREDS+=("gh")
fi

# Claude Code credentials
CLAUDE_CREDS="${HOME}/.claude.json"
if [ -f "$CLAUDE_CREDS" ]; then
    print_success "Claude Code credentials found"
else
    print_warning "Claude Code not authenticated: ~/.claude.json"
    MISSING_CREDS+=("claude")
fi

if [ ${#MISSING_CREDS[@]} -gt 0 ]; then
    echo ""
    print_warning "Some credentials are missing. Container may have limited functionality."
fi

echo ""

# =============================================================================
# Setup workspace volume
# =============================================================================
print_step "Setting up workspace volume: $VOLUME_NAME"

if docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
    VOLUME_EXISTS=true
else
    VOLUME_EXISTS=false
fi

if [ "$VOLUME_EXISTS" = "false" ]; then
    echo "  Creating new volume..."
    docker volume create "$VOLUME_NAME" > /dev/null

    if [ -z "$GIT_REMOTE" ]; then
        print_error "No git remote found. Cannot clone into volume."
        echo "  This script requires a git remote to clone from."
        exit 1
    fi

    echo "  Cloning repository into volume..."
    echo "  Remote: $GIT_REMOTE"
    if ! docker run --rm \
        -v "$VOLUME_NAME:/workspace" \
        -v "$HOME/.ssh:/root/.ssh:ro" \
        -v "$HOME/.gitconfig:/root/.gitconfig:ro" \
        alpine/git clone "$GIT_REMOTE" /workspace; then
        print_error "Failed to clone repository"
        echo "  Check your SSH keys and network connection"
        docker volume rm "$VOLUME_NAME" 2>/dev/null || true
        exit 1
    fi

    # Verify clone succeeded
    if ! docker run --rm -v "$VOLUME_NAME:/workspace" alpine test -f /workspace/package.json; then
        print_error "Clone appears incomplete - package.json not found"
        docker volume rm "$VOLUME_NAME" 2>/dev/null || true
        exit 1
    fi

    # Fix permissions for node user (UID 1000) in devcontainer
    echo "  Setting permissions..."
    docker run --rm -v "$VOLUME_NAME:/workspace" alpine chown -R 1000:1000 /workspace

    print_success "Volume created and repository cloned"
else
    echo "  Volume already exists"

    # Check for uncommitted changes in the volume
    echo "  Checking for uncommitted changes..."
    UNCOMMITTED=$(docker run --rm -v "$VOLUME_NAME:/workspace" -w /workspace alpine/git status --porcelain 2>/dev/null || echo "")

    if [ -n "$UNCOMMITTED" ]; then
        print_warning "Uncommitted changes detected in volume:"
        echo "$UNCOMMITTED" | head -10 | sed 's/^/    /'
        if [ $(echo "$UNCOMMITTED" | wc -l) -gt 10 ]; then
            echo "    ... and more"
        fi
        echo ""

        if [ "$REBUILD" = true ]; then
            print_warning "Rebuilding will preserve the volume but uncommitted changes may be at risk."
        fi
    else
        print_success "No uncommitted changes"

        # Optionally pull latest
        echo "  Pulling latest from remote..."
        docker run --rm \
            -v "$VOLUME_NAME:/workspace" \
            -v "$HOME/.ssh:/root/.ssh:ro" \
            -w /workspace \
            alpine/git pull --ff-only 2>/dev/null || echo "  (pull skipped - may have local commits)"
    fi

    # Always ensure correct permissions for node user (UID 1000)
    echo "  Fixing permissions for node user..."
    docker run --rm -v "$VOLUME_NAME:/workspace" alpine chown -R 1000:1000 /workspace
fi
echo ""

# =============================================================================
# Handle existing container
# =============================================================================
EXISTING_CONTAINER=$(docker ps -a --filter "label=devcontainer.local_folder=$INSTANCE_DIR" --format "{{.ID}}" | head -1)
REMOVE_EXISTING=""

if [ "$REBUILD" = true ] && [ -n "$EXISTING_CONTAINER" ]; then
    print_warning "Existing container found: $EXISTING_CONTAINER"
    echo "  --rebuild will remove this container (volume data is preserved)."
    echo ""
    read -p "  Continue with rebuild? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REMOVE_EXISTING="--remove-existing-container"
        print_success "Will remove and rebuild container"
    else
        echo "  Aborted. Run without --rebuild to reuse existing container."
        exit 0
    fi
    echo ""
elif [ -n "$EXISTING_CONTAINER" ]; then
    print_warning "Existing container found: $EXISTING_CONTAINER"
    echo "  Will reuse it. Use --rebuild to remove and build fresh."
    echo ""
fi

# =============================================================================
# Build and start devcontainer
# =============================================================================
print_step "Building devcontainer (this may take a few minutes on first run)..."

# Show filtered build output
devcontainer build --workspace-folder "$INSTANCE_DIR" 2>&1 | grep -E "(Step|=>|Successfully|Error|error)" | sed 's/^/  /' || true

print_success "Devcontainer built"
echo ""

# =============================================================================
# Start devcontainer
# =============================================================================
print_step "Starting devcontainer..."

if ! devcontainer up --workspace-folder "$INSTANCE_DIR" $REMOVE_EXISTING; then
    print_error "Failed to start devcontainer"
    echo "  Run with verbose output:"
    echo "  devcontainer up --workspace-folder '$INSTANCE_DIR'"
    exit 1
fi

print_success "Devcontainer started"
echo ""

# Credentials are mounted via devcontainer.json, no copy needed

# =============================================================================
# Run secrets setup inside container
# =============================================================================
print_step "Setting up secrets and starting Supabase..."

# Forward OP_SERVICE_ACCOUNT_TOKEN if set
# Use bash -l (login shell) to get proper PATH including supabase CLI
# The setup-secrets.sh is in the volume at /workspaces/coding-tool/.devcontainer/
if [ "$OP_CONFIGURED" = true ]; then
    devcontainer exec --workspace-folder "$INSTANCE_DIR" \
        --remote-env "OP_SERVICE_ACCOUNT_TOKEN=$OP_SERVICE_ACCOUNT_TOKEN" \
        bash -l /workspaces/coding-tool/.devcontainer/setup-secrets.sh
else
    devcontainer exec --workspace-folder "$INSTANCE_DIR" \
        bash -l /workspaces/coding-tool/.devcontainer/setup-secrets.sh
fi

echo ""

# =============================================================================
# Post-setup checklist
# =============================================================================
print_step "Post-setup checklist..."

# Check what still needs manual setup
NEEDS_MANUAL=()

if [ "$OP_CONFIGURED" = false ]; then
    NEEDS_MANUAL+=("Edit .env.local with SYSTEM_ADMIN_EMAIL and GEMINI_API_KEY")
fi

# Add any missing credentials from earlier validation
for cred in "${MISSING_CREDS[@]}"; do
    case $cred in
        ssh-agent) NEEDS_MANUAL+=("Start SSH agent: eval \$(ssh-agent) && ssh-add") ;;
        gitconfig) NEEDS_MANUAL+=("Configure git: git config --global user.name/email") ;;
        gh) NEEDS_MANUAL+=("Authenticate GitHub CLI: gh auth login") ;;
        claude) NEEDS_MANUAL+=("Authenticate Claude: claude auth") ;;
    esac
done

if [ ${#NEEDS_MANUAL[@]} -gt 0 ]; then
    echo ""
    print_warning "Manual setup required on host:"
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
echo "Instance '$INSTANCE_NAME' is ready!"
echo ""
echo "Next steps:"
echo "  1. Attach VS Code to the container:"
echo "     - Open VS Code"
echo "     - Cmd/Ctrl+Shift+P → 'Dev Containers: Attach to Running Container'"
echo "     - Select the container for '$INSTANCE_NAME'"
echo ""
echo "  2. Or attach via CLI:"
echo "     devcontainer exec --workspace-folder '$INSTANCE_DIR' bash"
echo ""
echo "  3. Start dev server (inside container):"
echo "     npm run dev"
echo ""
echo "To create another concurrent instance:"
echo "  ./setup_env.sh --name agent2"
echo ""
echo "For more info: docs/DEVCONTAINER.md"
echo ""
