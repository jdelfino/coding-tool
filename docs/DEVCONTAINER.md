# Devcontainer Setup Guide

This guide covers setting up and using the devcontainer for local development.

## Quick Start

```bash
# One-time setup (run from host machine)
./setup_env.sh
```

That's it! The script handles everything:
- Building the devcontainer
- Starting Supabase
- Configuring `.env.local` (from 1Password if configured)
- Copying your git/GitHub/Claude credentials into the container

## Prerequisites

| Software | Required | Install |
|----------|----------|---------|
| Docker | Yes | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| devcontainer CLI | Yes | `npm install -g @devcontainers/cli` |
| 1Password CLI | Optional | `brew install 1password-cli` or [download](https://1password.com/downloads/command-line/) |

## How It Works

### Secret Management with 1Password

We use 1Password to securely manage and inject secrets. Here's the architecture:

```
.env.1password (committed)     →   op inject   →   .env.local (gitignored)
     ↓                                                    ↓
op://vault/item/field         →   resolves to  →   actual-secret-value
${SHELL_VAR}                  →   substitutes  →   runtime-value
```

**Why `.env.1password` instead of `.env.local`?**

- `.env.local` is gitignored and contains actual secrets - never committed
- `.env.1password` is a **template** that documents what environment variables are needed
- It contains 1Password references (`op://...`) instead of actual values
- Running `op inject` transforms the template into `.env.local` with real values

**What are `op://` references?**

1Password secret references use the format:
```
op://vault-name/item-name/field-name
```

For example:
```bash
GEMINI_API_KEY=op://coding-tool-dev/secrets/gemini-api-key
#               └─────────┬────────┘└──┬───┘└─────┬──────┘
#                    vault name      item      field
```

The `op inject` command reads these references and outputs the file with actual secret values substituted. This way:
- Your secrets are never committed to the repo
- Team members share the same vault and get consistent values
- Rotating a secret means updating 1Password, then re-running setup

### Credential Detection

The setup script automatically detects and copies credentials from your host:

| Credential | Host Location | Copied To Container |
|------------|---------------|---------------------|
| GitHub CLI | `~/.config/gh/hosts.yml` | `/home/node/.config/gh/` |
| Claude Code | `~/.claude/.credentials.json` | `/home/node/.claude/` |
| Git identity | `~/.gitconfig` | `/home/node/.gitconfig` |

If credentials aren't found, the script tells you what to set up manually.

## 1Password Setup (One-Time)

To enable automatic secret injection:

### 1. Create the vault and secrets

In 1Password:
1. Create a vault named `coding-tool-dev`
2. Create a new item:
   - Type: **Secure Note**
   - Name: `secrets`
3. Add custom fields (click "add more" or the + button):
   - Field name: `system-admin-email` → Value: your admin email for the app
   - Field name: `gemini-api-key` → Value: API key from [Google AI Studio](https://aistudio.google.com/app/apikey) (optional)

### 2. Create a Service Account

1. Go to [my.1password.com](https://my.1password.com) → Developer Tools → Service Accounts
2. Create a new Service Account
3. Grant it **read-only** access to the `coding-tool-dev` vault
4. Copy the token

### 3. Set the token

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export OP_SERVICE_ACCOUNT_TOKEN="your-token-here"
```

Then reload: `source ~/.bashrc` (or restart terminal).

Now `setup_env.sh` will automatically inject secrets from 1Password.

## What's Preserved vs Lost on Rebuild

### Automatically Handled (no action needed)

| What | How |
|------|-----|
| npm packages | Reinstalled by `postCreateCommand` |
| Playwright deps | Reinstalled by `postCreateCommand` |
| nsjail | Reinstalled by `install-nsjail.sh` |
| `.env.local` | Regenerated from 1Password (or template) |
| Supabase | Started by `setup-secrets.sh` |

### Requires Re-Running Setup After Rebuild

Just run `./setup_env.sh` again - it handles everything.

If not using 1Password:
- **Edit `.env.local`** - Set `SYSTEM_ADMIN_EMAIL` and optionally `GEMINI_API_KEY`

If credentials weren't detected on host:
- **Claude Code** - Run `claude auth` in the container
- **GitHub CLI** - Run `gh auth login` in the container
- **Git identity** - Run `git config --global user.name/email` in the container

### Always Persists

| What | Location |
|------|----------|
| Source code | `/workspaces/coding-tool` (bind mount) |
| Supabase data | Docker volumes |
| Git repo state | Part of source code |

## Manual Setup Alternative

If you prefer not to use `setup_env.sh`:

```bash
# Build and start container
devcontainer build --workspace-folder .
devcontainer up --workspace-folder .

# Attach to container
devcontainer exec --workspace-folder . bash

# Inside container:
npx supabase start
cp .env.example .env.local
# Edit .env.local with keys from supabase start output
npm run dev
```

## Troubleshooting

### "devcontainer CLI not found"

```bash
npm install -g @devcontainers/cli
```

### "Docker is not running"

Start Docker Desktop and try again.

### "Could not extract Supabase keys"

Supabase needs Docker-in-Docker to work. Make sure:
1. Docker Desktop is running on your host
2. The container has access to Docker (configured in `devcontainer.json`)

Try manually:
```bash
devcontainer exec --workspace-folder . npx supabase status
```

### "op: command not found" in container

The 1Password CLI feature may have failed to install. Try rebuilding:
```bash
devcontainer build --workspace-folder . --no-cache
```

### Credentials not copied

The script looks for credentials in standard locations:
- GitHub: `~/.config/gh/hosts.yml`
- Claude: `~/.claude/.credentials.json`
- Git: `~/.gitconfig`

If yours are elsewhere, you can copy manually:
```bash
docker cp ~/.my-custom-path/hosts.yml <container-id>:/home/node/.config/gh/
```

## File Reference

| File | Purpose |
|------|---------|
| `setup_env.sh` | Host-side orchestration script |
| `.env.1password` | Secret reference template (committed) |
| `.env.local` | Actual secrets (gitignored, generated) |
| `.devcontainer/devcontainer.json` | Container configuration |
| `.devcontainer/setup-secrets.sh` | In-container secret injection |
| `.devcontainer/install-nsjail.sh` | nsjail installation |

## VS Code Integration

After running `setup_env.sh`, open VS Code:

```bash
code .
```

Then: `Cmd/Ctrl+Shift+P` → "Reopen in Container"

VS Code will attach to the already-running container.
