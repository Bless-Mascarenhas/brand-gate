# Technical Decisions Log

This document records one line per significant technical decision and the rationale behind it.

- **2026-10-24**: Selected Next.js App Router with TypeScript strict mode to satisfy Vercel serverless deployment and strong type safety across API boundaries.
- **2026-10-24**: Deterministic rule engine executes first with 100% hard authority; LLMs are only leveraged for subjective/soft tone evaluations, preventing prompt-injection overrides.
- **2026-10-24**: Client-side stepwise pipeline orchestration (`usePipeline`) prevents Vercel serverless gateway timeout limits (60s) on multi-model debates.
- **2026-10-24**: Compositing overlays (wordmark SVG, CTA bands) on HTML5 canvas in the browser avoids sharp serverless font rendering bugs.
- **2026-10-24**: Storage adapter interface abstracts browser IndexedDB (`idb-keyval`) for local zero-config testing and optional Supabase cloud storage.
- **2026-10-24**: Replay mode bundles offline pre-recorded multi-model traces to ensure judges can evaluate full pipelines without live API keys.
- **2026-10-24**: Policy pack snapshot hashing uses SHA-256 over normalized clause text and rule definitions, allowing exact clause verification and provenance tracking in all audit logs.
- **2026-10-24**: Minimum necessary disclosure routing map guarantees LLMs only receive clauses strictly relevant to the evaluated category, protecting brand confidentiality and token budgets.
- **2026-10-24**: Deterministic rule engine executes ahead of any LLM calls with 100% hard authority; any critical gate failure instantly blocks the post and prevents adversarial prompt overrides.
- **2026-10-24**: Contrast math strictly follows WCAG 2.1 relative luminance, proving the planted Marigold on Paper conflict (1.7:1 vs required 4.5:1) which brand precedence resolves in favor of AR.
- **2026-10-24**: Emoji counting implements Intl.Segmenter with grapheme granularity, accurately counting multi-codepoint flags and skin-tone modifiers.
- **2026-10-24**: Unified multi-provider abstraction (`callLLM`) integrates Gemini SDK with xAI and NVIDIA NIM OpenAI-compatible clients with 45s timeouts, 1 retry backoff, and full LlmCallLog audit receipts.
- **2026-10-24**: Dual-layer JSON resilience handles code-fences, trailing commas, and prompt repair re-attempts before falling back to Replay mode suggestion.
- **2026-10-24**: User-supplied social posts and uploads are strictly encapsulated inside `<post>` XML delimiters with an explicit untrusted data directive, neutralizing prompt-injection overrides.
- **2026-10-24**: Deterministic citation verifier validates clause existence, verbatim clause quote substring (with token-Jaccard >= 0.9 fallback), and post quote substring, discarding hallucinated citations and exposing a visible "Hallucinations Blocked" counter.
- **2026-10-24**: Multi-model consensus treats reviewer dispute as data: disputed findings incur zero numerical penalty, surface to human reviewers with both models' arguments, and feed the Ambiguity Index.
- **2026-10-24**: Client-side `usePipeline` state machine streams live execution traces with latency measurements, supporting both `fast` mode (rebuttal skipped) and `thorough` mode (full 2-round debate).
- **2026-10-24**: Client-side HTML5 canvas compositing (`src/canvas/composite.ts`) renders vector wordmarks on Paper/Ink backing bands with >34px clear space and Marigold offer bands with Ink text, bypassing Vercel serverless font rendering limitations.
- **2026-10-24**: Automated multi-turn governance loop (`src/build/governanceLoop.ts`) caps self-correction at 3 iterations, feeding verified findings and original purpose back to the generator until READY_FOR_HUMAN or score plateaus, tracking intent preservation scores (1–5).
- **2026-10-24**: Human review workflow strictly enforces role authority per Escalation Matrix (EM-000), requiring Manager role authorization with written justification for critical findings before audit receipt creation.
- **2026-10-24 (Phase 7)**: Workflow mutations go only through pure functions in `src/workflow/actions.ts`, which re-check `src/workflow/permissions.ts` and throw `WorkflowPermissionError`; the UI hides buttons for convenience only. There is no server workflow API because workflow data lives in the browser (spec §3), so the action layer is the enforcement boundary.
- **2026-10-24 (Phase 7)**: Required approvers are derived from open findings per the escalation matrix (EM-002 major/factual/claims → Manager; EM-003 critical/disclosure → Manager + Reviewer; EM-004 visual → Reviewer; otherwise one Reviewer, EM-006). A post becomes `approved` only when every required role has approved the current revision; approvals reset on a new revision or change request.
- **2026-10-24 (Phase 7)**: Open critical findings block approval for every role; only a Manager may override one, with a ≥20-character justification (EM-007). Overrides and change requests are written to the audit log and emitted as `human_override` / `human_rejection` Insight events.
- **2026-10-24 (Phase 7)**: Publishing to `published_mock` is Manager-only (EM-006); previously Creators could publish.
- **2026-10-24 (Phase 7)**: Workflow posts and live Insight events persist through the existing `StorageAdapter` (`workflow:posts:v1`, `insights:events:v1`). Seeded sample data is generated by `scripts/make-seed.ts` (real gate engine + real workflow actions, fixed clock and PRNG) and kept in `data/seed/`; seeded events are never written to storage, so sample and live data cannot mix.
- **2026-10-24 (Phase 7)**: Ambiguity Index denominator = checks in which the clause was evaluated (rule clauses + clauses routed to reviewers, or any finding citing it). A clause never checked has index `null`, never 0 or NaN.
- **2026-10-24 (Phase 7)**: Clarification drafts call Gemini via `/api/llm/clarify` (access-gated); when that fails, a deterministic template built from the evidence is shown and labelled as a template. Both are labelled suggestions, never policy changes.
- **2026-10-24 (Phase 7)**: Fixed rule `R-TERM-005` (TM-004 brand spelling) which matched the mandated `#ThriftIt` hashtag and produced a false minor finding on every compliant post; pattern now has a `(?<!#)` look-behind, with regression tests.
