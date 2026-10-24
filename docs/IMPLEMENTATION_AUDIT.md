# Implementation Audit — Phases 1–9

Spec: `thrift-it-build-prompt.md`. Repository: `D:\brank-gate`, branch `master`.
Statuses: COMPLETE AND VERIFIED · IMPLEMENTED BUT UNVERIFIED · PARTIALLY IMPLEMENTED · BROKEN · MISSING · BLOCKED BY EXTERNAL DEPENDENCY.
Phase 7 and 8 detail (with evidence) lives in `docs/PHASE_7_8_AUDIT.md`; this file covers every phase and is the summary of record.

## 0. Baseline for this pass (2026-10-24, HEAD `3ee71d0`)

- `npm run check`: tsc OK · eslint 0 problems · vitest 177/177 (16 files) · next build OK.
- Provider credentials: none configured (no `.env`/`.env.local`). Every live model path is therefore BLOCKED BY EXTERNAL DEPENDENCY for live verification; covered by mocked contract tests, deterministic tests and Replay.

## 1. Initial audit (before this pass's changes)

| Phase | Requirement | Files | Observed | Status at start | Required fix |
|---|---|---|---|---|---|
| 1 | Shell, sidebar, topbar, role switcher, demo-date chip, mode badge | `app/(shell)/layout.tsx`, `src/ui/components/{SideBar,TopBar}.tsx` | Works on desktop; sidebar responsiveness unchecked | IMPLEMENTED BUT UNVERIFIED | Responsive pass |
| 1 | Access code gates `/api/llm/*` | `app/api/access`, `src/llm/gatekeeper.ts` | All 11 LLM routes call `verifyLlmAccess`; httpOnly, SameSite=Lax, Secure in prod | COMPLETE AND VERIFIED (tests in `gatekeeper.test.ts`, replay tests 401) | — |
| 1 | Provider status chips without secrets | `app/api/providers` | Reports configured/missing from key presence only; "configured" ignores missing model env | PARTIALLY IMPLEMENTED | Require model env too |
| 1 | Storage adapter (IndexedDB) | `src/storage` | Works, memory fallback in Node | COMPLETE AND VERIFIED (`storage.test.ts`) | — |
| 2 | 8 docs, ≥90 clauses, ≥45 rules, facts/assets/market, clause anchors | `data/thrift-it`, `src/kb`, `app/(shell)/company` | 84 non-purpose + 8 purpose clauses, 47 rules, anchors work | COMPLETE AND VERIFIED (`kb.test.ts`) | — |
| 2 | Edit mode with version history; edits re-index clauses and bump pack hash | `app/(shell)/company/page.tsx` | **No edit mode, no history** | MISSING | Implement (browser-local, labelled) |
| 3 | All rule types, injection rule, ΔE, contrast, `/api/gates` | `src/rules` | Present; golden test for samples | COMPLETE AND VERIFIED | — |
| 3 | ≥60 rule-engine tests | `src/rules/__tests__` | 50 (38+7+5) | PARTIALLY IMPLEMENTED | Add tests per rule type |
| 4 | Providers, JSON repair, retry, contract tests | `src/llm` | Contract tests pass (mocked) | COMPLETE AND VERIFIED (mocked); live BLOCKED BY EXTERNAL DEPENDENCY | — |
| 4 | 45 s timeout | `src/llm/callLLM.ts` | 60 s (message says 45 s) | BROKEN | Set 45 s |
| 4 | Model IDs only from env (§0, §24) | `callLLM.ts`, `perceive/route.ts` | Hardcoded fallbacks `gemini-2.0-flash`, `groq-2-latest`, `meta/llama-3.1-70b-instruct` | BROKEN | Require env; report missing |
| 4 | Budget + per-IP rate limiting (Upstash if configured) | `gatekeeper.ts` | In-memory daily budget only; **no per-IP limiting, no Upstash** | PARTIALLY IMPLEMENTED | Add per-IP limiter + optional Upstash counters |
| 5 | Verify pipeline, verifier, consensus, scoring, trace, data-flow | `src/pipeline/usePipeline.ts`, `src/verify`, `app/(shell)/verify` | Implemented; tests for verifier/scoring/consensus | COMPLETE AND VERIFIED (deterministic); live reviewers BLOCKED BY EXTERNAL DEPENDENCY | — |
| 5 | Architecture diagram highlights active node during a run | verify page | No diagram on Verify | MISSING | Diagram component fed by the live trace |
| 6 | Build chat, loop ≤3, canvas compositing, approve/request changes/override | `app/(shell)/build`, `src/build` | Implemented; loop tests | IMPLEMENTED BUT UNVERIFIED (needs live keys) | — |
| 7 | Workflow & Insights | see PHASE_7_8_AUDIT §6 | Completed in `7e92159` | COMPLETE AND VERIFIED | — |
| 8 | Compare, benchmark, calibration, replay, Supabase | see PHASE_7_8_AUDIT §7 | Completed in `3ee71d0`; live runs blocked | COMPLETE AND VERIFIED (deterministic); live BLOCKED BY EXTERNAL DEPENDENCY | — |
| 9 | Start here: pitch, interactive diagram, 5-step tour, demo | `app/(shell)/start/page.tsx` | Pitch + demo button; **teaser shows invented scores** ("~32/100", "94/100"); no diagram; no tour | PARTIALLY IMPLEMENTED / BROKEN (honesty) | Real numbers from replays; diagram; tour |
| 9 | Transparency: 9 tabs | `app/(shell)/transparency/page.tsx` | 5 tabs; no AI disclosure, data flow, user testing, feedback form, source tab | PARTIALLY IMPLEMENTED | Rebuild with 9 tabs |
| 9 | README | `README.md` | Partial (run/test/scripts only) | PARTIALLY IMPLEMENTED | Complete per §23 |
| 9 | Accessibility & responsive pass; automated contrast test on theme tokens | whole app | Not done | MISSING | Audit + fix + contrast test |
| §18 | zod body validation, body caps, MIME checks, EXIF stripping | `app/api/**` | 11 routes parse bodies without zod/caps; perceive forwards raw image bytes (EXIF intact) and trusts any `data:image/*` | PARTIALLY IMPLEMENTED | Shared validated body reader; MIME allow-list; re-encode to strip EXIF |
| §18 | CSP incl. frame-ancestors | `next.config.ts` | CSP lacks `frame-ancestors` (X-Frame-Options DENY present) | PARTIALLY IMPLEMENTED | Add `frame-ancestors 'none'` |

## 2. Final status (after this pass)

| Phase | Requirement | Final status | Evidence |
|---|---|---|---|
| 1 | Shell, navigation, role switcher, demo date, mode badge | COMPLETE AND VERIFIED | Browser: all 8 sections reachable on desktop sidebar and new mobile nav (375 px, no horizontal scroll); `aria-current` on active link |
| 1 | Access code gates LLM routes | COMPLETE AND VERIFIED | `gatekeeper.test.ts` (header, cookie, wrong code, production without `DEMO_ACCESS_CODE` denies even the dev default); replay tests 401 |
| 1 | Provider status chips without secrets | COMPLETE AND VERIFIED | Configured only when key **and** model env set; `security.test.ts` asserts no secret in response |
| 1 | Storage adapter | COMPLETE AND VERIFIED | `storage.test.ts`, `supabase.test.ts` |
| 2 | Policy pack, ≥90 clauses, ≥45 rules, anchors | COMPLETE AND VERIFIED | `kb.test.ts` |
| 2 | Edit mode + version history, re-index, pack hash bump | COMPLETE AND VERIFIED (browser-local; pipeline keeps the approved pack — KNOWN_LIMITATIONS 5) | `src/kb/edits.ts`, `DocEditor`; 4 tests incl. browser hash = server hash; browser: Manager edit changed BV-007 and hash `pack_93109fd9405c` → `pack_8375043d6a4b`, discard restored it; Creator cannot edit |
| 3 | Rule types, ΔE, contrast, `/api/gates`, golden tests | COMPLETE AND VERIFIED | 64 rule-engine tests (52 engine + 7 colour + 5 emoji), incl. exact-zero clean control; golden sample-post tests pass |
| 3 | Fixed: R-SOC-007 flagged approved greetings; price patterns missed “just/only ₹N” | COMPLETE AND VERIFIED | Regression tests; benchmark held-out split unchanged |
| 4 | Providers, JSON repair, retry, contract tests | COMPLETE AND VERIFIED (mocked); live BLOCKED BY EXTERNAL DEPENDENCY | `llm.test.ts`, `compare.test.ts` (mocked LLM caller) |
| 4 | 45 s timeout; model IDs only from env | COMPLETE AND VERIFIED | `callLLM.ts` `TIMEOUT_MS = 45000`; `security.test.ts` “refuses to run without a configured model” |
| 4 | Budget + per-IP rate limit (Upstash if configured) | COMPLETE AND VERIFIED (memory path); Upstash path IMPLEMENTED BUT UNVERIFIED (no Redis) | `gatekeeper.test.ts` rate-limit and budget tests |
| 5 | Verify pipeline, verifier, consensus, scoring, trace, data-flow | COMPLETE AND VERIFIED (deterministic); live reviewers BLOCKED BY EXTERNAL DEPENDENCY | verify/consensus/scoring tests; replay of all 12 samples |
| 5/9 | Diagram highlights the active pipeline node | COMPLETE AND VERIFIED (replay); live highlighting IMPLEMENTED BUT UNVERIFIED (needs keys) | Browser: demo playback lit Reviewer A/B → Citation verifier → Cross-examination → Consensus in order; test maps every trace step to a node |
| 6 | Build chat, loop, compositing, approve/override | IMPLEMENTED BUT UNVERIFIED end-to-end (needs live keys); loop logic unit-tested | AI-generated badges added; fabricated “Liked by 1,420 others” on the mock card replaced with “Simulated preview — not posted” |
| 7 | Workflow & Insights | COMPLETE AND VERIFIED | `docs/PHASE_7_8_AUDIT.md` §6; commit `7e92159` |
| 8 | Compare, benchmark, calibration, replay, optional Supabase | COMPLETE AND VERIFIED (deterministic/mocked); live runs BLOCKED BY EXTERNAL DEPENDENCY | `docs/PHASE_7_8_AUDIT.md` §7; commit `3ee71d0`; regenerated after rule fixes, 18/18 replays valid |
| 9 | Start here: pitch, diagram, 5-step tour, recorded demo, first-time help | COMPLETE AND VERIFIED | Browser: tour steps 1–5 navigated to /start, /company, /verify, /compare, /workflow and highlighted their targets; demo plays without keys; teaser numbers come from the recorded replay and `results.json` (invented scores removed) |
| 9 | Transparency: 9 tabs | COMPLETE AND VERIFIED | Browser: all 9 tabs render, arrow-key tab navigation; DECISIONS and KNOWN_LIMITATIONS rendered from the real files with correct numbering; test asserts the tab list |
| 9 | Feedback form, local storage, JSON export | COMPLETE AND VERIFIED | Browser: validation message, save, persists after reload, export JSON content checked; unit test |
| 9 | User-testing template without fabricated data | COMPLETE AND VERIFIED | Only “Author to fill” markers; test guards against invented figures |
| 9 | README per §23 | COMPLETE AND VERIFIED | `README.md` (deployed URL marked “author to fill”, not invented) |
| 9 | Accessibility & responsive pass | COMPLETE AND VERIFIED for the checks listed; full axe audit not run (KNOWN_LIMITATIONS 18) | Contrast test on theme tokens + source-scan barrier; skip link and focus ring verified with the keyboard; reduced motion; ARIA tabs; chart text alternatives; mobile top bar and nav verified at 375 px |
| 9 | Optional Instagram publishing | NOT IMPLEMENTED (optional) | Mock publishing only, labelled |
| §18 | Body validation, size caps, MIME allow-list, EXIF stripping, CSP frame-ancestors | COMPLETE AND VERIFIED | `security.test.ts` (413/400 paths, SVG/HTML/undecodable images rejected, EXIF removed, headers) |
| §18 | No unsafe HTML rendering | COMPLETE AND VERIFIED | No `dangerouslySetInnerHTML` in app/ or src/; markdown renderer escapes (`phase9.test.ts`) |

## 3. Verification run (final)

- `npm run check` → tsc 0 errors · eslint 0 problems · vitest **244 passed / 0 failed (18 files)** · `next build` succeeded.
- `npm run record-replay -- --check` → 18/18 valid.
- `npm run benchmark` (deterministic only, no keys) → held-out test split: precision 100%, recall 74.1%, clean false-positive rate 0%; baseline not run.
- `npm run calibrate` → 324 configurations on 30 dev posts, 0 held-out posts used.
- Live provider tests: **not run** — no GEMINI, GROQ or NVIDIA credentials were available.
