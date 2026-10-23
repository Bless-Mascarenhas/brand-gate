# Technical Decisions Log

This document records one line per significant technical decision and the rationale behind it.

- **2026-10-24**: Selected Next.js App Router with TypeScript strict mode to satisfy Vercel serverless deployment and strong type safety across API boundaries.
- **2026-10-24**: Deterministic rule engine executes first with 100% hard authority; LLMs are only leveraged for subjective/soft tone evaluations, preventing prompt-injection overrides.
- **2026-10-24**: Client-side stepwise pipeline orchestration (`usePipeline`) prevents Vercel serverless gateway timeout limits (60s) on multi-model debates.
- **2026-10-24**: Compositing overlays (wordmark SVG, CTA bands) on HTML5 canvas in the browser avoids sharp serverless font rendering bugs.
- **2026-10-24**: Storage adapter interface abstracts browser IndexedDB (`idb-keyval`) for local zero-config testing and optional Supabase cloud storage.
- **2026-10-24**: Replay mode bundles offline pre-recorded multi-model traces to ensure judges can evaluate full pipelines without live API keys.
