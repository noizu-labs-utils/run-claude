## How to: wire a Stop-hook transcript grader (component-eval, default OFF)

**Goal:** after each Claude Code turn, grade the turn with the component-eval classifiers — jev picks a `:choice` verdict, component-work turns also get an Alibaba 0-100 `:score` — and append one JSONL line to a run sink. This is wiring documentation for the **default-OFF** grading feature: nothing runs until you install the hook yourself, and the routing table it will eventually consult (`templates/models-routing.yaml`) is template-only with `MODELS_ROUTING=off` as the default.

**Prereqs:** genai with the `tobor-grade` CLI (`mix tobor_grade` task or the `tobor-grade` escript built via `mix escript.build` — genai PR #28); `JEV_API_KEY` (or `TYPESAFE_API_KEY`) for the jev lane; `QWEN_DECISION_BASE_URL` + `QWEN_API_KEY` for the Alibaba score lane. Never put key values in the hook — reference env var names only.

### Grading flow

1. **Extract the last turn** from the session transcript (`transcript_path` arrives in the Stop hook's stdin JSON): the newest user instruction, the model response, and any tool calls/result blocks. Tool-result echoes are not user turns.
2. **Render** the turn as a model message. If the turn contains **no tool calls**, append a user message `Grade.` and then the jev response as a model entry — the classifier conversation always ends on a model entry, so a plain text-only turn is padded with the literal `Grade.` prompt before grading.
3. **jev `:choice`** grades the rendered turn: `continuation | topic-switch | new-task | more-context-needed`.
4. **Component-work turns also get an Alibaba `:score`** — `tobor-grade --score` invokes `decision-model-preview` (0-100; the SystemOne adapter's inferred `:alibaba_rounded_hundredths` policy applies automatically — do not re-implement it).
5. **Walk-back**: a `more-context-needed` verdict walks the transcript back one real user turn and re-grades, capped at 5 attempts; the first turn is never dropped.
6. **Sink**: one JSONL line per run — `{component?, verdict, score?, transcript_path, walkback_used, timestamp}` — appended to `jsonl:<path>`.

### Recursion guard

The grading session itself must never be graded: the hook sets `TOBOR_GRADING=1` in the grader's environment, and `tobor-grade` **refuses to run when that variable is already set** (exit 3). Always launch the grader with the guard set:

```bash
# inside the Stop-hook script (sketch)
TOBOR_GRADING=1 tobor-grade \
  --transcript "$TRANSCRIPT_PATH" \
  --walkback 3 \
  --component "$COMPONENT_TAG" \
  --sink jsonl:"$RUN_DIR/grades.jsonl"
# exit 0 graded · 1 grading failure · 2 usage · 3 recursion guard
```

For the score lane add `--score`. Register the script as a Claude Code Stop hook in `settings.json` (`hooks.Stop`); keep the command short and point it at a stable script path — the hook body above is the whole contract.

### Turning routing on (later)

The routing table template lives at `templates/models-routing.yaml` (EXAMPLE entries). Routing is **off by default** (`MODELS_ROUTING=off`); when first enabled, run `MODELS_ROUTING=shadow` (log-only: the router records the model it would have chosen, traffic is unchanged) for the **first two weeks**, review the shadow logs, and only then switch to `MODELS_ROUTING=on`.

**Verify:** run the grader twice against a fixture transcript and confirm the sink has exactly two parseable JSON lines; run it once with `TOBOR_GRADING=1` already exported and confirm exit 3 with no sink append; grade a single-turn fixture with `--walkback 5` and confirm `walkback_used` stays 0 (nothing to walk back to).

**Gotchas:**
- `TOBOR_GRADING=1` is a guard, not a flag to grade harder — if grading mysteriously exits 3, a parent session exported it.
- `--walkback` above 5 is a usage error (exit 2), not a clamp.
- Sinks are append-only by design; never rewrite or delete other runs' lines.
- Stop hooks run on every turn — keep the extraction cheap and fail soft; a grading outage must never block the session.
