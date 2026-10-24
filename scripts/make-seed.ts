/**
 * Generates the labelled SAMPLE DATA used by Workflow and Insights:
 *   data/seed/workflow.json        six workflow posts in varied states
 *   data/seed/insights-events.json ~120 historical insight events
 *
 * Deterministic: fixed timestamps and a seeded PRNG, so re-running produces the
 * same files. Workflow posts are built by running the real gate engine on the
 * sample posts and the real workflow actions (permissions included). The insight
 * history mixes real gate findings with synthetic reviewer outcomes (disputes,
 * hallucinations) — it is sample data and every event carries `sample: true`.
 *
 * Run: npm run seed
 */
import './loadEnv';
import fs from 'fs';
import path from 'path';
import { loadPolicyPack, getRoutedClausesForCategories } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { SAMPLE_POSTS } from '@/data/samples/samplePosts';
import { Finding, PostContent, Role } from '@/src/types';
import { Revision, WorkflowPost } from '@/src/workflow/types';
import { ActionContext, addComment, addRevision, approve, overrideFinding, publishMock, requestChanges, submitForReview } from '@/src/workflow/actions';
import { CheckEvent, HumanEvent, InsightEvent, toEventFinding } from '@/src/insights/types';

const DEMO_DATE = '2026-10-24';
const pack = loadPolicyPack();
const sample = (id: number) => SAMPLE_POSTS.find((s) => s.id === id)!.post;

function review(post: PostContent, idPrefix: string): { findings: Finding[]; verdict: ReturnType<typeof computeScoreAndVerdict>['verdict'] } {
  const gate = evaluatePost(post, pack, DEMO_DATE);
  const findings = gate.findings.map((f, i) => ({ ...f, id: `${idPrefix}-f${i + 1}` }));
  return { findings, verdict: computeScoreAndVerdict(findings, gate.gatesFailed).verdict };
}

function draft(id: string, title: string, author: string, content: PostContent, at: string): WorkflowPost {
  const { findings, verdict } = review(content, `${id}-v1`);
  const rev: Revision = { id: `${id}-v1`, postId: id, versionNumber: 1, post: content, score: verdict.score, verdict, findings, author, createdAt: at };
  return {
    id, title, state: 'draft', author, currentRevision: rev, revisions: [], comments: [],
    auditLog: [{ id: `${id}-a1`, postId: id, user: author, role: 'creator', action: 'create_draft', afterState: 'draft', details: 'Sample data', timestamp: at, packHash: pack.hash }],
    approvals: [], overrides: [], changeRequests: [], createdAt: at, updatedAt: at, isSampleData: true,
  };
}

const ctx = (role: Role, user: string, now: string): ActionContext => ({ role, user, now, packHash: pack.hash });
const revise = (p: WorkflowPost, content: PostContent, c: ActionContext, summary: string) => {
  const v = p.currentRevision.versionNumber + 1;
  const { findings, verdict } = review(content, `${p.id}-v${v}`);
  return addRevision(p, c, { content, findings, verdict, diffSummary: summary }).post;
};

// ── Workflow posts ──────────────────────────────────────────────────────────
const posts: WorkflowPost[] = [];

// 1. Draft: clean Diwali post, not yet submitted.
posts.push(draft('wf-001', 'Diwali Thrift Fest teaser', 'Creator A', sample(1), '2026-10-22T09:00:00.000Z'));

// 2. In review: borderline emoji/tone post — minor findings, waits for one reviewer.
{
  let p = draft('wf-002', 'Weekend pop-up reminder', 'Creator B', sample(11), '2026-10-22T10:00:00.000Z');
  p = submitForReview(p, ctx('creator', 'Creator B', '2026-10-22T10:05:00.000Z')).post;
  p = addComment(p, ctx('reviewer', 'Reviewer A', '2026-10-22T11:00:00.000Z'), 'Three emojis — SR-005 allows two. Can we drop one?', p.currentRevision.findings[0]?.id).post;
  posts.push(p);
}

// 3. In review with a critical disclosure finding: needs a Manager override, then Manager + Reviewer.
{
  let p = draft('wf-003', 'Stylist collab denim drop', 'Creator C', sample(6), '2026-10-21T09:00:00.000Z');
  p = submitForReview(p, ctx('creator', 'Creator C', '2026-10-21T09:10:00.000Z')).post;
  p = addComment(p, ctx('manager', 'Manager A', '2026-10-21T12:00:00.000Z'), 'Is this a paid partnership? If yes we need #ad and the label before anyone approves.').post;
  posts.push(p);
}

// 4. Changes requested: banned terms + wrong price; reviewer sent it back with a reason.
{
  let p = draft('wf-004', 'Denim restock (tier-2 cities)', 'Creator A', sample(4), '2026-10-20T09:00:00.000Z');
  p = submitForReview(p, ctx('creator', 'Creator A', '2026-10-20T09:30:00.000Z')).post;
  const f = p.currentRevision.findings[0];
  p = addComment(p, ctx('reviewer', 'Reviewer B', '2026-10-20T13:00:00.000Z'), '"cheap" and "used" are both banned descriptors — try "pre-loved".', f?.id).post;
  p = requestChanges(p, ctx('reviewer', 'Reviewer B', '2026-10-20T13:05:00.000Z'), { reason: 'wrong_fact', text: 'Jeans start at ₹599, not ₹299; also replace banned terms.' }).post;
  posts.push(p);
}

// 5. Approved: wrong shipping facts fixed in v2, approved by the required roles.
{
  let p = draft('wf-005', 'Free shipping announcement', 'Creator B', sample(5), '2026-10-18T09:00:00.000Z');
  p = submitForReview(p, ctx('creator', 'Creator B', '2026-10-18T09:15:00.000Z')).post;
  p = requestChanges(p, ctx('manager', 'Manager A', '2026-10-18T11:00:00.000Z'), { reason: 'wrong_fact', text: 'Free shipping is only above ₹999 and we do not offer same-day delivery.' }).post;
  p = revise(p, {
    ...sample(5),
    caption: 'Free shipping on orders above ₹999, delivered in 3-6 business days across metros. Tap the link in bio to shop the curated pre-loved drop. #ThriftIt #PreLovedFashion',
    hashtags: ['#ThriftIt', '#PreLovedFashion'],
  }, ctx('creator', 'Creator B', '2026-10-19T09:00:00.000Z'), 'Corrected shipping threshold and delivery window');
  p = submitForReview(p, ctx('creator', 'Creator B', '2026-10-19T09:05:00.000Z')).post;
  for (const [role, user, at] of [['manager', 'Manager A', '2026-10-19T12:00:00.000Z'], ['reviewer', 'Reviewer A', '2026-10-19T12:30:00.000Z']] as const) {
    try { p = approve(p, ctx(role, user, at)).post; } catch { /* role not required for this revision */ }
  }
  posts.push(p);
}

// 6. Published (mock): clean post approved and published by a Manager.
{
  let p = draft('wf-006', 'Bandra pop-up hours', 'Creator C', {
    ...sample(1),
    caption: 'Our Bandra pop-up is open Friday to Sunday, 12 pm to 8 pm. Every piece is hand-inspected, so come try on your next favourite. #ThriftIt #BandraPopUp',
    hashtags: ['#ThriftIt', '#BandraPopUp'],
  }, '2026-10-15T09:00:00.000Z');
  p = submitForReview(p, ctx('creator', 'Creator C', '2026-10-15T09:10:00.000Z')).post;
  for (const [role, user, at] of [['reviewer', 'Reviewer A', '2026-10-15T10:00:00.000Z'], ['manager', 'Manager A', '2026-10-15T10:30:00.000Z']] as const) {
    try { p = approve(p, ctx(role, user, at)).post; } catch { /* not required */ }
  }
  p = publishMock(p, ctx('manager', 'Manager A', '2026-10-15T11:00:00.000Z')).post;
  posts.push(p);
}

const states = posts.map((p) => p.state);
for (const s of ['draft', 'in_review', 'changes_requested', 'approved', 'published_mock']) {
  if (!states.includes(s as WorkflowPost['state'])) throw new Error(`Seed does not cover state ${s}: ${states.join(',')}`);
}
void overrideFinding; // the critical override on wf-003 is left for the demo user to perform

// ── Insight history (~120 events) ───────────────────────────────────────────
let seedState = 20261024;
const rnd = () => ((seedState = (seedState * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];

const ruleClauses = Array.from(new Set(pack.rules.map((r) => r.clause)));
const routed = getRoutedClausesForCategories(['tone', 'terminology', 'messaging', 'claims', 'regional'], pack).map((c) => c.id);
const checkedClauseIds = Array.from(new Set([...ruleClauses, ...routed])).sort();

const VAGUE: { clauseId: string; category: Finding['category']; quote: string; reason: string }[] = [
  { clauseId: 'BV-007', category: 'tone', quote: 'yaar this drop is lowkey insane', reason: 'Tone call: "lowkey insane" read as too casual by one reviewer, fine by the other' },
  { clauseId: 'CL-004', category: 'claims', quote: 'shop consciously', reason: '"Shop consciously" — is that sustainability language or just a CTA?' },
  { clauseId: 'SR-009', category: 'regional', quote: 'diya and rangoli backdrop', reason: 'Unclear whether a rangoli backdrop counts as appropriate festival imagery' },
  { clauseId: 'BV-002', category: 'tone', quote: 'desi chic vibes only', reason: 'Hinglish register judged borderline' },
];
const HALLUCINATION_REASONS = [
  'clauseId does not exist in the policy pack',
  'clauseQuote not found in the cited clause',
  'postQuote not found in the stated field',
];

const events: InsightEvent[] = [];
const start = Date.parse('2026-09-14T09:00:00.000Z');
const SPAN_DAYS = 39;

for (let i = 0; i < 98; i++) {
  const ts = new Date(start + Math.floor(rnd() * SPAN_DAYS * 86400000)).toISOString();
  const sampleId = pick([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 1, 1]);
  const afterFix = rnd() < 0.3;
  const content = afterFix ? sample(1) : sample(sampleId);
  const gate = evaluatePost(content, pack, DEMO_DATE);
  const findings: Finding[] = [...gate.findings];
  if (rnd() < 0.35) {
    const v = pick(VAGUE);
    findings.push({
      id: `seed-${i}-llm`, source: pick(['groq', 'nvidia'] as const), category: v.category, severity: rnd() < 0.5 ? 'minor' : 'major',
      clauseId: v.clauseId, clauseQuote: '', postField: 'caption', postQuote: v.quote, explanation: v.reason,
      autoFixable: false, confidence: 0.6, verified: true, agreement: rnd() < 0.7 ? 'disputed' : 'agreed',
    });
  }
  const hallucinations = rnd() < 0.25
    ? [{ model: pick(['Reviewer A (GROQ_MODEL)', 'Reviewer B (NVIDIA_MODEL)']), reason: pick(HALLUCINATION_REASONS) }]
    : [];
  const verdict = computeScoreAndVerdict(findings, gate.gatesFailed, hallucinations.length).verdict;
  const ev: CheckEvent = {
    kind: 'check', id: `seed-check-${String(i + 1).padStart(3, '0')}`, ts, sample: true,
    origin: rnd() < 0.5 ? 'build' : 'seed', pass: afterFix ? 'after_fix' : 'first', score: verdict.score, verdict: verdict.status,
    iterations: afterFix ? 1 + Math.floor(rnd() * 3) : undefined,
    checkedClauseIds, findings: findings.map(toEventFinding), hallucinations,
  };
  events.push(ev);
}

for (let i = 0; i < 22; i++) {
  const v = pick(VAGUE);
  const ts = new Date(start + Math.floor(rnd() * SPAN_DAYS * 86400000)).toISOString();
  const kind = rnd() < 0.45 ? 'human_override' : 'human_rejection';
  const ev: HumanEvent = {
    kind, id: `seed-human-${String(i + 1).padStart(3, '0')}`, ts, sample: true,
    role: kind === 'human_override' ? pick(['manager', 'reviewer'] as const) : pick(['reviewer', 'manager'] as const),
    clauseIds: [v.clauseId], reason: v.reason,
  };
  events.push(ev);
}
events.sort((a, b) => a.ts.localeCompare(b.ts));

const outDir = path.join(process.cwd(), 'data', 'seed');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'workflow.json'), JSON.stringify(posts, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'insights-events.json'), JSON.stringify(events, null, 2) + '\n');
console.log(`Wrote ${posts.length} workflow posts (${states.join(', ')}) and ${events.length} insight events (pack ${pack.hash}).`);
