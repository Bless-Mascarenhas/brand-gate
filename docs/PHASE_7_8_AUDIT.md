# Phase 7 & 8 Audit

Spec: `thrift-it-build-prompt.md` §10–15, §19–23, §22 (Phase 7, Phase 8).
Classifications: COMPLETE AND VERIFIED · IMPLEMENTED BUT UNVERIFIED · PARTIALLY IMPLEMENTED · BROKEN · MISSING · BLOCKED BY EXTERNAL DEPENDENCY.

## 1. Baseline (before any change, commit `542d816`, 2026-10-24)

| Item | Observed |
|---|---|
| Working dir | `D:\brank-gate`, branch `master`, clean except untracked `.serena/` and an empty untracked file `inside` (not touched) |
| Dependencies | `node_modules` absent → first `npm run check` failed with `'tsc' is not recognized`. Installed with `npm ci`. |
| `npm run check` script | `tsc --noEmit && eslint . && vitest run && next build` — correct, all four stages |
| `tsc --noEmit` | **FAIL** — 2 × TS2322 in `app/(shell)/compare/page.tsx` (lines 326, 332) |
| `eslint .` | **FAIL** — 4 errors (`react-hooks/rules-of-hooks`, conditional `useState` in `compare/page.tsx`), 3 warnings |
| `vitest run` | PASS — 10 files, 89 tests |
| `next build` | not reached (chain stops at tsc) |
| Provider credentials | none configured in this environment (no `.env`/`.env.local`) |

The last commit (`542d816 feat: extend compare benchmark and workflow`) left the check red.

## 2. Phase 7 — Workflow & Insights (initial state)

| # | Requirement | Implementation found | Behaviour observed | Tests | Status | Work required |
|---|---|---|---|---|---|---|
| 7.1 | Creator/Manager/Reviewer roles + switcher | `src/types` `RoleSchema`; `TopBar` switcher; `AppContext` persists role | Works | none | IMPLEMENTED BUT UNVERIFIED | Keep; add "simulated roles" disclosure on Workflow |
| 7.2 | Disclosure that roles are simulated | Only in `KNOWN_LIMITATIONS.md` / EM-008 text | Not shown in Workflow UI | none | PARTIALLY IMPLEMENTED | Visible label in Workflow |
| 7.3 | Centralised permission matrix (`src/workflow/permissions.ts`) | `transitionMatrix`, `canTransition`, `transitionState` | Only checks role per transition; critical guard uses any finding incl. overridden ones; creator can publish | **none** | PARTIALLY IMPLEMENTED | Action-level permissions, tests |
| 7.4 | Required approvers from escalation matrix (EM-001..004) | — | Not implemented; a single reviewer click approves anything without critical | none | MISSING | `requiredApprovers(findings)` + multi-approval |
| 7.5 | Critical override: Manager only, written justification (EM-007, ≥20 chars) | Only in Build page UI (`handleApproveAnyway`), not in workflow | Not enforced in workflow; not persisted | none | PARTIALLY IMPLEMENTED (Build only) | Override action in workflow layer |
| 7.6 | State machine `draft → in_review → changes_requested → approved → published_mock` | Matrix exists | Transitions work in memory | none | IMPLEMENTED BUT UNVERIFIED | Tests for valid/invalid/unauthorised |
| 7.7 | Append-only audit log (who, role, action, before/after, ts, pack hash) | `addAuditLog` | Pack hash hardcoded `'seeded-pack'`; ids `Math.random`; not persisted | none | PARTIALLY IMPLEMENTED | Real pack hash, persistence, tests |
| 7.8 | Review queue: 6 seeded posts, sample label, filters (state/severity/category/role) | `ReviewQueue.tsx`, `seedData.ts` | **5** posts; fake findings citing nonexistent clauses (`clause-f-002-1`); no filters; no sample label | none | PARTIALLY IMPLEMENTED | 6 real seeded posts with gate findings, filters, labels |
| 7.9 | Queue reflects stored records / survives reload | `useState(seededWorkflowPosts)` | All changes lost on reload; storage adapter unused | none | BROKEN | Persist via `StorageAdapter` |
| 7.10 | Post-level and finding-level comments | `Comment` type only | No UI, no logic | none | MISSING | Implement |
| 7.11 | Revision history, word-level diffs, score per revision | `Revision` type; `compare/diff.ts` (field-level JSON diff) | No word diff; no way to add a revision | none | PARTIALLY IMPLEMENTED | Word diff (`diff.diffWords`), add-revision action |
| 7.12 | Side-by-side compare of any two revisions | `RevisionDiffViewer` in Compare page | Conditional hooks (lint error), reads seed not store, not side-by-side | none | BROKEN | Rebuild inside Workflow |
| 7.13 | Change requests with reasons | Build page only, not persisted | — | none | PARTIALLY IMPLEMENTED | Workflow action with reason, logged as `human_rejection` |
| 7.14 | Insights: violations by category over time | `insights/page.tsx` constant array, no time axis | **Hardcoded** | none | MISSING (decorative) | Aggregate from events |
| 7.15 | Most-violated clauses | — | — | none | MISSING | Aggregate |
| 7.16 | First-pass vs post-fix score distribution | Constant | Hardcoded | none | MISSING (decorative) | Aggregate |
| 7.17 | Avg iterations to READY | Constant + KPI "1.8" | Hardcoded | none | MISSING (decorative) | Aggregate |
| 7.18 | Ambiguity Index per clause | Constant with `index` literals (e.g. BV-007 = 0.42 while (18+7+4)/69 = 0.42 — typed, not computed) | Hardcoded; no zero-denominator handling | none | MISSING (decorative) | Pure function + tests |
| 7.19 | Evidence for ambiguous clauses | Constant counts | Hardcoded | none | MISSING | From events |
| 7.20 | Suggested clarifications (top 3), labelled suggestion, link to clause | Constant text labelled "AI-drafted (Gemini)" though never generated | Mislabelled: claims Gemini authorship of hardcoded text | none | BROKEN (honesty) | Live Gemini draft when available, otherwise honestly-labelled template |
| 7.21 | Rule coverage by clause | Constant per category | Hardcoded, not from `rules.json` | none | MISSING (decorative) | Compute from pack |
| 7.22 | Cumulative hallucinations blocked + source model | Constant | Hardcoded | none | MISSING (decorative) | From events |
| 7.23 | ~120 seeded events labelled sample; live distinguished | No events exist; label claims "live runs append" but nothing appends | — | none | MISSING | Seed file + live event recording |
| 7.24 | Aggregate by team/role, no individual ranking | — | — | none | MISSING | Role aggregation |

## 3. Phase 8 — Compare, Benchmark, Calibration, Replay (initial state)

| # | Requirement | Implementation found | Behaviour observed | Tests | Status | Work required |
|---|---|---|---|---|---|---|
| 8.1 | Column A bare AI (minimal prompt) | `/api/llm/baseline` returns `{bareOutput:''}` | **Stub** | none | MISSING | Implement route + prompt builder |
| 8.2 | Column B AI + policies, single pass | same stub | Stub | none | MISSING | Implement |
| 8.3 | Column C full governed pipeline | Compare page shows `PRECOMPUTED` constants; "Run" is `setTimeout(1200)` | **Hardcoded fake run** | none | MISSING (decorative) | Server governed run reusing gates/verifier/consensus/scoring |
| 8.4 | Six scenarios | 6 present (stale offer, greenwashing, wrong price, wrong shipping, collab, festival) — competitor disparagement missing, wrong-shipping extra | Partly matches | none | PARTIALLY IMPLEMENTED | Replace wrong-shipping with competitor jab |
| 8.5 | Same independent scorer for all columns | Constants | Not computed | none | MISSING | Gate engine + `computeScoreAndVerdict` on every column |
| 8.6 | Metrics: gate failures, stale facts, banned terms, claims, a11y, severities, score, wall time, LLM calls, tokens | Constants; page says "pre-computed using scripts/benchmark.ts" — that script does not exist | Misleading label | none | BROKEN (honesty) | Measure; show "unavailable" where unknown |
| 8.7 | `data/benchmark/posts.json` (60 posts, 30/30, 20/20/20, labels, `labelsReviewed`) | — | — | none | MISSING | Author dataset |
| 8.8 | `scripts/benchmark.ts` + metrics | — (`/benchmark` page is a `setTimeout` "score = 100 − revisions×10") | Fake | none | MISSING | Script + pure metric module |
| 8.9 | `scripts/calibrate.ts` → `calibration.json`, dev only | — | — | none | MISSING | Script + isolation test |
| 8.10 | `scripts/record-replay.ts`, `data/replay/` for 12 samples + 6 scenarios | — (Replay mode only skips LLM calls in `usePipeline`; nothing recorded) | Mislabelled as replay | none | MISSING | Recorder, schema, loader, viewer |
| 8.11 | "Recorded run, not live" badge; works without keys; error on corrupt data | — | — | none | MISSING | Implement |
| 8.12 | Provider failure / budget → Replay | `callLLM` returns `modeSuggestion:'replay'`; `/api/providers` suggests replay | Suggestion exists but nothing to replay | none | PARTIALLY IMPLEMENTED | Wire Compare/Verify to real replays |
| 8.13 | Optional Supabase adapter | — | — | none | MISSING (optional) | Server-proxied adapter behind `StorageAdapter` |

## 4. Other observations (not changed unless needed)

- `src/rules/engine.ts` puts **major** gate findings in `gatesFailed`, and `computeScoreAndVerdict` treats any `gatesFailed` as BLOCKED; spec §11 only blocks on critical. Phase 3/5 behaviour, outside this scope; the Compare/benchmark scorer reuses it unchanged so all columns are scored identically. Recorded in KNOWN_LIMITATIONS.
- `callLLM` falls back to hardcoded model IDs when env vars are empty (spec §0 says model IDs come only from env). Phase 4; noted, not changed.

## 5. Final state

_Filled in after implementation — see sections 6–7._

## 6. Phase 7 — after implementation

| # | Status | Evidence |
|---|---|---|
| 7.1 Roles + switcher | COMPLETE AND VERIFIED | Role switch in browser changed the approve button from "required from reviewer, not manager" to enabled for Reviewer |
| 7.2 Simulated-roles disclosure | COMPLETE AND VERIFIED | Workflow header: "Simulated roles for the demo … production would use SSO (EM-008)" |
| 7.3 Centralised permissions | COMPLETE AND VERIFIED | `src/workflow/permissions.ts`, `src/workflow/actions.ts`; `workflow.test.ts` "actions throw WorkflowPermissionError for unauthorised roles" |
| 7.4 Required approvers (escalation matrix) | COMPLETE AND VERIFIED | `requiredApprovers` + 6 escalation tests incl. dual approval |
| 7.5 Critical override Manager-only + justification | COMPLETE AND VERIFIED | `canOverride`, 5 tests; browser: Manager override on wf-003 logged as `override_finding` |
| 7.6 State machine | COMPLETE AND VERIFIED | transition tests (valid, undefined, unauthorised, terminal state) |
| 7.7 Audit log | COMPLETE AND VERIFIED | real pack hash, sequential ids, append-only test, persisted |
| 7.8 Review queue, 6 seeded posts, filters, labels | COMPLETE AND VERIFIED | `data/seed/workflow.json` (built by `npm run seed` with real gate findings); filters state/severity/category/waiting-on-role; "sample data" badges |
| 7.9 Persistence across reload | COMPLETE AND VERIFIED | storage tests (reload, corrupt data); browser: approval survived page reload |
| 7.10 Comments | COMPLETE AND VERIFIED | post- and finding-level; tests incl. reload persistence |
| 7.11 Revisions, word diff, score per revision | COMPLETE AND VERIFIED | `addRevision` re-runs `/api/gates`; `revisionWordDiff` tests |
| 7.12 Compare any two revisions side by side | COMPLETE AND VERIFIED | browser: Creator edit created v2 (re-gated: 100 → 85), panel defaulted to v1 vs v2 and highlighted the added word; bug where selectors stayed on v1 fixed by remounting per revision |
| 7.13 Change requests with reasons | COMPLETE AND VERIFIED | reason chip + text required; recorded as `human_rejection` |
| 7.14–7.22 Insights charts | COMPLETE AND VERIFIED | all from `src/insights/aggregate.ts` (14 tests); browser shows 120 sample + live events, "Live only" filter |
| 7.18 Ambiguity Index incl. zero denominator | COMPLETE AND VERIFIED | `ambiguityForClause` returns `null` when never checked (test) |
| 7.20 Clarifications labelled as suggestions | COMPLETE AND VERIFIED (template path); live Gemini path BLOCKED BY EXTERNAL DEPENDENCY (no key) | browser: 401 without access/keys → labelled template |
| 7.23 Seeded vs live labelling | COMPLETE AND VERIFIED | store test: caller cannot store `sample:true`; UI counts both |
| 7.24 Aggregate by role only | COMPLETE AND VERIFIED | `humanDecisionsByRole` test asserts no user field |
| Live event recording | IMPLEMENTED; Verify/Build paths need live keys to exercise end to end | `usePipeline` + Build page append check events; workflow actions append human events (verified in browser) |
