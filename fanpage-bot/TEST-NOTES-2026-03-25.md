# Test notes — 2026-03-25

## Scope
Smoke/replay sanity check for the new reasoning-first reply-brain bundle in `fanpage-bot/`.

## What was checked
- Existing end-to-end smoke workflow still covers the main webhook path:
  - shadow mode
  - live send with mocked Send API
  - mark_seen + send
  - retryable send
  - cooldown / allowlist / off-hours downgrades
  - complaint handoff
  - duplicate / page allowlist / postback / passive-event ignores
  - webhook signature verification
- Added `reasoningBundleChecks` to `src/cli-smoke.js` so smoke now also verifies the new bundle contract is present and parseable:
  - `knowledge/reply-brain-schema-v1.json`
  - `knowledge/policy-bank.json`
  - `knowledge/case-bank.json`
  - `knowledge/tone-guide.json`
  - `knowledge/response-pattern-bank.json`
- Guardrail slices asserted in smoke output:
  - `shipping_eta_general` stays low-risk + auto-reply-eligible in case memory
  - `order_status_request` stays handoff in case memory
  - `complaint_or_negative_feedback` stays handoff in case memory
  - shipping ETA policy bundle exists and still carries ambiguity notes
  - tone guide keeps the reasoning-first rule
  - pattern bank still forbids script-first misuse

## Regression found and fixed during smoke
- `pipeline.js` had already switched to the new `reasoningInput` contract (`message`, `triage_hint`, `grounding_bundle`).
- `ai-draft.js` / `fallback-draft.js` fallback path still partly assumed the old input shape.
- Result: smoke broke and low-risk FAQ flow risked collapsing into fallback `handoff` behavior.
- Fix applied: `fallback-draft.js` now accepts both the old grounded-input shape and the new reasoning-input shape, plus flattened fallback inputs.

## Current limitation
- Smoke currently proves the reasoning bundle contract is loadable and that main workflow behavior still holds.
- It does **not** yet prove model-side reasoning quality for every new bank field, because the runtime still mostly relies on deterministic fallback unless AI credentials are provided.
