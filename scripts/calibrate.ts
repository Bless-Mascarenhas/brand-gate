/**
 * Calibration: sweep scoring weights and verdict thresholds over the DEV split
 * of data/benchmark/posts.json and write data/benchmark/calibration.json.
 *
 *   npm run calibrate
 *
 * Findings per post come from data/benchmark/results.json (the last
 * benchmark run, whatever it executed) when present; otherwise the gate engine
 * is run on the dev posts. Test-split posts are filtered out before anything
 * else and `assertDevOnly` re-checks inside every evaluation.
 */
import fs from 'fs';
import path from 'path';
import { getPolicyPack } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { BenchmarkPost, PredictedFinding, pct } from '@/src/benchmark/metrics';
import { PostFindings, SWEEP, assertDevOnly, sweep } from '@/src/benchmark/calibrate';
import { DEFAULT_SCORING_WEIGHTS } from '@/src/verify/scoring';

const root = process.cwd();
const demoDate = process.env.DEMO_TODAY || '2026-10-24';
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data', 'benchmark', 'posts.json'), 'utf-8')) as { posts: BenchmarkPost[] };
const dev = assertDevOnly(dataset.posts.filter((p) => p.split === 'dev'));

const resultsPath = path.join(root, 'data', 'benchmark', 'results.json');
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, 'utf-8')) : null;
const pack = getPolicyPack();

const findings = new Map<string, PostFindings>();
let source = 'gate engine run by calibrate.ts (no results.json)';
for (const p of dev) {
  const recorded = results?.perPost?.[p.id]?.governed;
  if (recorded) {
    findings.set(p.id, { findings: recorded.findings as PredictedFinding[], gatesFailed: recorded.gatesFailed ?? [] });
  } else {
    const g = evaluatePost(p.post, pack, demoDate);
    findings.set(p.id, { findings: g.findings.map((f) => ({ clauseId: f.clauseId, category: f.category, severity: f.severity, agreement: f.agreement, source: 'gate' })), gatesFailed: g.gatesFailed });
  }
}
if (results) source = `governed findings from data/benchmark/results.json (computed ${results.meta.computedAt}, execution: ${results.meta.execution})`;

const { rows, selected, defaultRow } = sweep(dev, findings);
const fmt = (r: typeof selected) =>
  `crit ${r.weights.critical} maj ${r.weights.major} min ${r.weights.minor} | blocked<${r.weights.blockedThreshold} ready>=${r.weights.readyThreshold} | P ${pct(r.precision)} R ${pct(r.recall)} FPR ${pct(r.falsePositiveRate)} (TP ${r.tp} FP ${r.fp} FN ${r.fn} TN ${r.tn})`;

console.log(`Calibrating on ${dev.length} dev posts; findings source: ${source}`);
console.log(`${rows.length} configurations swept.`);
const distinct = new Map<string, typeof selected>();
for (const r of rows) {
  const key = `${r.tp}/${r.fp}/${r.fn}/${r.tn}`;
  if (!distinct.has(key)) distinct.set(key, r);
}
console.log(`\nDistinct outcomes (${distinct.size}); first configuration shown for each:`);
for (const r of distinct.values()) console.log(`  ${fmt(r)}`);
console.log(`\nShipped default: ${fmt(defaultRow)}`);
console.log(`Selected:        ${fmt(selected)}`);

const sameAsDefault = JSON.stringify(selected.weights) === JSON.stringify(DEFAULT_SCORING_WEIGHTS);
const explanation = [
  'Selection rule: maximise Youden J (recall − false-positive rate) at post level ("flagged" = verdict not READY_FOR_HUMAN); ties go to the configuration closest to the shipped defaults.',
  sameAsDefault
    ? 'The shipped defaults (critical 40, major 15, minor 5, BLOCKED < 70, READY >= 90) are among the best configurations, so they are kept.'
    : `A different configuration scored higher on the dev split; the shipped defaults were NOT changed automatically — a human should review this before editing src/verify/scoring.ts.`,
  `Only ${distinct.size} distinct outcome(s) across ${rows.length} configurations: any major or critical gate finding already makes the verdict BLOCKED regardless of weights (see docs/KNOWN_LIMITATIONS.md), so weights and thresholds only affect posts whose findings are all minor.`,
  `Dev split has ${dev.length} synthetic posts with unreviewed labels; this is a sanity check, not a statistically meaningful calibration.`,
];
for (const e of explanation) console.log(`- ${e}`);

const out = {
  meta: {
    computedAt: new Date().toISOString(),
    generator: 'scripts/calibrate.ts',
    split: 'dev',
    devPosts: dev.length,
    heldOutPostsUsed: 0,
    findingsSource: source,
    packHash: pack.hash,
    sweep: SWEEP,
  },
  shippedDefault: defaultRow,
  selected,
  selectedEqualsDefault: sameAsDefault,
  explanation,
  rows,
};
fs.writeFileSync(path.join(root, 'data', 'benchmark', 'calibration.json'), JSON.stringify(out, null, 2) + '\n');
console.log('\nWrote data/benchmark/calibration.json');
