# run-claude — Landing Copy Deck

Page: single route `/` at **run-claude.therobotlives.com** · implemented in `web/` (Elixir Hologram)
Sources of truth: repo `README.md`, `profiles.yaml`, `run_claude/models.yaml`, `CLAUDE.md`, `LICENSE`
(MIT) — every claim below is repo-verifiable as of commit `b27c1d5` (2026-10-12).

**Design note (bypass):** no hero art / media-generation mockup loop. Example-led typography IS the
design — dark-first, monospace-forward. The hero's visual is a real install command and the real
tier table, not an illustration.

**Verified counts at `b27c1d5`** (parsed from `profiles.yaml` / `run_claude/models.yaml`):
**35 built-in profiles · 211 catalogued model definitions · 39 `[1m]` 1M-context aliases.**
These are catalogue numbers (`run-claude models list`); the live proxy serves only the models the
active profile registers (`run-claude models enabled`) — never conflate the two on the page.

---

## 1. JTBD summary

| Question | Answer |
|---|---|
| Trigger | A dev lives in Claude Code daily, watches API-token spend climb (or hits rate limits), and knows equal-or-better open models exist at a fraction of the price on other providers. |
| Job | Keep the exact Claude Code workflow — same CLI, same flags, same UX — while choosing which model actually answers, per project. |
| Today's alternative | Hand-rolled `ANTHROPIC_BASE_URL` exports + a proxy config they babysit by hand; or a hosted relay that wants their keys in someone else's cloud. |
| What's wrong with that | Silent 404s when a model isn't registered, auth-swapping hand-rolled per provider, nothing keeps it alive, and it only works on the one machine someone bothered to configure. |
| Switch trigger | Third time a hand-rolled setup 404s mid-task — or the first month-end API bill. |
| Objections | "Do my keys leave my machine?" · "Does it break Code features (tools, MCP, 1M context)?" · "Is it config sprawl?" · "Can I still use my subscription?" |

## 2. Positioning statement (Dunford form)

> For developers who live in Claude Code but want a say in what model answers,
> run-claude is a local model-routing gateway that maps Claude Code's opus / sonnet / haiku /
> fable tiers onto any provider's models — per directory, with your own keys.
> Unlike hosted relays and hand-rolled `ANTHROPIC_BASE_URL` hacks, everything runs on
> `127.0.0.1` — including OAuth passthrough so your Claude Pro/Max subscription is billed
> instead of the API when you want it.

## 3. Category POV (for launch posts, not the page)

- **Enemy:** the one-model tax — the idea that a coding agent and the model behind it must come as a bundle.
- **Shift:** open/alt-provider models now match frontier coding quality at a fraction of token cost.
- **New way:** the agent CLI and the model answering it should be independently configurable — and that config should live per project, like everything else about a project.
- **Proof:** `run-claude set-folder groq && direnv allow && claude`.

## 4. Message hierarchy

| Level | Copy |
|---|---|
| **Tagline** (≤7 words) | Claude Code. Your models. Your keys. |
| **One-liner** | run-claude routes Claude Code — and OpenCode — through a local gateway that maps the opus/sonnet/haiku/fable tiers onto any provider you bring. |
| **Paragraph** | run-claude is a self-healing, localhost-only LLM gateway for Claude Code and OpenCode. Declare a profile per project directory; entering it hot-registers that profile's models on the running gateway and routes the agent through it. 211 catalogued models across 35 profiles, OAuth passthrough for your Claude subscription, provider keys that never leave your machine. |
| **Benefit pillars** | Claude Code, your models · Your subscription, where it makes sense · Local gateway, no middleman |
| **Proof points** | 211 catalogued models · 35 built-in profiles · OAuth passthrough (claude-plan) · watchdog auto-restart (~5s poll) · this page itself is Elixir Hologram |

## 5. Landing-page copy block (final copy, implemented verbatim)

### SEO head

- **title:** `run-claude — Claude Code. Your models.`
- **meta description:** `run-claude routes Claude Code and OpenCode through a local, self-healing model gateway: map opus/sonnet/haiku/fable tiers to 211 models across 35 provider profiles. Your keys, your machine, OAuth passthrough for your Claude subscription.`

### Hero

- **Eyebrow:** `Per-directory model routing · Claude Code + OpenCode · MIT`
- **Headline:** `Claude Code. Your models.`
- **Subhead:** `run-claude routes Claude Code — and OpenCode — through a local, self-healing model gateway. Map the opus / sonnet / haiku / fable tiers onto any provider you bring, per project directory. Your keys, your machine, your economics.`
- **Primary CTA:** button `Install from source` → `#install`; adjacent copy-paste block:

  ```bash
  git clone https://github.com/noizu/run-claude && cd run-claude
  make install
  run-claude secrets init --generate
  ```

- **CTA fine print:** `Local-only gateway (127.0.0.1) · BYO API keys · MIT licensed`
- **Secondary CTA:** `See the tier mappings` → `#tiers`

### Benefit blocks ×3

1. **Claude Code, your models.** Keep the Code UX, swap the economics. Directory-scoped profiles
   map the opus / sonnet / haiku / fable tiers onto 211 catalogued models across 35 provider
   profiles. `cd` into a project and that project's models come with it — no flags, no restarts.
2. **Your subscription, where it makes sense.** The `claude-plan` profile forwards Anthropic
   requests with your original OAuth token — Pro/Max billing, not API billing — while other
   providers in the same profile use their own keys. Blend all of it in one profile.
3. **Local gateway, no middleman.** Front proxy and gateway run on `127.0.0.1`; your keys stay in
   `~/.config/run-claude/.secrets`. A watchdog daemon restarts crashed proxies (~5s poll), a
   janitor expires idle models after a 15-minute lease, and the default gateway is a single
   static Go binary.

### Tier table (REAL mappings from `profiles.yaml` at `b27c1d5`)

Section heading: **Tier mappings are one YAML stanza** · sub-line: `Every profile maps Claude Code's
model tiers. User overrides in ~/.config/run-claude/profiles/ win over built-ins; model: null
disables an entry.`

| Profile | fable | opus | sonnet | haiku |
|---|---|---|---|---|
| `anthropic` | claude-fable-5-1 | claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5-20251001 |
| `claude-plan` (OAuth) | claude-fable-5-1 | claude-opus-5 | claude-sonnet-5 | claude-haiku-4-5-20251001 |
| `wafer` | wafer/kimi-k3[1m] | wafer/glm-5.3-flash (max)[1m] | wafer/qwen3.5-397b-a17b (high)[1m] | wafer/deepseek-v4-flash-0731-fast[1m] |
| `zai-pro` | zai/glm-5.3 (sub) | zai/glm-5.3-flash (sub) | zai/glm-5.3-flash (sub) | zai/glm-5.3-flash (sub) |
| `cerebras` | cerebras/zai-glm-4.7 | cerebras/qwen-3-235b-a22b-instruct-2507 | cerebras/gpt-oss-120b | cerebras/llama-3.3-70b |
| `alibaba` | alibaba/deepseek-v4-pro-0813 | alibaba/qwen3.8-max | alibaba/glm-5.2 | alibaba/qwen3.6-flash |

Caption under table: `Six of 35 built-in profiles. [1m] marks a 1M-context alias; (sub) marks a
subscription-key binding. Groq, DeepSeek, OpenAI, Gemini, Grok, Azure, Mistral, Perplexity,
OpenRouter, and local Ollama/vLLM ship too — or write your own.`

### How it works (3 steps)

1. **Point a directory at a profile** — `run-claude set-folder groq && direnv allow`. One `.envrc`,
   one stable directory token.
2. **Enter the directory** — the shell hook hot-registers the profile's models on the running
   gateway (refcounted, leased, janitored) and swaps auth per provider. Anthropic requests keep
   your OAuth token; everything else uses the gateway master key.
3. **Run `claude`** — tier env vars are already set, requests flow through `127.0.0.1:4443`, and
   the CLI sees the live catalog via its bootstrap endpoint. `run-claude with groq` does the same
   in a one-shot without pinning the directory.

### Install (honest, prerequisites first)

Section heading: **Install** · sub-line: `run-claude installs from source. Packaged installs are
planned — for now, clone and make.`

**Single source for the install preamble:** the three command blocks (hero quick start, Install
section, closing CTA) share their first lines character-for-character; the Install section block
is canonical — change it there first, then mirror in the hero and CTA blocks.

**Prerequisites (stated up front, as a list):**

- Python 3 + [uv](https://docs.astral.sh/uv/) — the CLI is installed with `uv tool install .`
- Go 1.22+ — `make install` builds the default `go-litellm` gateway binary (skipped with a warning if absent —
  without Go there is no default gateway until you install it and run `make install-go-litellm`)
- Docker — only for the legacy Python proxy chain's database; the default `go-litellm` gateway is a static
  binary with no DB (verified: `start_proxy` returns before the DB auto-start block in unified-gateway mode)
- [direnv](https://direnv.net/) — per-directory activation
- Claude Code and/or the OpenCode CLI — the agents being routed

**Steps:**

```bash
git clone https://github.com/noizu/run-claude && cd run-claude
make install                        # builds go-litellm gateway, then uv tool install .
run-claude secrets init --generate  # provider API keys + auto-generated DB password

cd /path/to/my/project
run-claude set-folder cerebras      # writes .envrc; prints your stable directory token
direnv allow

claude                              # models registered on entry; just works
run-claude status --health          # verify: proxies, DB, refcounts as JSON
```

Fine print: `run-claude is not on PyPI — install from source as above. Provider keys live in
~/.config/run-claude/.secrets; never commit that file.`

### FAQ (objection row)

1. **Do my API keys leave my machine?** No. Keys live in `~/.config/run-claude/.secrets` and are
   read by the gateway on your localhost. Provider calls go from your machine to the provider —
   there is no hosted relay, no account, and nothing to opt out of.
2. **Does it break Claude Code features?** No. Code still speaks the Anthropic API it already
   speaks: the front proxy serves the CLI's bootstrap endpoint, pre-registers `[1m]` 1M-context
   aliases (39 of them) so big-context requests route instead of 404, and a provider-compat
   callback strips fields strict providers reject. Tools, MCP, sessions — unchanged.
3. **Which providers are supported?** Anthropic, OpenAI, Z.AI, Groq, Cerebras, Wafer, Alibaba
   (Qwen Token Plan), DeepSeek, Gemini, Azure, Grok, Mistral, Perplexity, OpenRouter — plus local
   Ollama / vLLM / LM Studio. 35 built-in profiles, 211 catalogued model definitions.
4. **Where does the configuration live?** Built-ins ship with the tool. Your overrides in
   `~/.config/run-claude/profiles/` and `~/.config/run-claude/models.yaml` take priority — same
   name wins, `model: null` disables and falls through. Per-directory routing is a `.envrc`.
5. **Can I still use my Claude Pro/Max subscription?** Yes — that's the `claude-plan` profile:
   your original OAuth token is forwarded, so subscription billing applies to Claude models while
   other providers in the profile bill their own keys.
6. **What's the license?** MIT. Fork it, fork the gateway, ship your own profile pack.

### Final CTA

`Claude Code. Your models.` · button `Install from source` → `#install` (same code block).

### Footer

`run-claude — open source, MIT` · GitHub: `github.com/noizu/run-claude` · `This site is Elixir
Hologram.` · disclaimer line: `run-claude is an independent open-source tool, not affiliated with
or endorsed by Anthropic. Claude Code is a product of Anthropic; provider and model names are
trademarks of their respective owners.`

---

## Voice rules

- Dev-tool, example-led, zero fluff. Every claim names a mechanism.
- No invented metrics, no testimonials, no pricing claims about providers.
- Never split the message: "Claude Code, your models" is the pillar phrase everywhere.
- Honesty edge: run-claude DOES run a local proxy — say so plainly and sell the localhost/no-cloud
  property instead of pretending there's no proxy at all. The trade-off (two local processes, small
  first-registration latency) is acknowledged in the repo README; keep the page consistent with it.
- Install honesty (REQUIRED): clone + `make install` only. Never advertise pip/PyPI, a one-liner,
  `curl | sh`, or homebrew. Packaged installs may be described as *planned* — never as available.
- Catalogue vs live: `211 models / 35 profiles` are catalogue numbers; the running proxy serves
  only what the active profile registers. Quote catalogue numbers as catalogue numbers.
- No internal hostnames, cluster names, secret names, or company email addresses in page copy.
  Neutral placeholders only. run-claude is not affiliated with Anthropic — say so once, plainly.
