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

> First boot pulls the Supabase Docker images — roughly **13 GB on disk** once
> extracted (the Postgres image alone is ~5.5 GB), so the download is several GB
> and can take a few minutes on classroom Wi-Fi. This is the dominant first-boot
> cost. A pre-baked image to skip it is tracked as a follow-up.

## First-boot vs. warm-boot timing

Measured in a clean container (4 cores; cold figures are network-bound, so treat
them as ballpark for planning a session):

| Step | Cold (first boot) | Warm (images + deps cached) |
|------|-------------------|-----------------------------|
| `npm install` (deps) | ~30 s + download | ~25 s (`npm ci`, cache warm) |
| Supabase image pull | several min (~13 GB on disk) | — (cached) |
| `supabase start` | adds ~30–40 s on top of the pull | ~35 s |
| `npm run dev` → "Ready" | ~6 s | ~6 s |
| `npm test` (Jest) | ~35 s | ~20 s |
| Playwright + nsjail (post-create) | a few min | — (cached) |

**Teaching takeaway:** the only slow part is the cold Docker image pull. A second
`supabase start` is ~35 s, and the app is serving ~6 s after that. Pre-baking the
devcontainer image (follow-up) collapses the cold path to the warm numbers.

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
