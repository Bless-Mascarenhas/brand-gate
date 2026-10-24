# Brand Gate

Pre-publication brand-governance prototype for the fictional Mumbai thrift store **Thrift-It**. Posts are checked by deterministic gates first, then by two LLM reviewers whose citations are verified in code, and a human always makes the final publishing decision.

> Status: Phases 1–8 of `thrift-it-build-prompt.md` are implemented (see `docs/PHASE_7_8_AUDIT.md`). Phase 9 (guided tour, Transparency tabs, full README with screenshots and judge quick start) is not done yet.

## Run locally (PowerShell)

```powershell
cd D:\brank-gate
npm ci
Copy-Item .env.example .env.local   # then fill in keys; everything below also works with none
npm run dev                          # http://localhost:3000
```

Without provider keys the app still works: Workflow, Insights and the deterministic gates run normally, and **Replay mode** (top bar, or "Run 90-Second Demo" on Start here) plays recorded runs.

## Tests

```powershell
npm run check     # tsc --noEmit && eslint . && vitest run && next build
npm test          # unit tests only
```

## Benchmark, calibration, replays

| Command | What it does | Output |
|---|---|---|
| `npm run benchmark` | Single LLM + policies vs governed pipeline on 60 labelled posts (30 dev / 30 held-out test). Flags: `--split dev\|test`, `--mode thorough`, `--offline` | `data/benchmark/results.json` |
| `npm run calibrate` | Sweeps scoring weights and thresholds on the **dev split only** | `data/benchmark/calibration.json` |
| `npm run record-replay` | Records the 12 sample posts and 6 Compare scenarios; `--check` only validates; `--deterministic` never calls models | `data/replay/*.json` |
| `npm run seed` | Regenerates the labelled sample Workflow posts and ~120 Insights events | `data/seed/*.json` |

Every output file records how it was produced. Runs without GEMINI/XAI/NVIDIA keys are labelled `deterministic_only` (benchmark) or `deterministic_recording` / `illustrative_fixture` (replays), and the UI shows those labels. The committed files were produced without keys; see `docs/KNOWN_LIMITATIONS.md`.

## Optional Supabase storage

Browser IndexedDB is the default. To share state through Supabase:

1. Run `docs/supabase/001_brand_gate_kv.sql` in your Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server only) and `NEXT_PUBLIC_STORAGE_MODE=supabase`.

The browser talks only to `/api/storage`; the service-role key never leaves the server. If Supabase fails, reads and writes fall back to the browser store.

## Docs

- `docs/PHASE_7_8_AUDIT.md`: requirement-by-requirement status with evidence
- `docs/DECISIONS.md`: technical decisions
- `docs/KNOWN_LIMITATIONS.md`: honest limitations
