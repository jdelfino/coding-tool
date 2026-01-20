# Devcontainer Setup

## Quick Start

```bash
brew install loft-sh/tap/devpod

devpod up . \
  --env OP_SERVICE_ACCOUNT_TOKEN="$OP_SERVICE_ACCOUNT_TOKEN" \
  --env OP_VAULT="my-vault"
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

| Item | Type | Fields |
|------|------|--------|
| SSH key | SSH Key | (auto) |
| `git-config` | Secure Note | `name`, `email` |
| `github-token` | API Credential | `token` |
| `claude-credentials` | Secure Note | `credentials` |
| `secrets` | Secure Note | `system-admin-email`, `gemini-api-key` |

SSH key lookup order:
1. SSH Key items tagged `devcontainer`
2. Any SSH Key item in vault
3. Item named `ssh-key` with field `private key`

Alternative for Claude: item `claude-api-key` with field `credential`

## Creating Service Account

1. [my.1password.com](https://my.1password.com) → Developer Tools → Service Accounts
2. Create account with read-only access to your vault
3. Set token: `export OP_SERVICE_ACCOUNT_TOKEN="..."`

## Multiple Workspaces

```bash
devpod up . --env OP_SERVICE_ACCOUNT_TOKEN="..." --env OP_VAULT="..." --id agent1
devpod up . --env OP_SERVICE_ACCOUNT_TOKEN="..." --env OP_VAULT="..." --id agent2

devpod ssh agent1
```

## VS Code

After setup: `code .` → `Cmd+Shift+P` → "Reopen in Container"
