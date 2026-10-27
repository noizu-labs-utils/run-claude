# AGENT-README

> Orientation for AI coding agents working in this repo. Human docs: README.md.

## Type

python+cli-tool

## Purpose

Per-directory model routing for Claude Code & OpenCode, backed by a self-healing local LLM gateway: `cd` into a project and the directory's declared models are hot-registered on a running gateway, with Anthropic OAuth passthrough.

## Stack

Python >= 3.10 (hatchling, uv — not pip), litellm[proxy]; default gateway is the static Go binary `go-litellm`; Prisma-backed state (TimescaleDB container); catalog in `run_claude/models.yaml` + repo-root `profiles.yaml`.

## Dev mode

```bash
make dev         # uv sync --dev
make install     # uv tool install .
run-claude set-folder <profile> && direnv allow
run-claude status --health
```

## Ports / URLs

- 127.0.0.1:4443 — front proxy (auth swapping, OAuth passthrough)
- 127.0.0.1:4444 — LiteLLM proxy (legacy/Python chain; the default `go-litellm` gateway serves front proxy + LiteLLM on one port)
- 5433 — TimescaleDB host mapping (container 5432)

## Tests

```bash
make test        # uv run pytest (also make test-cov / make coverage-html)
```

## Gotchas

- Provider keys live in `~/.config/run-claude/.secrets` — never commit; `run-claude secrets init --generate` bootstraps.
- `callbacks/provider_compat.py` runs inside the LiteLLM proxy venv (`~/.local/share/litellm/.venv`), not the main run-claude process.
- Model registration is refcounted with a 15-minute lease; the `janitor` cleans up at refcount 0 — intentional stops are respected via a `stop.marker` sentinel.
- Profile resolution falls through user override → user → built-in; `model: null` disables and falls through.
- `prisma` is pinned ==0.11.0; XDG paths: config `~/.config/run-claude/`, state `~/.local/state/run-claude/`.
