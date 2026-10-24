/**
 * Records Replay-mode runs into data/replay/: the 12 sample posts and the 6
 * Compare scenarios.
 *
 *   npm run record-replay            # record (live where keys exist)
 *   npm run record-replay -- --check # only validate existing replays, exit 1 on problems
 *   npm run record-replay -- --deterministic  # never call models
 *
 * Provenance is written into every file and shown in the UI:
 *   live_recording           real model calls at record time
 *   deterministic_recording  the real pipeline's deterministic stages only
 *   illustrative_fixture     hand-written example output (Compare columns A/B
 *                            when no Gemini key was available) — NOT model output
 * A non-live run never overwrites an existing live recording.
 */
import './loadEnv';
import fs from 'fs';
import path from 'path';
import { getPolicyPack } from '@/src/kb';
import { pacedCaller } from './pace';
import { buildBaselineGeneratorPrompt } from '@/src/llm/prompts/baseline';
import { runGovernedGeneration, runGovernedReview } from '@/src/pipeline/governed';
import { evaluatePost } from '@/src/rules/engine';
import { compareMetrics } from '@/src/compare/metrics';
import { COMPARE_SCENARIOS } from '@/src/compare/scenarios';
import { SAMPLE_POSTS } from '@/data/samples/samplePosts';
import { CompareReplay, ReplaySchema, SampleReplay, compareReplayId, sampleReplayId } from '@/src/replay/schema';
import { REPLAY_DIR, loadReplay, replayInventory } from '@/src/replay/load';
import { LlmCallLog, PostContent } from '@/src/types';

const args = process.argv.slice(2);
const demoDate = process.env.DEMO_TODAY || '2026-10-24';
const keys = { gemini: Boolean(process.env.GEMINI_API_KEY), groq: Boolean(process.env.GROQ_API_KEY), nvidia: Boolean(process.env.NVIDIA_API_KEY) };
const forceDeterministic = args.includes('--deterministic');
/** --reviewers groq,nvidia (default: every reviewer whose key is configured). */
const reviewerArg = (() => { const i = process.argv.indexOf('--reviewers'); return i >= 0 ? process.argv[i + 1] : null; })();
const reviewerProviders = (reviewerArg ? reviewerArg.split(',') : ['groq', 'nvidia']).filter((p): p is 'groq' | 'nvidia' => (p === 'groq' || p === 'nvidia') && keys[p]);
const skippedReviewers = (['groq', 'nvidia'] as const).filter((p) => !reviewerProviders.includes(p));
const reviewersLive = !forceDeterministic && reviewerProviders.length > 0;
const compareLive = !forceDeterministic && keys.gemini && reviewersLive;
const reviewerNote = skippedReviewers.length ? ` Reviewer(s) not run: ${skippedReviewers.join(', ')} (${process.env.BENCHMARK_SKIP_REASON || 'not configured or excluded with --reviewers'}).` : '';
const pack = getPolicyPack();
const now = new Date().toISOString();
const llm = pacedCaller();

function report(): number {
  const inv = replayInventory();
  for (const r of inv) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id.padEnd(32)} ${r.ok ? `${r.provenance} (${r.recordedAt})` : r.error}`);
  const bad = inv.filter((r) => !r.ok).length;
  console.log(`${inv.length - bad}/${inv.length} required replays valid.`);
  return bad;
}

function write(replay: SampleReplay | CompareReplay) {
  ReplaySchema.parse(replay); // never write a file the loader would reject
  const existing = loadReplay(replay.id);
  if (existing.ok && existing.replay.provenance === 'live_recording' && replay.provenance !== 'live_recording') {
    console.log(`skip ${replay.id}: keeping existing live recording`);
    return;
  }
  fs.writeFileSync(path.join(REPLAY_DIR, `${replay.id}.json`), JSON.stringify(replay, null, 2) + '\n');
  console.log(`wrote ${replay.id} (${replay.provenance})`);
}

/** Hand-written example outputs, used only when no Gemini key is available. Labelled illustrative_fixture. */
const ILLUSTRATIVE: Record<string, { bare: PostContent; policies: PostContent }> = {
  'expired-offer': {
    bare: { caption: 'Flat 40% off Monsoon Clearance! Last chance, ends tonight 🔥 Grab your faves before they are gone. #ThriftIt #MonsoonSale #thriftshopping', hashtags: ['#ThriftIt', '#MonsoonSale', '#thriftshopping'], altText: 'Sale banner', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Monsoon Clearance ends tonight: flat 40% off curated pre-loved pieces. Tap the link in bio before midnight. #ThriftIt #MonsoonClearance', hashtags: ['#ThriftIt', '#MonsoonClearance'], altText: 'Rack of pre-loved rain jackets under a Monsoon Clearance sign', format: 'feed_4_5', language: 'en' },
  },
  'sustainability-claim': {
    bare: { caption: 'Thrifting is eco-friendly fashion at its best 🌍 Every tee saves 2,000 litres of water! Shop sustainable today. #ThriftIt #EcoFriendly #SustainableFashion', hashtags: ['#ThriftIt', '#EcoFriendly', '#SustainableFashion'], altText: '', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Choose pre-loved: every tee saves 2,000 litres of water and gives clothes a second life. Tap the link in bio. #ThriftIt #SecondLife', hashtags: ['#ThriftIt', '#SecondLife'], altText: 'Stack of folded pre-loved tees on a wooden table in daylight', format: 'feed_4_5', language: 'en' },
  },
  'wrong-price': {
    bare: { caption: 'Vintage jeans starting at just ₹299, the cheapest in Mumbai! 👖 Do not miss out. #ThriftIt #DenimRestock', hashtags: ['#ThriftIt', '#DenimRestock'], altText: 'Jeans', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Denim restock: vintage jeans starting at ₹299, hand-inspected and curated. Tap the link in bio. #ThriftIt #DenimDrop', hashtags: ['#ThriftIt', '#DenimDrop'], altText: 'Pre-loved jeans folded on a shelf in natural light', format: 'feed_4_5', language: 'en' },
  },
  'competitor-jab': {
    bare: { caption: 'Zara is trash and fast-fashion shoppers are wasting money 💸 Shop smarter with us! #ThriftIt #NoFastFashion', hashtags: ['#ThriftIt', '#NoFastFashion'], altText: 'Shopping bags', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Why pay fast-fashion prices? Better than Zara and kinder to your wallet. Curated pre-loved picks via the link in bio. #ThriftIt', hashtags: ['#ThriftIt'], altText: 'Curated pre-loved tops on a rail beside a mirror', format: 'feed_4_5', language: 'en' },
  },
  'undisclosed-collab': {
    bare: { caption: 'Our collab with @mumbai.stylist is here! She picked her favourite jackets from our rack 🧥 #ThriftIt #StyleCollab', hashtags: ['#ThriftIt', '#StyleCollab'], altText: 'Stylist holding a jacket', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Stylist @mumbai.stylist picked her favourite pre-loved jackets from our rack in this collab. Tap the link in bio to shop her edit. #ThriftIt #StylistEdit', hashtags: ['#ThriftIt', '#StylistEdit'], altText: 'Stylist holding a pre-loved denim jacket in the Bandra pop-up', format: 'feed_4_5', language: 'en' },
  },
  'festival-greeting': {
    bare: { caption: 'Happy Navratri! May the goddess bless you all 🙏 Celebrate with our Diwali Thrift Fest sale! #ThriftIt #Navratri', hashtags: ['#ThriftIt', '#Navratri'], altText: 'Festive lamps', format: 'feed_4_5', language: 'en' },
    policies: { caption: 'Shubh Navratri to our community. Celebrate with up to 30% off in the Diwali Thrift Fest. Tap the link in bio. #ThriftIt #DiwaliThriftFest', hashtags: ['#ThriftIt', '#DiwaliThriftFest'], altText: 'Festive pre-loved kurtas on a rail with marigold garlands', format: 'feed_4_5', language: 'en' },
  },
};

const scoreColumn = (post: PostContent) => {
  const gate = evaluatePost(post, pack, demoDate);
  return { metrics: compareMetrics(gate, pack.rules), findings: gate.findings };
};

async function recordSamples() {
  for (const s of SAMPLE_POSTS) {
    const r = await runGovernedReview(s.post, pack, { demoDate, reviewers: reviewersLive, reviewerProviders, llm });
    const live = reviewersLive && r.llmCalls.some((c) => c.ok);
    write({
      schemaVersion: 1, kind: 'sample', id: sampleReplayId(s.id), title: s.title,
      provenance: live ? 'live_recording' : 'deterministic_recording',
      recordedAt: now, packHash: pack.hash, demoDate, generator: 'scripts/record-replay.ts',
      notes: live
        ? [`Recorded from live reviewer calls (${reviewerProviders.join(' + ')}); replaying does not call any model.${reviewerNote}`]
        : ['Recorded without provider credentials: gates, citation verifier, consensus and scoring ran for real; the two LLM reviewers were not called, so soft-category findings (tone, messaging) are absent.'],
      sampleId: s.id, post: s.post, steps: r.steps, findings: r.findings, verdict: r.score.verdict, llmCalls: r.llmCalls,
      dropped: r.dropped.map((f) => ({ clauseId: f.clauseId, source: f.source, reason: r.droppedReasons[f.id] ?? 'failed verification' })),
    });
  }
}

async function recordCompare() {
  for (const sc of COMPARE_SCENARIOS) {
    try {
    let columns: CompareReplay['columns'];
    let provenance: CompareReplay['provenance'];
    let notes: string[];
    if (compareLive) {
      const baseline = async (variant: 'bare' | 'policies') => {
        const started = Date.now();
        const { system, user } = buildBaselineGeneratorPrompt(variant, sc.brief, pack);
        const res = await llm<PostContent>({ provider: 'gemini', system, user, purpose: `compare baseline (${variant})`, clauseIdsSent: variant === 'policies' ? pack.clauses.map((c) => c.id) : [] });
        if (!res.ok || !res.data) throw new Error(`${variant}: ${res.error}`);
        const post: PostContent = { caption: String(res.data.caption ?? ''), hashtags: Array.isArray(res.data.hashtags) ? res.data.hashtags.map(String) : [], altText: String(res.data.altText ?? ''), format: 'feed_4_5', language: 'en' };
        return { post, logs: [res.log] as LlmCallLog[], ms: Date.now() - started };
      };
      const [a, b] = [await baseline('bare'), await baseline('policies')];
      const started = Date.now();
      const c = await runGovernedGeneration(sc.brief, pack, { demoDate, maxIterations: 2, reviewerProviders, llm });
      const cMs = Date.now() - started;
      columns = [
        { key: 'bare', label: 'A · Bare AI', provenance: 'live_recording', post: a.post, ...scoreColumn(a.post), llmCalls: a.logs, wallMs: a.ms, note: 'Gemini with the one-line instruction only.' },
        { key: 'policies', label: 'B · AI + policies', provenance: 'live_recording', post: b.post, ...scoreColumn(b.post), llmCalls: b.logs, wallMs: b.ms, note: 'Same model, all eight policy documents in the prompt, single pass.' },
        { key: 'governed', label: 'C · Governed', provenance: 'live_recording', post: c.post, ...scoreColumn(c.post), pipelineVerdict: c.review.score.verdict, llmCalls: c.llmCalls, wallMs: cMs, note: `Grounded generation + full review, ${c.iterations.length} iteration(s).` },
      ];
      provenance = 'live_recording';
      notes = [`Recorded from live model calls (Gemini; reviewers ${reviewerProviders.join(' + ')}). Replaying does not call any model.${reviewerNote}`];
    } else {
      const ill = ILLUSTRATIVE[sc.id];
      const governed = await runGovernedReview(ill.policies, pack, { demoDate, reviewers: false });
      columns = [
        { key: 'bare', label: 'A · Bare AI', provenance: 'illustrative_fixture', post: ill.bare, ...scoreColumn(ill.bare), llmCalls: [], wallMs: null, note: 'Hand-written example of a typical unguided answer. Not model output.' },
        { key: 'policies', label: 'B · AI + policies', provenance: 'illustrative_fixture', post: ill.policies, ...scoreColumn(ill.policies), llmCalls: [], wallMs: null, note: 'Hand-written example of a policy-aware but unverified answer. Not model output.' },
        { key: 'governed', label: 'C · Governed', provenance: 'deterministic_recording', post: ill.policies, ...scoreColumn(ill.policies), pipelineVerdict: governed.score.verdict, llmCalls: [], wallMs: null, note: "The governed pipeline's deterministic stages (gates → verifier → scoring) run on draft B. Generation and LLM review were not recorded, so this shows what governance catches and blocks, not a rewritten post." },
      ];
      provenance = 'illustrative_fixture';
      notes = [
        'No provider credentials were available when this was recorded.',
        'Columns A and B are hand-written illustrations, not model output. All three are scored by the real gate engine.',
        'Run `npm run record-replay` with GEMINI, GROQ and NVIDIA keys to replace this with a live recording.',
      ];
    }
    write({
      schemaVersion: 1, kind: 'compare', id: compareReplayId(sc.id), title: sc.label, provenance,
      recordedAt: now, packHash: pack.hash, demoDate, generator: 'scripts/record-replay.ts', notes,
      scenarioId: sc.id, brief: sc.brief, columns,
    });
    } catch (e) {
      console.log(`FAILED ${compareReplayId(sc.id)}: ${e instanceof Error ? e.message : String(e)} (previous file kept)`);
    }
  }
}

async function main() {
  fs.mkdirSync(REPLAY_DIR, { recursive: true });
  console.log('Existing replays:');
  const bad = report();
  if (args.includes('--check')) process.exit(bad ? 1 : 0);
  console.log(`\nRecording (sample reviewers: ${reviewersLive ? 'LIVE' : 'deterministic'}, compare: ${compareLive ? 'LIVE' : 'illustrative + deterministic'})`);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
  if (only !== 'compare') await recordSamples();
  if (only !== 'samples') await recordCompare();
  console.log('\nAfter recording:');
  process.exit(report() ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
