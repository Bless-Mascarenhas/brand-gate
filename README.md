# Brand Gate

**Pre-publication brand governance for social content**, demonstrated on Thrift-It, a fictional Mumbai pre-loved clothing store that sells on Instagram.

## The problem

Organisations publish through many people, agencies and AI tools, and the brand drifts: expired offers, wrong prices, unsupported "eco-friendly" claims, undisclosed collaborations, inaccessible posts. Pasting the brand guidelines into a chatbot does not fix this. Nobody checks that the model actually followed them, and nobody can see why it decided what it did.

Brand Gate reviews content **before** publication against approved policies, facts and assets. It explains every issue with the exact clause involved, suggests minimal fixes, routes approval to the right people, and keeps a full audit trail. It also learns which guidelines are unclear.

## Judge quick start

1. Open the deployed URL (*author to fill — not deployed yet*) or run it locally (below).
2. On **Start here**, press **Run the 90-second demo**. It plays a recorded verification with no API keys, labelled "Recorded run, not live".
3. Press **Guided tour (5 steps)** for a walk through Company, Verify, Compare and Workflow.
4. To use live models, click **Access Code** in the top bar and enter `DEMO_ACCESS_CODE`; provider keys must be configured on the server.

## Features

| Section | What it does |
|---|---|
| Start here | Pitch, interactive architecture diagram, 5-step guided tour, recorded demo |
| Company | 8 policy documents (92 clauses, anchorable), approved facts with validity windows, 47 machine rules, brand assets; Manager-only edit mode with version history and pack-hash bump (browser-local) |
| Build | Chat that drafts an India-targeted post, generates an image, composites the real wordmark on canvas, governs it in up to 3 iterations and asks a human to approve or request changes |
| Verify | Paste or pick one of 12 sample posts: deterministic gates → two independent reviewers → citation verifier → consensus → code-computed score and verdict, with fix diffs and a data-flow panel |
| Compare | Same brief through bare AI, AI + pasted policies and the governed pipeline, scored by one independent scorer; benchmark results |
| Workflow | Role-based review queue, escalation-matrix approvers, Manager-only critical overrides, comments, revisions with word diffs, append-only audit log |
| Insights | Violations over time, top clauses, first-pass vs after-fix scores, Ambiguity Index with evidence and suggested clarifications, rule coverage, hallucinations blocked |
| Transparency | Architecture and decisions, models and data sent, AI disclosure, data flow, responsible design, known limitations, user-testing template and feedback form, team, source |

## Architecture

```
Content (Build / Verify) ──► Deterministic gates (server, pure TS) ──► Reviewer A (xAI) ─┐
          ▲                         ▲                                Reviewer B (NVIDIA) ┤
     Gemini (draft, image,     Knowledge base (8 docs, facts, rules, routing map)         ▼
     perception)                                         Citation verifier (code) ─► Cross-examination (thorough)
                                                                    ▼
                                         Consensus (code) ─► Score & verdict (code) ─► Human approval ─► Mock publish
```

Deterministic gates first, LLM judgement second, human decision last. No model decides a verdict, and nothing is ever published automatically. Pipeline steps are small server routes orchestrated from the browser, so no single request runs long. Details: `docs/DECISIONS.md` and the Transparency page.

## Technology and providers

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS, lucide-react, recharts |
| Validation, diffs, storage | zod, diff, idb-keyval (IndexedDB) |
| Images | sharp (server: analysis, EXIF stripping), HTML canvas (client: brand overlays) |
| Models | Google Gemini via `@google/genai` (text, vision, image); xAI Grok and NVIDIA via the `openai` SDK with custom base URLs |
| Optional | Upstash Redis (rate-limit counters), Supabase (shared storage) |
| Tests | Vitest |

## Prerequisites

- Node.js 20+ (tested with Node 24) and npm
- Windows PowerShell, macOS or Linux shell

## Install and run (PowerShell)

```powershell
cd D:\brank-gate
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. Everything except live model calls works with an empty `.env.local`.

## Environment

All keys stay on the server; nothing uses a `NEXT_PUBLIC_` prefix except the non-secret storage mode flag.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `GEMINI_VISION_MODEL`, `GEMINI_IMAGE_MODEL` | Gemini; model IDs must be set explicitly (no defaults in code) |
| `XAI_API_KEY`, `XAI_BASE_URL`, `XAI_MODEL` | Reviewer A |
| `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL` | Reviewer B |
| `DEMO_ACCESS_CODE` | Gates every LLM endpoint (httpOnly cookie) |
| `DEMO_TODAY` | Pinned date so offers stay valid/expired as designed (2026-10-24) |
| `DAILY_CALL_BUDGET`, `RATE_LIMIT_PER_MINUTE` | Abuse controls |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional shared counters |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STORAGE_MODE=supabase` | Optional shared storage (run `docs/supabase/001_brand_gate_kv.sql` first) |

## Development and tests

```powershell
npm run dev        # development server
npm run check      # tsc --noEmit && eslint . && vitest run && next build
npm test           # unit, contract, golden, workflow, insights, compare, benchmark, replay, security and accessibility tests
npm run lint
```

Provider contract tests use mocked responses; no test calls a live model.

## Benchmark, calibration and replays

```powershell
npm run benchmark                    # 60 labelled posts, both systems; writes data/benchmark/results.json
npm run benchmark -- --split test    # held-out split only
npm run benchmark -- --offline       # deterministic stages only, no model calls
npm run calibrate                    # dev split only; writes data/benchmark/calibration.json
npm run record-replay                # records 12 sample posts + 6 Compare scenarios into data/replay/
npm run record-replay -- --check     # validates all 18 replays
npm run seed                         # regenerates labelled sample Workflow posts and Insights history
```

Every output records how it was produced. The committed files were generated **without** provider keys: the benchmark ran the governed pipeline's deterministic stages only, the baseline was not run, and the replays are deterministic recordings or hand-written illustrative fixtures. The UI labels all of this. Run the scripts with keys to replace them with live results.

## Replay mode

Toggle **REPLAY** in the top bar, or use the Start-here demo. Replay serves recorded runs from `data/replay/` through `/api/replay`, validates each file against a schema, and badges it "Recorded run, not live" with its provenance. It needs no API keys. When a live call fails (missing key, provider error, rate limit or exhausted budget), the UI offers to switch to Replay.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel (framework: Next.js; build command `npm run build`).
2. Add the environment variables above in Project → Settings → Environment Variables (server-side; do not prefix keys with `NEXT_PUBLIC_`).
3. Deploy. API routes run on the Node.js runtime with `maxDuration = 60`; `data/replay` is bundled with `/api/replay` via `outputFileTracingIncludes`.

## Known limitations

See `docs/KNOWN_LIMITATIONS.md` (also rendered on the Transparency page). In short: roles are simulated, publishing is a mock, storage is browser-local by default, and no live provider run has been verified in this repository yet. The benchmark is small, synthetic, self-labelled and so far deterministic-only.

## Contribution statement

The build brief describes Brand Gate as a solo build by Bless Mascarenhas (*author to confirm*). Git history records more than one author name. AI coding assistants, including Claude, wrote substantial parts of the code, tests and documentation.

## Documentation

- `docs/IMPLEMENTATION_AUDIT.md`: status of every phase with evidence
- `docs/PHASE_7_8_AUDIT.md`: detailed Phase 7–8 audit
- `docs/DECISIONS.md`: technical decisions
- `docs/KNOWN_LIMITATIONS.md`: limitations
