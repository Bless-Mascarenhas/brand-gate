# Brand Gate

**Pre-publication brand governance for social content**, demonstrated on Thrift-It, a fictional Mumbai pre-loved clothing store that sells on Instagram.

## The problem

Organisations publish through many people, agencies and AI tools, and the brand drifts: expired offers, wrong prices, unsupported "eco-friendly" claims, undisclosed collaborations, inaccessible posts. Pasting the brand guidelines into a chatbot does not fix this. Nobody checks that the model actually followed them, and nobody can see why it decided what it did.

Brand Gate reviews content **before** publication against approved policies, facts and assets. It explains every issue with the exact clause involved, suggests minimal fixes, routes approval to the right people, and keeps a full audit trail. It also learns which guidelines are unclear.

## Judge quick start

1. Open the Vercel deployment URL or run it locally (below).
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
Create: validated brief ─► Groq 1 + Groq 2 drafts (LangChain parallel) ─► deterministic policy-score selection ─► Cloudflare Workers AI image Worker
Evaluate: post ─► deterministic gates ─► Reviewer A + B (LangChain parallel) ─► citation verifier
                                                                    ▼
                          reciprocal cross-examination (thorough) ─► consensus & score (code) ─► human decision
```

Deterministic gates and citation checks constrain model findings; in thorough mode each reviewer challenges the other reviewer's verified findings. Code selects generated drafts by deterministic policy score and computes the final verdict. A human makes the final decision, and nothing is published automatically. Provider calls and free quotas depend on server configuration and current provider terms. Details: `docs/DECISIONS.md` and the Transparency page.

## Technology and providers

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS, lucide-react, recharts |
| Validation, diffs, storage | zod, diff, idb-keyval (IndexedDB) |
| Images | sharp (server: analysis, EXIF stripping), HTML canvas (client: brand overlays) |
| Models | Groq 1 and Groq 2 draft independently; Groq/NVIDIA reviewer slots run reciprocal debate; a self-hosted Cloudflare Workers AI Worker generates images; LangChain Core orchestrates parallel runnables |
| Optional | Upstash Redis (rate-limit counters), Supabase (shared storage) |
| Tests | Vitest |

## Project layout

This stays as one Next.js app at the repository root so Vercel can deploy the browser UI and server routes together.

- `app/(shell)/`: frontend pages and layouts
- `app/api/`: backend endpoints deployed as Next.js functions
- `src/ui/`: reusable interface components and client state
- `src/llm/`, `src/pipeline/`, `src/rules/`, `src/kb/`, `src/storage/`: server and domain logic
- `data/`: policies, sample test inputs, and benchmarks

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

Open http://localhost:3000. Configure provider keys in `.env.local` to execute live model calls.

## Environment

All keys stay on the server; nothing uses a `NEXT_PUBLIC_` prefix except the non-secret storage mode flag.

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY_1`, `GROQ_MODEL_1`, `GROQ_BASE_URL_1` | Groq Slot 1: Primary Drafter & Generator (Build, Fixes, Clarify, Baseline, Intent, Perceive) |
| `GROQ_API_KEY_2`, `GROQ_MODEL_2`, `GROQ_BASE_URL_2` | Groq Slot 2: Reviewer A (Independent Policy, Tone, and Terminology Review) |
| `GROQ_API_KEY_3`, `GROQ_MODEL_3`, `GROQ_BASE_URL_3` | Groq Slot 3: Reviewer B & Cross-Check (Second Auditor & Debate Cross-Examiner) |
| `IMAGE_GENERATION_API_URL`, `IMAGE_GENERATION_API_KEY` | HTTPS root URL for your deployed image Worker and its matching `API_KEY` secret; server-side only |
| `VISION_API_KEY`, `VISION_MODEL`, `VISION_BASE_URL` | Vision analysis for Evaluate uploads (vision-capable provider) |
| `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL` | Optional Gemini text fallback for legacy routes/scripts |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL` | Optional NVIDIA fallback for Slot 3 / Reviewer B |
| `DEMO_ACCESS_CODE` | Gates every LLM endpoint (httpOnly cookie; required in production) |
| `DEMO_TODAY` | Optional system date for validity windows (defaults to the real current date; set e.g. 2026-10-24 to pin) |
| `DAILY_CALL_BUDGET`, `RATE_LIMIT_PER_MINUTE` | Abuse controls |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional shared counters |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STORAGE_MODE=supabase` | Optional shared storage (run `docs/supabase/001_brand_gate_kv.sql` first) |
| `GROQ_TOKENS_PER_MINUTE` | Optional scripts-only rate pacing |

## Deploy to Vercel

Import this GitHub repository in Vercel and keep the project root set to `.`. Vercel detects Next.js automatically; leave the build command at `npm run build`. Add the required model keys and model IDs from `.env.example` in the Vercel project settings. For images, deploy the [Cloudflare Worker API](https://github.com/saurav-z/free-image-generation-api), set its `API_KEY` secret, enable Workers AI with binding name `AI`, then configure the Worker URL and matching key here. Confirm current Cloudflare quotas and terms for your account. Set `DEMO_ACCESS_CODE` to a private production value. Optional services such as Supabase and Upstash only need configuration when enabled. Keep all provider keys server-side without a `NEXT_PUBLIC_` prefix.

## Development and tests

```powershell
npm run dev        # development server
npm run check      # tsc --noEmit && eslint . && vitest run && next build
npm test           # unit, contract, golden, workflow, insights, compare, benchmark, security and accessibility tests
npm run lint
```

Provider contract tests use mocked responses; no test calls a live model.

## Benchmark and calibration
 
```powershell
npm run benchmark                    # 60 labelled posts, both systems; writes data/benchmark/results.json
npm run benchmark -- --split test    # held-out split only
npm run benchmark -- --offline       # deterministic stages only, no model calls
npm run calibrate                    # dev split only; writes data/benchmark/calibration.json
```

All pipeline, compare, and benchmark operations execute live when provider keys are configured. The benchmark evaluates the governed system against a baseline across 60 labelled posts.

## Known limitations

See `docs/KNOWN_LIMITATIONS.md` (also rendered on the Transparency page). In short: roles are simulated, publishing is a mock, storage is browser-local by default, and pipeline runs execute live or report honest provider errors.

## Contribution statement

The build brief describes Brand Gate as a solo build by Bless Mascarenhas (*author to confirm*). Git history records more than one author name. AI coding assistants, including Claude, wrote substantial parts of the code, tests and documentation.

## Documentation

- `docs/IMPLEMENTATION_AUDIT.md`: status of every phase with evidence
- `docs/PHASE_7_8_AUDIT.md`: detailed Phase 7–8 audit
- `docs/DECISIONS.md`: technical decisions
- `docs/KNOWN_LIMITATIONS.md`: limitations
