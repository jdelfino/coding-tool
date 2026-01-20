# Devcontainer Setup

## Quick Start

```bash
brew install loft-sh/tap/devpod

devpod up https://github.com/jdelfino/coding-tool \
  --workspace-env OP_SERVICE_ACCOUNT_TOKEN="$OP_SERVICE_ACCOUNT_TOKEN" \
  --workspace-env OP_VAULT="my-vault"
```

## Prerequisites

- Docker
- DevPod (or devcontainer CLI)
- 1Password service account with vault access

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `OP_SERVICE_ACCOUNT_TOKEN` | 1Password service account token |
| `OP_VAULT` | 1Password vault name |

## Required 1Password Items

| Item | Type | Fields | Tag |
|------|------|--------|-----|
| SSH key | SSH Key | (auto) | `devcontainer` |
| `git-config` | Secure Note | `name`, `email` | |
| `github-pat` | API Credential | `credential` | |
| `secrets` | Secure Note | `system-admin-email`, `gemini-api-key` | |
| `supabase-prod` | Secure Note | `project-ref`, `access-token`, `database-url` | |

### Getting Supabase Production Credentials

For `supabase-prod`, get values from your Supabase Dashboard:
- `project-ref`: From URL `https://supabase.com/dashboard/project/<project-ref>`
- `access-token`: Account → Access Tokens → Generate new token
- `database-url`: Settings → Database → Connection string (URI)

Claude Code: Run `claude` and authenticate interactively on first use.

## Creating a GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Set expiration and select scopes: `repo`, `read:org`, `gist`, `workflow`
4. Copy the token (starts with `ghp_`)
5. In 1Password, create an API Credential named `github-pat` with the token in the `credential` field

## Creating Service Account

1. [my.1password.com](https://my.1password.com) → Developer Tools → Service Accounts
2. Create account with read-only access to your vault
3. Set token: `export OP_SERVICE_ACCOUNT_TOKEN="..."`

## Multiple Workspaces

```bash
# Create isolated workspaces with --id
devpod up https://github.com/jdelfino/coding-tool \
  --workspace-env OP_SERVICE_ACCOUNT_TOKEN="..." \
  --workspace-env OP_VAULT="..." \
  --id agent1 \
  --ide none && devpod ssh agent1
```

## IDE Options

```bash
# SSH only (no IDE)
devpod up ... --ide none && devpod ssh <workspace-id>

# VS Code (default)
devpod up ...

# Set default IDE for a workspace
devpod ide use none --workspace <workspace-id>
```

## VS Code

After setup: `code .` → `Cmd+Shift+P` → "Reopen in Container"
