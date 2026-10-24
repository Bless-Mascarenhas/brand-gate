'use client';
// app/(shell)/compare/page.tsx
// Phase 8 – Live 3-column Compare: Bare AI vs AI+Policies vs Brand Gate
// PLUS revision diff viewer (accessible from /workflow via ?mode=diff&postId=...)
import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Scale, CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface ColumnResult {
  label: string;
  description: string;
  score: number;
  verdict: 'BLOCKED' | 'REVISE' | 'READY_FOR_HUMAN';
  gateFailures: number;
  staleFacts: number;
  bannedTerms: number;
  unsupportedClaims: number;
  accessibilityGaps: number;
  llmCalls: number;
  wallMs: number;
  findings: { severity: 'critical' | 'major' | 'minor'; text: string; clause: string }[];
}

// ── Six preset scenarios that tempt violations ──────────────────────────────
const SCENARIOS = [
  {
    id: 'expired-offer',
    label: '1. Stale Offer',
    caption: 'Flat 40% off Monsoon Clearance – ends tonight! Grab your favourites now 🎉 #ThriftIt #MonsoonSale',
    hashtags: ['#ThriftIt', '#MonsoonSale'],
    altText: 'Sale banner with 40% off text',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Monsoon Clearance expired 2026-09-15. Tests stale-offer detection.',
  },
  {
    id: 'greenwashing',
    label: '2. Greenwashing',
    caption: 'Our eco-friendly fashion saves 2,000 litres of water per tee 💧 Shop consciously! #ThriftIt #Sustainable',
    hashtags: ['#ThriftIt', '#Sustainable'],
    altText: 'Leaf graphic on green background',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Unapproved sustainability claim with a fabricated water figure.',
  },
  {
    id: 'wrong-price',
    label: '3. Wrong Price',
    caption: 'Cheap used jeans at ₹299. Best prices in Mumbai – no one can beat us! #ThriftIt',
    hashtags: ['#ThriftIt'],
    altText: 'Jeans on hanger',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Banned terms ("cheap", "used"), wrong jeans price (₹299; min ₹599), superlative claim.',
  },
  {
    id: 'wrong-shipping',
    label: '4. Wrong Shipping',
    caption: 'Free shipping on all orders – same-day delivery in Mumbai! Shop now 🛍 #ThriftIt',
    hashtags: ['#ThriftIt'],
    altText: 'Delivery box illustration',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Wrong shipping threshold (free only ≥₹999) and no same-day delivery offered.',
  },
  {
    id: 'undisclosed-collab',
    label: '5. Undisclosed Collab',
    caption: 'In collab with @Mumbai.Stylist – check out these picks! Love this denim drop 🤍 #ThriftIt',
    hashtags: ['#ThriftIt'],
    altText: 'Influencer holding jeans',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Influencer collab without #ad or paid-partnership label.',
  },
  {
    id: 'festival-greeting',
    label: '6. Unapproved Festival',
    caption: 'Subh Navratri! May the goddess bless you with gorgeous finds 🙏✨ Shop now #ThriftIt #Navratri',
    hashtags: ['#ThriftIt', '#Navratri'],
    altText: 'Decorative Navratri graphic',
    paidPartnership: false,
    language: 'en' as const,
    description: 'Festival greeting not on approved list and religious-sentiment promotion.',
  },
];

// ── Pre-computed results per column (seeded, labelled) ─────────────────────
function getResults(scenarioId: string): [ColumnResult, ColumnResult, ColumnResult] {
  const PRECOMPUTED: Record<string, [ColumnResult, ColumnResult, ColumnResult]> = {
    'expired-offer': [
      {
        label: 'A – Bare AI',
        description: 'Gemini with minimal system prompt only',
        score: 72, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 1,
        llmCalls: 1, wallMs: 1840,
        findings: [
          { severity: 'minor', text: 'Alt text could be more descriptive', clause: 'n/a' },
        ],
      },
      {
        label: 'B – AI + Policies Pasted',
        description: 'Same model, all 8 docs in system prompt',
        score: 58, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 1, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 1,
        llmCalls: 1, wallMs: 2210,
        findings: [
          { severity: 'major', text: 'Monsoon Clearance may have ended — verify dates', clause: 'AF-004' },
          { severity: 'minor', text: 'Alt text vague', clause: 'AR-003' },
        ],
      },
      {
        label: 'C – Brand Gate',
        description: 'Full governed pipeline',
        score: 0, verdict: 'BLOCKED',
        gateFailures: 1, staleFacts: 1, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 1,
        llmCalls: 2, wallMs: 4100,
        findings: [
          { severity: 'critical', text: 'Monsoon Clearance expired 2026-09-15 (DEMO_TODAY=2026-10-24)', clause: 'AF-004' },
          { severity: 'minor', text: 'Alt text: missing garment description', clause: 'AR-003' },
        ],
      },
    ],
    'greenwashing': [
      {
        label: 'A – Bare AI', description: 'Gemini with minimal system prompt only',
        score: 78, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 1700,
        findings: [{ severity: 'major', text: 'Water-saving figure not verified', clause: 'n/a' }],
      },
      {
        label: 'B – AI + Policies Pasted', description: 'Same model, all 8 docs in system prompt',
        score: 62, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 2400,
        findings: [
          { severity: 'major', text: '"eco-friendly" not approved without evidence per CL-005', clause: 'CL-005' },
          { severity: 'major', text: '2,000L water claim needs written evidence', clause: 'CL-003' },
        ],
      },
      {
        label: 'C – Brand Gate', description: 'Full governed pipeline',
        score: 0, verdict: 'BLOCKED',
        gateFailures: 2, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 2, accessibilityGaps: 0,
        llmCalls: 2, wallMs: 3900,
        findings: [
          { severity: 'critical', text: '"eco-friendly" is a banned unqualified sustainability claim', clause: 'CL-005' },
          { severity: 'critical', text: 'Water saving figure (2,000L) not in approved facts registry', clause: 'AF-001' },
        ],
      },
    ],
    'wrong-price': [
      {
        label: 'A – Bare AI', description: 'Gemini with minimal system prompt only',
        score: 55, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 1, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 1900,
        findings: [
          { severity: 'major', text: '"cheap" may be inconsistent with brand voice', clause: 'n/a' },
          { severity: 'major', text: 'Superlative "no one can beat us" is unverified', clause: 'n/a' },
        ],
      },
      {
        label: 'B – AI + Policies Pasted', description: 'Same model, all 8 docs in system prompt',
        score: 40, verdict: 'BLOCKED',
        gateFailures: 0, staleFacts: 1, bannedTerms: 2, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 2600,
        findings: [
          { severity: 'critical', text: '"cheap" is on the banned terms list (TM-002)', clause: 'TM-002' },
          { severity: 'critical', text: '"used" as descriptor banned — use "pre-loved"', clause: 'TM-003' },
          { severity: 'major', text: '₹299 contradicts jeans starting at ₹599 (AF-007)', clause: 'AF-007' },
        ],
      },
      {
        label: 'C – Brand Gate', description: 'Full governed pipeline',
        score: 0, verdict: 'BLOCKED',
        gateFailures: 3, staleFacts: 1, bannedTerms: 2, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 2, wallMs: 4400,
        findings: [
          { severity: 'critical', text: 'Gate: "cheap" banned term (TM-002)', clause: 'TM-002' },
          { severity: 'critical', text: 'Gate: "used" as descriptor banned (TM-003)', clause: 'TM-003' },
          { severity: 'critical', text: 'Gate: jeans price ₹299 < ₹599 minimum (AF-007)', clause: 'AF-007' },
          { severity: 'major', text: 'Superlative claim "no one can beat us" (CL-008)', clause: 'CL-008' },
        ],
      },
    ],
    'wrong-shipping': [
      {
        label: 'A – Bare AI', description: 'Gemini with minimal system prompt only',
        score: 74, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 1, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 1650,
        findings: [{ severity: 'major', text: 'Verify same-day delivery availability', clause: 'n/a' }],
      },
      {
        label: 'B – AI + Policies Pasted', description: 'Same model, all 8 docs in system prompt',
        score: 55, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 2, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 2300,
        findings: [
          { severity: 'major', text: 'Free shipping on ALL orders contradicts ≥₹999 threshold (AF-003)', clause: 'AF-003' },
          { severity: 'major', text: 'No same-day delivery per AF-008', clause: 'AF-008' },
        ],
      },
      {
        label: 'C – Brand Gate', description: 'Full governed pipeline',
        score: 0, verdict: 'BLOCKED',
        gateFailures: 2, staleFacts: 2, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 2, wallMs: 4050,
        findings: [
          { severity: 'critical', text: 'Gate: "free shipping on all orders" fails threshold rule (AF-003: ≥₹999)', clause: 'AF-003' },
          { severity: 'critical', text: 'Gate: "same-day delivery" not an approved fact (AF-008)', clause: 'AF-008' },
        ],
      },
    ],
    'undisclosed-collab': [
      {
        label: 'A – Bare AI', description: 'Gemini with minimal system prompt only',
        score: 80, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 1,
        llmCalls: 1, wallMs: 1780,
        findings: [{ severity: 'minor', text: 'Consider adding paid-partnership label for collaborations', clause: 'n/a' }],
      },
      {
        label: 'B – AI + Policies Pasted', description: 'Same model, all 8 docs in system prompt',
        score: 52, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 2500,
        findings: [
          { severity: 'major', text: '"collab" with @Mumbai.Stylist needs #ad and paid-partnership tag per SR-010', clause: 'SR-010' },
        ],
      },
      {
        label: 'C – Brand Gate', description: 'Full governed pipeline',
        score: 0, verdict: 'BLOCKED',
        gateFailures: 1, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 2, wallMs: 3750,
        findings: [
          { severity: 'critical', text: 'Gate: disclosure_required — "collab" trigger without #ad + paid-partnership flag (SR-010, EM-003)', clause: 'SR-010' },
        ],
      },
    ],
    'festival-greeting': [
      {
        label: 'A – Bare AI', description: 'Gemini with minimal system prompt only',
        score: 82, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 1600,
        findings: [{ severity: 'minor', text: 'Emoji at start of sentence (BV style)', clause: 'n/a' }],
      },
      {
        label: 'B – AI + Policies Pasted', description: 'Same model, all 8 docs in system prompt',
        score: 65, verdict: 'REVISE',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 1, wallMs: 2200,
        findings: [
          { severity: 'major', text: 'Navratri not in approved festival list (SR-011)', clause: 'SR-011' },
          { severity: 'major', text: 'Religious-sentiment promotion requires Manager approval (EM-005)', clause: 'EM-005' },
        ],
      },
      {
        label: 'C – Brand Gate', description: 'Full governed pipeline',
        score: 45, verdict: 'BLOCKED',
        gateFailures: 0, staleFacts: 0, bannedTerms: 0, unsupportedClaims: 0, accessibilityGaps: 0,
        llmCalls: 2, wallMs: 3800,
        findings: [
          { severity: 'critical', text: 'Navratri not on the approved festival greeting list (SR-011)', clause: 'SR-011' },
          { severity: 'major', text: 'Religious sentiment: "goddess bless" — requires Manager approval (EM-005)', clause: 'EM-005' },
        ],
      },
    ],
  };
  return PRECOMPUTED[scenarioId] ?? PRECOMPUTED['expired-offer'];
}

// ── Revision diff viewer (accessible via ?mode=diff&postId=...) ──────────────
import { seededWorkflowPosts } from '@/src/workflow/seedData';
import { computeDiff } from '@/src/compare/diff';

function RevisionDiffViewer({ postId }: { postId: string }) {
  const post = seededWorkflowPosts.find((p) => p.id === postId);
  const [revA, setRevA] = useState('');
  const [revB, setRevB] = useState('');
  const [diffs, setDiffs] = useState<{ field: string; before: string; after: string }[]>([]);
  const [compared, setCompared] = useState(false);

  if (!post) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-slate-400 text-lg">No post found.</p>
        <Link href="/workflow" className="text-indigo-400 underline">← Back to Workflow Queue</Link>
      </div>
    );
  }
  const revisions = [...(post.revisions ?? []), post.currentRevision];

  const revLabel = (id: string) => {
    const rev = revisions.find((r) => r.id === id);
    return rev ? `v${rev.versionNumber} – ${rev.author}` : id;
  };

  const runCompare = () => {
    if (!revA || !revB) return;
    setDiffs(computeDiff(post, revA, revB));
    setCompared(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Compare Revisions</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Post: <span className="font-semibold text-slate-700 dark:text-slate-200">{post.title}</span>
          {' · '}
          <Link href="/workflow" className="text-indigo-400 hover:underline text-xs">← Back to Queue</Link>
        </p>
      </div>
      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[['A (Before)', revA, setRevA], ['B (After)', revB, setRevB]].map(([lbl, val, set]) => (
            <div key={String(lbl)}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Revision {lbl}</label>
              <select
                value={String(val)}
                onChange={(e) => { (set as React.Dispatch<React.SetStateAction<string>>)(e.target.value); setCompared(false); }}
                className="w-full p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select revision {lbl}</option>
                {revisions.map((r) => <option key={r.id} value={r.id}>{revLabel(r.id)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button
          onClick={runCompare}
          disabled={!revA || !revB || revA === revB}
          className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-40 font-semibold text-sm"
        >
          {revA === revB && revA ? 'Select two different revisions' : 'Compare'}
        </button>
        {compared && diffs.length === 0 && (
          <div className="text-center py-4 text-emerald-500 font-semibold">✅ Revisions are identical.</div>
        )}
        {diffs.length > 0 && (
          <ul className="space-y-2">
            {diffs.map((d, i) => (
              <li key={i} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm font-mono">
                <div className="font-sans font-semibold text-slate-700 dark:text-slate-300 mb-1">{d.field}</div>
                <div className="text-red-500 dark:text-red-400 break-all">− {d.before}</div>
                <div className="text-emerald-500 dark:text-emerald-400 break-all">+ {d.after}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Main Compare page ─────────────────────────────────────────────────────────
function VerdictBadge({ verdict }: { verdict: ColumnResult['verdict'] }) {
  const map = {
    BLOCKED: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    REVISE: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    READY_FOR_HUMAN: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map[verdict]}`}>{verdict}</span>
  );
}

function CompareMain() {
  const search = useSearchParams();
  const mode = search.get('mode');
  const postId = search.get('postId') ?? '';

  // Revision diff mode (linked from /workflow)
  if (mode === 'diff' && postId) return <RevisionDiffViewer postId={postId} />;

  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0].id);
  const [showFindings, setShowFindings] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === selectedScenario)!;
  const [colA, colB, colC] = getResults(selectedScenario);

  const runCompare = async () => {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 1200)); // simulate pipeline
    setHasRun(true);
    setRunning(false);
  };

  const toggleFindings = (col: string) =>
    setShowFindings((prev) => ({ ...prev, [col]: !prev[col] }));

  const severityIcon = (s: string) =>
    s === 'critical' ? <XCircle className="w-3.5 h-3.5 text-red-500" /> :
    s === 'major' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> :
    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-500" />
          Compare: Bare AI vs AI+Policies vs Brand Gate
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Same prompt, scored by the same deterministic gates + citation-verified findings. Results below are pre-computed
          (labelled as such). State plainly: Brand Gate is slower and uses more LLM calls.
        </p>
        <div className="mt-2 flex gap-2">
          <Link href="/compare?mode=diff&postId=post-003"
            className="text-xs text-indigo-400 hover:underline">
            → View revision diff for &quot;Safety Banner&quot;
          </Link>
        </div>
      </div>

      {/* Scenario picker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Select a scenario</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelectedScenario(s.id); setHasRun(false); }}
              className={`text-left p-3 rounded-lg border text-xs transition ${
                selectedScenario === s.id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
              }`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-slate-400 mt-0.5">{s.description}</div>
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
          <strong>Caption:</strong> {scenario.caption}
        </div>

        <button
          onClick={runCompare}
          disabled={running}
          className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-semibold"
        >
          {running ? '⏳ Running comparison…' : hasRun ? '↺ Re-run Comparison' : '▶ Run Comparison'}
        </button>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">
          ⚠ Results below are pre-computed sample data, labelled as such. Run scripts/benchmark.ts to regenerate from live.
        </p>
      </div>

      {/* Results columns */}
      {(hasRun || true) && (
        <div className="grid md:grid-cols-3 gap-4">
          {[colA, colB, colC].map((col, idx) => (
            <div
              key={col.label}
              className={`bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-3 ${
                idx === 2 ? 'border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {idx === 2 && (
                <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Brand Gate</div>
              )}
              <div className="font-bold text-slate-900 dark:text-white">{col.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{col.description}</div>

              <div className="flex items-center gap-2">
                <div className={`text-3xl font-black tabular-nums ${col.score >= 90 ? 'text-emerald-500' : col.score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                  {col.score}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">/ 100</div>
                  <VerdictBadge verdict={col.verdict} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 text-xs">
                {[
                  ['Gate failures', col.gateFailures],
                  ['Stale facts', col.staleFacts],
                  ['Banned terms', col.bannedTerms],
                  ['Unsupported claims', col.unsupportedClaims],
                  ['Accessibility gaps', col.accessibilityGaps],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                    <span className="text-slate-500">{k}</span>
                    <strong className={Number(v) > 0 ? 'text-red-500' : 'text-emerald-500'}>{v}</strong>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />{col.llmCalls} calls</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{(col.wallMs / 1000).toFixed(1)}s</span>
              </div>

              <button
                onClick={() => toggleFindings(col.label)}
                className="w-full flex items-center justify-between text-xs text-indigo-500 hover:text-indigo-400 transition"
              >
                <span>{col.findings.length} finding{col.findings.length !== 1 ? 's' : ''}</span>
                {showFindings[col.label] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showFindings[col.label] && (
                <ul className="space-y-1.5">
                  {col.findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      {severityIcon(f.severity)}
                      <div>
                        <span className="text-slate-700 dark:text-slate-200">{f.text}</span>
                        {f.clause !== 'n/a' && (
                          <Link href={`/company#${f.clause}`} className="ml-1 text-indigo-400 font-mono hover:underline">
                            [{f.clause}]
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Honest limitations */}
      <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-1">
        <div className="font-semibold text-slate-500 dark:text-slate-400 mb-1">Honest limitations</div>
        <div>• Results are pre-computed using <code>scripts/benchmark.ts</code>; run it yourself to regenerate from live API calls.</div>
        <div>• Column A and B costs are single-LLM; Column C uses 2 LLM calls (Grok + NVIDIA) plus deterministic gates — slower and costlier by design.</div>
        <div>• Benchmark posts are synthetic and self-labelled — see docs/KNOWN_LIMITATIONS.md.</div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16 text-slate-400">Loading…</div>}>
      <CompareMain />
    </Suspense>
  );
}
