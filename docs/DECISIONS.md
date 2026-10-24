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
