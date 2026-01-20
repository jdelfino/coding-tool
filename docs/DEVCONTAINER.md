# Devcontainer Setup

## Quick Start

```bash
brew install loft-sh/tap/devpod

devpod up . \
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
| `secrets` | Secure Note | `system-admin-email`, `gemini-api-key` | |

Claude Code: Run `claude` and authenticate interactively on first use.

## Creating Service Account

1. [my.1password.com](https://my.1password.com) → Developer Tools → Service Accounts
2. Create account with read-only access to your vault
3. Set token: `export OP_SERVICE_ACCOUNT_TOKEN="..."`

## Multiple Workspaces

```bash
devpod up . --workspace-env OP_SERVICE_ACCOUNT_TOKEN="..." --workspace-env OP_VAULT="..." --id agent1
devpod up . --workspace-env OP_SERVICE_ACCOUNT_TOKEN="..." --workspace-env OP_VAULT="..." --id agent2

devpod ssh agent1
```

## VS Code

After setup: `code .` → `Cmd+Shift+P` → "Reopen in Container"
