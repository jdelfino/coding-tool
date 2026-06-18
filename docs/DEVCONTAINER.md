# Devcontainer Setup

The devcontainer is **local-only**: it needs no external accounts and no shared
secrets. On boot it installs the toolchain, starts a local Supabase stack, and
writes `.env.local` from the keys that local Supabase generates. This makes it
suitable for a classroom where every attendee runs the same exercise with zero
shared credentials.

## Quick Start

Open the repository in a Dev Container:

- **VS Code:** open the folder → `Cmd/Ctrl+Shift+P` → "Dev Containers: Reopen in Container".
- **DevPod / devcontainer CLI:**

  ```bash
  devpod up https://github.com/jdelfino/coding-tool
  ```

No `--workspace-env` flags or tokens are required.

## Prerequisites

- Docker
- VS Code with the Dev Containers extension, or DevPod / the devcontainer CLI

## What happens on first boot

- **`post-create.sh`** installs the toolchain: beads, Claude Code, npm
  dependencies, Playwright (Chromium), and nsjail (the local Python execution
  sandbox).
- **`setup-secrets.sh`** (runs on every start) runs `supabase start` and writes
  `.env.local` directly from `supabase status` — the local Supabase URL and the
  generated publishable/secret keys, plus `SYSTEM_ADMIN_EMAIL=admin@test.local`.
  `GEMINI_API_KEY` and the `UPSTASH_*` vars are written empty on purpose, so the
  AI walkthrough and rate limiting stay disabled locally.

`.env.local` is regenerated on every container start and is gitignored — don't
edit it by hand.

> First boot downloads the Supabase Docker images (~1GB), which can take a few
> minutes. A pre-baked image to skip this is tracked as a follow-up.

## The only manual step: GitHub auth

Everything above is automatic. The single manual step — and only if the exercise
has you open a pull request — is authenticating GitHub with **your own** account:

```bash
gh auth login
```

Fork the repo (or use "Use this template") so your branch and PR live under your
own account. There is no shared bot, token, or credential to configure.

## Claude Code

Each container gets a clean, isolated Claude config (a named volume, not your
host's `~/.claude`). Run `claude` and authenticate interactively on first use.

## Verify it works

```bash
npm run dev            # serves the app at http://localhost:3000
npm test               # Jest unit tests
```

Test login after `npx supabase db reset`: `admin@test.local` / `password123`.

## IDE / workspace options (DevPod)

```bash
# SSH only (no IDE)
devpod up https://github.com/jdelfino/coding-tool --ide none && devpod ssh <workspace-id>

# Isolated parallel workspaces with --id
devpod up https://github.com/jdelfino/coding-tool --id agent1 --ide none && devpod ssh agent1
```
