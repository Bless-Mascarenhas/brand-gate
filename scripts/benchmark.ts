/**
 * Benchmark: (1) single LLM with all policies pasted in, asked to list
 * violations, vs (2) the governed pipeline, on data/benchmark/posts.json.
 *
 *   npm run benchmark                 # all splits, live where keys exist
 *   npm run benchmark -- --split test # held-out split only
 *   npm run benchmark -- --offline    # deterministic stages only, no model calls
 *   npm run benchmark -- --mode thorough
 *
 * Writes data/benchmark/results.json with metadata saying exactly what ran.
 * Without provider keys the governed system runs its deterministic stages
 * only and the baseline is recorded as not run; nothing is simulated.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getPolicyPack } from '@/src/kb';
import { callLLM } from '@/src/llm/callLLM';
import { buildSingleModelReviewerPrompt } from '@/src/llm/prompts/baseline';
import { runGovernedReview } from '@/src/pipeline/governed';
import { verifyCitations } from '@/src/verify/citationVerifier';
import { BenchmarkPost, Prediction, SystemMetrics, pct, scoreSystem } from '@/src/benchmark/metrics';
import { Category, Finding } from '@/src/types';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const splitArg = opt('split', 'all') as 'dev' | 'test' | 'all';
const mode = opt('mode', 'fast') as 'fast' | 'thorough';
const offline = flag('offline');
const demoDate = process.env.DEMO_TODAY || '2026-10-24';
const keys = { gemini: Boolean(process.env.GEMINI_API_KEY), xai: Boolean(process.env.XAI_API_KEY), nvidia: Boolean(process.env.NVIDIA_API_KEY) };
const baselineLive = !offline && keys.gemini;
const reviewersLive = !offline && keys.xai && keys.nvidia;

const root = process.cwd();
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'benchmark', 'posts.json'), 'utf-8')) as { posts: BenchmarkPost[] };
const posts = dataset.posts.filter((p) => splitArg === 'all' || p.split === splitArg);
const pack = getPolicyPack();

const slim = (f: Finding) => ({ clauseId: f.clauseId, category: f.category, severity: f.severity, agreement: f.agreement, source: (f.source === 'gate' ? 'gate' : 'llm') as 'gate' | 'llm' });

async function runBaseline(p: BenchmarkPost): Promise<Prediction & { ms: number; tokens: number | null }> {
  const started = Date.now();
  const { system, user } = buildSingleModelReviewerPrompt(pack, p.post);
  const res = await callLLM<{ findings: Record<string, unknown>[] }>({ provider: 'gemini', system, user, purpose: 'benchmark single-model baseline', clauseIdsSent: pack.clauses.map((c) => c.id) });
  const raw: Finding[] = (res.ok && Array.isArray(res.data?.findings) ? res.data!.findings : []).map((f, i) => ({
    id: `base-${i}`, source: 'grok', category: String(f.category ?? 'tone') as Category, severity: (['critical', 'major', 'minor', 'info'].includes(String(f.severity)) ? f.severity : 'minor') as Finding['severity'],
    clauseId: String(f.clauseId ?? ''), clauseQuote: String(f.clauseQuote ?? ''), postField: (['caption', 'hashtags', 'alt_text', 'image', 'meta'].includes(String(f.postField)) ? f.postField : 'caption') as Finding['postField'],
    postQuote: String(f.postQuote ?? ''), explanation: String(f.explanation ?? ''), autoFixable: false, confidence: 1, verified: false, agreement: 'single_source',
  }));
  // The baseline keeps every finding (it has no verifier); we only MEASURE its citation validity.
  const check = verifyCitations(raw, pack, p.post);
  return {
    postId: p.id, findings: raw.map((f) => ({ ...slim(f), source: 'llm' })), gatesFailed: [], rawLlmCitations: raw.length,
    invalidLlmCitations: check.hallucinationsBlocked, debateAgreed: 0, debateDisputed: 0, error: res.ok ? undefined : res.error,
    ms: Date.now() - started, tokens: res.log.tokensIn !== undefined && res.log.tokensOut !== undefined ? res.log.tokensIn + res.log.tokensOut : null,
  };
}

async function runGoverned(p: BenchmarkPost): Promise<Prediction & { ms: number; llmCalls: number; verdict: string; score: number }> {
  const started = Date.now();
  const r = await runGovernedReview(p.post, pack, { demoDate, mode, reviewers: reviewersLive });
  return {
    postId: p.id, findings: r.findings.map(slim), gatesFailed: r.gate.gatesFailed, rawLlmCitations: r.rawLlmFindings.length,
    invalidLlmCitations: r.dropped.length, debateAgreed: r.debateAgreed, debateDisputed: r.debateDisputed,
    error: r.errors.length ? r.errors.join('; ') : undefined, ms: Date.now() - started, llmCalls: r.llmCalls.length,
    verdict: r.score.verdict.status, score: r.score.score,
  };
}

function table(name: string, m: SystemMetrics) {
  console.log(`\n${name}`);
  console.log(`  precision ${pct(m.precision)}  recall ${pct(m.recall)}  (TP ${m.tp} / FP ${m.fp} / FN ${m.fn})`);
  console.log(`  false-positive rate on clean posts ${pct(m.falsePositiveRateOnClean)} (${m.cleanPostsFlagged}/${m.cleanPosts})`);
  console.log(`  citation validity ${pct(m.citationValidity)}  hallucinated citations ${m.hallucinatedCitations}`);
  console.log(`  caught only by deterministic gates ${m.caughtOnlyByGates}  debate agreed/disputed ${m.debateAgreed}/${m.debateDisputed}  failed posts ${m.failedPosts}`);
  const cats = Object.entries(m.perCategory).sort(([a], [b]) => a.localeCompare(b));
  for (const [c, v] of cats) console.log(`    ${c.padEnd(17)} P ${pct(v!.precision).padStart(6)}  R ${pct(v!.recall).padStart(6)}  TP ${v!.tp} FP ${v!.fp} FN ${v!.fn}`);
}

async function main() {
  console.log(`Benchmark on ${posts.length} posts (split=${splitArg}, mode=${mode}). Baseline: ${baselineLive ? 'LIVE' : 'NOT RUN'}; governed reviewers: ${reviewersLive ? 'LIVE' : 'NOT RUN (deterministic stages only)'}.`);
  const governed: Awaited<ReturnType<typeof runGoverned>>[] = [];
  const baseline: Awaited<ReturnType<typeof runBaseline>>[] = [];
  for (const p of posts) {
    governed.push(await runGoverned(p));
    if (baselineLive) baseline.push(await runBaseline(p));
    process.stdout.write('.');
  }
  console.log('');

  const splits = (['dev', 'test'] as const).filter((s) => splitArg === 'all' || s === splitArg);
  const metricsFor = (preds: Prediction[]) =>
    Object.fromEntries([...splits.map((s) => [s, scoreSystem(posts.filter((p) => p.split === s), preds, pack.rules)]), ['all', scoreSystem(posts, preds, pack.rules)]]);

  const governedMetrics = metricsFor(governed);
  const baselineMetrics = baselineLive ? metricsFor(baseline) : null;
  for (const s of [...splits, 'all']) {
    table(`GOVERNED (${reviewersLive ? 'gates + live reviewers' : 'deterministic stages only'}) — ${s}`, governedMetrics[s]);
    if (baselineMetrics) table(`BASELINE single model + policies — ${s}`, baselineMetrics[s]);
  }

  let gitCommit = 'unknown';
  try { gitCommit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }

  const out = {
    meta: {
      computedAt: new Date().toISOString(),
      command: `npm run benchmark -- ${args.join(' ')}`.trim(),
      generator: 'scripts/benchmark.ts',
      gitCommit,
      packHash: pack.hash,
      demoDate,
      split: splitArg,
      mode,
      execution: reviewersLive && baselineLive ? 'live' : reviewersLive || baselineLive ? 'partial_live' : 'deterministic_only',
      providersConfigured: keys,
      models: { gemini: process.env.GEMINI_TEXT_MODEL ?? null, xai: process.env.XAI_MODEL ?? null, nvidia: process.env.NVIDIA_MODEL ?? null },
      labelsHumanReviewed: `${dataset.posts.filter((p) => p.labelsReviewed).length}/${dataset.posts.length}`,
      caveats: [
        'Synthetic posts and labels written by the same author as the system; small N; not statistically conclusive.',
        reviewersLive ? null : 'Governed system ran its deterministic stages only (gates, verifier, scoring); LLM reviewers were not called because XAI_API_KEY/NVIDIA_API_KEY were not configured or --offline was set.',
        baselineLive ? null : 'Baseline (single model + policies) was NOT run because GEMINI_API_KEY was not configured or --offline was set; no baseline numbers exist for this run.',
      ].filter(Boolean),
    },
    systems: {
      governed: { status: 'ran', reviewers: reviewersLive ? 'live' : 'not_run', metrics: governedMetrics },
      baseline: baselineLive ? { status: 'ran', metrics: baselineMetrics } : { status: 'not_run', reason: offline ? '--offline' : 'GEMINI_API_KEY not configured' },
    },
    perPost: Object.fromEntries(
      posts.map((p) => {
        const g = governed.find((x) => x.postId === p.id)!;
        const b = baseline.find((x) => x.postId === p.id);
        return [p.id, { split: p.split, class: p.class, expected: p.expectedViolations.map((e) => e.ruleOrClause), governed: g, baseline: b ?? null }];
      })
    ),
  };
  const target = path.join(root, 'data', 'benchmark', 'results.json');
  fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${path.relative(root, target)} (execution: ${out.meta.execution}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
