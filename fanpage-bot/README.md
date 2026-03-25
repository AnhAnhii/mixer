# fanpage-bot

Webhook-first MVP service for Facebook Fanpage auto-reply in safe draft/shadow mode.

## Current scope
- Normalize Messenger webhook payloads
- Rule-based triage hints
- Build grounded AI input payload with selected knowledge-bank context (`policy-bank`, `case-bank`, `tone-guide`, `response-pattern-bank`) plus legacy grounding reference
- Attach runtime-safe `sales_assist` hints (buyer intent / consult priority / guardrails) without turning them into product facts
- AI draft wrapper with safe fallback when no credentials are present
- Reasoning-first draft contract (`understanding`, `decision`, `reply`, `ops_meta`) while preserving legacy top-level fields for pipeline compatibility
- Policy guard
- Delivery decision in draft/shadow mode or live send mode
- Facebook Send API adapter (with optional `mark_seen` before reply)
- Webhook signature verification for production deployments
- JSONL audit logging
- JSONL raw webhook event logging for replay/debugging
- JSONL pending handoff queue for human follow-up
- Idempotency guard to ignore duplicate webhook retries by message id
- Per-thread cooldown guard to avoid repeated auto-sends in the same conversation within a short window
- Local smoke runner for sample payloads

## Environment
Optional for AI:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)

Required for live send mode:
- `FB_PAGE_ACCESS_TOKEN`

Recommended for production webhook verification:
- `FB_APP_SECRET`

Flags:
- `AUTO_REPLY_ENABLED=false`
- `AUTO_REPLY_SHADOW_MODE=true`
- `AUTO_REPLY_CONFIDENCE_THRESHOLD=0.9`
- `SUPPORT_WINDOW_START_HOUR=8`
- `SUPPORT_WINDOW_END_HOUR=23`
- `SUPPORT_TIMEZONE_OFFSET_MINUTES=420`
- `LOG_STORE_PATH=./data/logs/audit.jsonl`
- `HANDOFF_STORE_PATH=./data/logs/pending-handoffs.jsonl`
- `DEDUPE_STORE_PATH=./data/logs/processed-message-ids.json`
- `DEDUPE_MAX_KEYS=5000`
- `THREAD_STATE_STORE_PATH=./data/logs/thread-state.json`
- `THREAD_STATE_MAX_THREADS=5000`
- `AUTO_REPLY_THREAD_COOLDOWN_MINUTES=15`
- `FB_SEND_TIMEOUT_MS=8000`
- `FB_SEND_MAX_ATTEMPTS=2`
- `FB_SEND_RETRY_BACKOFF_MS=400`
- `FB_SEND_MARK_SEEN_BEFORE_REPLY=false`
- `RAW_EVENT_STORE_PATH=./data/logs/raw-events.jsonl`
- `FANPAGE_BOT_PIPELINE_VERSION=0.1.0`
- `FANPAGE_BOT_POLICY_VERSION=mixer-reply-policy-v1`
- `FANPAGE_BOT_PROMPT_VERSION=mixer-grounded-ai-prompt-v1`
- `FANPAGE_BOT_GROUNDED_DATA_VERSION=mixer-grounded-ai-data-v1`

## Run local smoke
```bash
cd fanpage-bot
npm run smoke
```

AI draft contract now includes both:
- reasoning-first fields: `understanding`, `decision`, `reply`, `ops_meta`
- legacy compatibility fields still mirrored at top level: `reply_text`, `action`, `confidence`, `needs_human`, `missing_info`, `reason`, `policy_refs`, `safety_flags`

Smoke output now includes:
- `shadowOutputs`: what would happen in safe shadow mode
- `liveOutputs`: mocked send flow proving `auto_send -> Send API adapter -> audit log`
- `markSeenOutputs`: proves optional `mark_seen` can be sent before the text reply in live mode
- `retryableSendOutputs`: proves a temporary 500 from Send API gets retried once and then succeeds cleanly
- `duplicateSecondPass`: proves duplicate webhook retries get ignored instead of being re-processed/re-sent
- `cooldownOutputs`: proves a second low-risk message in the same thread gets downgraded during cooldown instead of auto-sending again immediately
- `offHoursOutputs`: proves low-risk FAQs get downgraded to `draft_only` outside support hours instead of being auto-sent
- `complaintShippingOutputs`: proves complaint-like messages mentioning shipping still get classified as handoff, not FAQ auto-reply
- `pricingOutputs`: proves pricing/promo asks now enter a dedicated conservative runtime path (`pricing_or_promotion`) and stay draft-only without grounded product/commercial data
- `shortAmbiguousOutputs`: proves overly short low-context questions like `ship?` do not auto-send
- `multiIntentOutputs`: proves one message asking multiple FAQ intents at once gets held back for safer draft/handoff handling
- `disallowedPageOutputs`: proves events from a non-allowlisted page get audited as `ignore` instead of entering the reply pipeline
- `passiveEventOutputs`: proves Messenger passive events like `delivery`, `read`, and `echo` are now audit-logged explicitly as ignored instead of being dropped silently
- `signatureChecks`: proves `X-Hub-Signature-256` verification passes with a valid raw body/signature, fails on mismatch, and reports `raw_body_unavailable` when only parsed JSON is available
- `reasoningBundleChecks`: parses the new reasoning-first knowledge bundle (`reply-brain-schema`, policy/case/tone/pattern banks) and verifies core contract slices for shipping ETA, order-status handoff, complaint handling, pricing guardrails, and pattern/tone guardrails without breaking the main webhook smoke flow
- `draftContractChecks`: verifies representative AI draft outputs still expose both the new reasoning-first shape and the legacy flat fields that the guard/delivery pipeline already depends on, plus runtime `sales_assist_meta`

## Inspect pending human handoffs
```bash
cd fanpage-bot
npm run handoffs -- 20
```

This reads `data/logs/pending-handoffs.jsonl`, subtracts anything already resolved from `data/logs/handoff-resolutions.jsonl`, and prints the newest still-open cases first.

## Resolve a handoff after a human handled it
```bash
cd fanpage-bot
npm run handoff:resolve -- mid.local.2 "done by agent"
npm run handoff:resolve -- facebook:105265398928721:test-psid-2 "handled in inbox"
```

This appends a lightweight resolution record so the open handoff queue stays usable instead of growing forever.

## Summarize audit metrics
```bash
cd fanpage-bot
npm run metrics
npm run metrics -- data/logs/audit.jsonl 200
```

This summarizes the audit JSONL into quick rollout metrics: inbound count, unique threads, case mix, decisions, send outcomes, duplicate ignores, top safety flags, and rollout version slices (`policy_version`, `prompt_version`, `ai_mode`, `ai_model`).

## Run the focused continuity regression check
```bash
cd fanpage-bot
npm run continuity:check
```

This is the fastest repeatable check after any continuity-related fix. It seeds minimal thread state, replays follow-up messages through the real pipeline, and returns a tight pass/fail summary for the risky continuity behaviors that most easily regress:
- pricing detail acknowledgement
- stock follow-up continuity
- order-status follow-up continuity
- complaint follow-up continuity

What it validates:
- follow-up stays on the original risky case instead of falling back to `unknown`
- delivery stays non-auto (`handoff` / `draft_only`)
- the bot acknowledges newly provided detail/identifier info instead of asking for it again
- thread memory clears `pending_customer_reply` once the requested info arrives
- expected slot resolution is visible in `thread_memory_after`

Use `npm run production:check` for the audit/log-oriented production readback lanes, especially shipping ETA and shipping -> order escalation. `continuity:check` is the fast local regression helper for stateful follow-up behavior before/alongside that production readback.

Artifacts are isolated under `data/tmp/continuity-check/` so this check does not pollute normal logs/state.

## Summarize the production validation cases from the runbook
```bash
cd fanpage-bot
npm run production:check
npm run production:check -- data/logs/audit.jsonl 200
```

This scans recent audit JSONL and outputs a compact pass/fail bundle for the current manual production round:
- A. shipping ETA
- B. pricing follow-up continuity
- C. order-status follow-up continuity
- D. complaint / negative feedback

For each case it reports:
- observed case types
- observed delivery decisions
- continuity thread count
- one compact sample (customer text, reply, active issue before/after)
- notes for likely fail signs such as `unknown`, FAQ auto-send on risky cases, or reply drift on canonical shipping ETA wording
- `operator_report_lines` for cleaner human readback
- `report_markdown` so you can paste a compact validation report without hand-rewriting the evidence

## Replay a real webhook payload from file
```bash
cd fanpage-bot
npm run replay -- ../tmp/facebook-webhook-sample.json
npm run replay -- ../tmp/facebook-webhook-sample.json 5
```

This runs the real pipeline against a saved webhook JSON payload, then prints a compact summary plus the newest processed outputs. Useful for comparing local behavior against real Facebook events without editing the smoke fixture.

## Build a replayable webhook payload from raw event JSONL
```bash
cd fanpage-bot
npm run replay:extract -- ../mixer/data/logs/raw-events.jsonl ../tmp/replay/extracted-webhook.json 20
npm run replay -- ../tmp/replay/extracted-webhook.json
```

This is the fast path when you only have append-only raw event logs instead of a full saved webhook body. It reconstructs a minimal `object=page` webhook payload grouped by `page_id`, then replays it through the same pipeline.

## Notes
- Production safety still comes from flags. Keep `AUTO_REPLY_ENABLED=false` and `AUTO_REPLY_SHADOW_MODE=true` until Saram is ready.
- `AUTO_REPLY_ALLOWED_CASES` lets you roll out live sending per case without changing code; anything outside this allowlist falls back to draft/handoff.
- Messenger `postback` events are now explicitly ignored and audited as `postback_ignored`, so button/menu traffic does not contaminate the text-reply pipeline.
- Messenger passive/non-reply events like `delivery`, `read`, and `echo` are also audit-logged as ignored, which keeps the webhook trail complete without feeding those events into reply generation.
- If AI credentials are missing, the pipeline still runs using deterministic fallback drafts built from the new knowledge banks instead of only hardcoded reply strings.
- Pricing/promo asks now map into `pricing_or_promotion` at runtime. The default response is intentionally conservative: collect the exact product need and avoid claiming current price/promo until grounded data exists.
- `src/grounding.js` now selects case-relevant slices from `knowledge/policy-bank.json`, `case-bank.json`, `tone-guide.json`, and `response-pattern-bank.json`, while still attaching the older legacy grounding blob for reference/backward compatibility.
- The grounding bundle also carries `sales_assist` hints (`buyer_intent_hint`, `lead_strength_hint`, `signals`, `recommended_sales_motion`) so future consult/chốt-đơn flows can prioritize the right threads without hallucinating catalog facts.
- If `FB_APP_SECRET` is set, webhook POSTs are verified with `X-Hub-Signature-256` before entering the pipeline. This requires access to the raw request body (`req.rawBody` or an unparsed string/buffer body); if the deploy target only exposes parsed JSON, verification fails closed with `raw_body_unavailable`.

## Current deploy wiring
- `mixer/api/webhook/facebook.ts` now delegates directly to `fanpage-bot/src/webhook.js`.
- This keeps the real Vercel-style endpoint thin while `fanpage-bot/` stays the single pipeline source of truth.
