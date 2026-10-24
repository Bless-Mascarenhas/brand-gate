# Known Limitations

This document records the real limitations of the Brand Gate prototype. It is rendered verbatim on the Transparency page.

## Product scope

1. **Simulated roles**: Creator, Manager and Reviewer are switched in the top bar for the demo; production would map roles to verified SSO identity claims (EM-008).
2. **Mock publishing only**: "Publish (mock)" changes the workflow state to `published_mock` and records an audit entry. Nothing is posted to Instagram. Real Graph API publishing (an optional stretch goal) is not implemented.
3. **Browser storage by default**: drafts, runs, workflow records, comments, audit logs, insight events, policy edits and feedback live in the browser's IndexedDB. Clearing site data removes them. The optional Supabase store (see 17) is off unless configured.
4. **Workflow enforcement is client-side**: every workflow change goes through `src/workflow/actions.ts`, which re-checks permissions, but because the records live in the browser a user with developer tools could edit IndexedDB directly. Tamper-resistant enforcement and a truly immutable audit log need a server-side store.
5. **Policy edits are local drafts**: Company edit mode (Manager only) re-indexes clauses, keeps a version history and changes the displayed pack hash, but the server-side gates and reviewers keep using the approved pack in `data/thrift-it`. Publishing edited policy to the pipeline is not implemented.
6. **Client-side pipeline orchestration and canvas compositing**: the Verify pipeline runs as a state machine in the browser (`usePipeline`) to stay within serverless time limits, and brand overlays are drawn with HTML canvas because serverless runtimes lack fonts.
7. **Intent preservation is deterministic**: the spec asks for an LLM judge scoring intent 1–5; this build checks deterministically that required elements survived a revision (`src/verify/intent.ts`).

## External services

8. **Live providers, partially verified (2026-10-24)**: Gemini (`gemini-3.5-flash`) and the Reviewer A slot (Groq, `openai/gpt-oss-120b`, via `GROQ_BASE_URL`) answered live calls (`npm run smoke`). NVIDIA (Reviewer B, `z-ai/glm-5.3`) accepted the key but never returned a response, so no live run includes Reviewer B, cross-examination or two-model consensus.
9. **Replays and benchmark are only partly live**: sample replays 1, 4, 7, 9, 11 and 12 and the Compare scenario `expired-offer` are live recordings (Gemini + Reviewer A only); the other six samples are deterministic (a critical gate blocks them before review), and five Compare scenarios are still hand-written illustrative fixtures because recording was stopped (Gemini returned 503 high-demand errors). `data/benchmark/results.json` is still the deterministic-only run; the live benchmark and calibration have not been run. Finish with `npm run record-replay -- --reviewers groq --only compare`, `npm run benchmark -- --reviewers groq` and `npm run calibrate`.
10. **Rate limiting without Upstash is per instance**: per-IP limits and the daily call budget use Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set; otherwise counters live in one server instance's memory and reset on cold start. The Upstash path is unit-tested only through its fallback; it has not been run against a real Redis.
11. **Provider data retention is not stated**: the Transparency page marks retention as "author to confirm" because it has not been verified against current provider terms.

## Measurement honesty

12. **Benchmark labels are not human-reviewed**: the 60 synthetic posts and labels were written with AI assistance (`labelsReviewed: false` on all 60; the UI shows 0/60). Some labels are arguably incomplete (e.g. `subtle-07` also has an emoji between words that the gate flags under AR-006, counted as a false positive). N = 30 per split is too small for statistical claims.
13. **Seeded Insights history is synthetic**: ~120 seeded events mix real gate findings on the sample posts with synthetic reviewer disputes, hallucinations and human decisions; they are labelled sample data and can be filtered out.
14. **Calibration mostly cannot move the verdict**: `evaluatePost` lists major as well as critical findings in `gatesFailed`, and scoring treats any failed gate as BLOCKED, so one major gate finding blocks (spec §11 blocks only on critical or score < 70). Weights and thresholds therefore only affect posts whose findings are all minor. On the dev split the sweep found a higher-recall setting (minor weight 8, READY ≥ 95); the shipped defaults were left unchanged pending human review.
15. **Remaining deterministic gate gaps**: delivery times, returns, COD limits and pop-up hours have no gate (left to LLM review); R-ACC-001 requires alt text only when an image is attached. Fixed during Phase 9 using sample posts and the dev split only: approved festival greetings were wrongly flagged by R-SOC-007, and "starting at just ₹299" evaded the price patterns. The held-out test-split metrics did not change.
16. **Compare live-run limits**: the governed column regenerates at most once to stay under the 60 s function limit, and one access-code check counts as one budget unit although the governed route makes several model calls. Token counts are shown only when the provider reports them.

## Infrastructure

17. **Optional Supabase store is single-tenant**: all users share one key-value table with no per-user rows; it is unit-tested with mocked HTTP and has not been run against a real Supabase project.
18. **Accessibility checks are partial**: theme colour contrast is tested automatically (`src/ui/__tests__/phase9.test.ts`) and keyboard flows were checked by hand in a browser; no full automated audit (e.g. axe) is part of `npm run check`, and older pages may still contain smaller issues.
