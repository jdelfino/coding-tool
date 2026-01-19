# Devcontainer Setup

## Quick Start

```bash
./setup_env.sh
```

This builds the container, starts Supabase, configures `.env.local`, and copies your credentials.

## Prerequisites

- **Docker** - [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **devcontainer CLI** - `npm install -g @devcontainers/cli`

## Credentials

### Automatically Copied from Host

| Credential | Host Location | Manual Setup (if not found) |
|------------|---------------|----------------------------|
| Git identity | `~/.gitconfig` | `git config --global user.name/email` |
| GitHub CLI | `~/.config/gh/hosts.yml` | `gh auth login` |
| Claude Code | `~/.claude/.credentials.json` | `claude auth` |

### Environment Variables (`.env.local`)

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Auto-set to `http://localhost:54321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Extracted from `supabase start` |
| `SUPABASE_SECRET_KEY` | Extracted from `supabase start` |
| `SYSTEM_ADMIN_EMAIL` | 1Password or manual |
| `GEMINI_API_KEY` | 1Password or manual (optional) |

## 1Password Setup (Optional)

Enables automatic secret injection via `op://` references in `.env.1password`.

1. **Create vault**: `coding-tool-dev`
2. **Create item**: Type "Secure Note", name `secrets`, with fields:
   - `system-admin-email` - your admin email
   - `gemini-api-key` - from [Google AI Studio](https://aistudio.google.com/app/apikey)
3. **Create Service Account**: [my.1password.com](https://my.1password.com) → Developer Tools → Service Accounts
   - Grant read-only access to `coding-tool-dev` vault
4. **Set token** in `~/.bashrc` or `~/.zshrc`:
   ```bash
   export OP_SERVICE_ACCOUNT_TOKEN="your-token"
   ```

Without 1Password, edit `.env.local` manually after setup.

## After Container Rebuild

Run `./setup_env.sh` again. Everything is re-provisioned automatically.

## VS Code

After setup: `code .` → `Cmd/Ctrl+Shift+P` → "Reopen in Container"
