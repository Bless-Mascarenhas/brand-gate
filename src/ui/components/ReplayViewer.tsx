'use client';
// Replay mode viewer: plays recorded runs from /api/replay. Never calls a model.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, AlertOctagon, ShieldAlert } from 'lucide-react';
import { CompareReplay, PROVENANCE_LABEL, Provenance, Replay, SampleReplay } from '@/src/replay/schema';

export function useReplay<T extends Replay>(id: string | null): { replay: T | null; error: string | null; loading: boolean } {
  const [state, setState] = useState<{ replay: T | null; error: string | null; loading: boolean }>({ replay: null, error: null, loading: Boolean(id) });
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ replay: null, error: null, loading: true });
    fetch(`/api/replay?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({ error: `Replay endpoint returned HTTP ${r.status}` }));
        if (cancelled) return;
        if (!r.ok) setState({ replay: null, error: data.error ?? `HTTP ${r.status}`, loading: false });
        else setState({ replay: data.replay as T, error: null, loading: false });
      })
      .catch((e) => !cancelled && setState({ replay: null, error: `Could not load the recorded run: ${e.message}`, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [id]);
  return state;
}

const provenanceClass: Record<Provenance, string> = {
  live_recording: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  deterministic_recording: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  illustrative_fixture: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
};

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${provenanceClass[provenance]}`}>{PROVENANCE_LABEL[provenance]}</span>;
}

export function RecordedBanner({ replay }: { replay: Replay }) {
  return (
    <div role="status" className="p-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-xs space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <History className="w-4 h-4 text-amber-600" />
        <strong className="text-amber-800 dark:text-amber-300 uppercase tracking-wide">Recorded run, not live</strong>
        <ProvenanceBadge provenance={replay.provenance} />
      </div>
      <div className="text-slate-600 dark:text-slate-300">
        Recorded {replay.recordedAt.slice(0, 16).replace('T', ' ')} UTC by <code>{replay.generator}</code> · pack <code>{replay.packHash}</code> · demo date {replay.demoDate}
      </div>
      {replay.notes.map((n, i) => <div key={i} className="text-slate-600 dark:text-slate-300">• {n}</div>)}
    </div>
  );
}

export function ReplayError({ error }: { error: string }) {
  return (
    <div role="alert" className="p-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex gap-2">
      <AlertOctagon className="w-4 h-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

const sev: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400', major: 'text-amber-600 dark:text-amber-400', minor: 'text-slate-500', info: 'text-sky-600',
};

export function SampleReplayView({ replay }: { replay: SampleReplay }) {
  const v = replay.verdict;
  return (
    <div className="space-y-4">
      <RecordedBanner replay={replay} />
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Verdict (recorded)</div>
          <div className={`text-xl font-black ${v.status === 'BLOCKED' ? 'text-red-600' : v.status === 'REVISE' ? 'text-amber-600' : 'text-emerald-600'}`}>{v.status}</div>
          {v.gatesFailed.length > 0 && <div className="text-xs text-slate-500">Failed gates: {v.gatesFailed.join(', ')}</div>}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">{v.score}</div>
          <div className="text-[10px] text-slate-500">/ 100 · {replay.llmCalls.length} model call(s) recorded · {replay.dropped.length} hallucination(s) blocked</div>
        </div>
      </div>

      <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Recorded pipeline steps</h3>
        <ol className="space-y-1 text-xs">
          {replay.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className={`font-mono w-20 shrink-0 ${s.status === 'skipped' ? 'text-slate-400' : s.status === 'failed' ? 'text-red-500' : 'text-emerald-600'}`}>{s.status}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 w-36 shrink-0">{s.step}</span>
              <span className="text-slate-600 dark:text-slate-300">{s.message}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Findings ({replay.findings.length})</h3>
        {replay.findings.length === 0 && <p className="text-xs text-emerald-600">No findings were recorded for this post.</p>}
        <ul className="space-y-2">
          {replay.findings.map((f) => (
            <li key={f.id} className="text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex flex-wrap gap-2 items-center">
                <strong className={sev[f.severity]}>{f.severity}</strong>
                <span className="text-slate-500">{f.category}</span>
                <Link href={`/company#${f.clauseId}`} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline">[{f.clauseId}]</Link>
                <span className="text-slate-400">{f.source} · {f.agreement}{f.verified ? ' · verified' : ''}</span>
              </div>
              <div className="text-slate-700 dark:text-slate-200">Post: “{f.postQuote}” ({f.postField})</div>
              {f.clauseQuote && <div className="text-slate-500 italic">Clause: “{f.clauseQuote}”</div>}
              <div className="text-slate-600 dark:text-slate-300">{f.explanation}</div>
            </li>
          ))}
        </ul>
        {replay.dropped.length > 0 && (
          <div className="mt-3 text-xs">
            <div className="font-semibold text-red-600 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" />Blocked citations</div>
            <ul>{replay.dropped.map((d, i) => <li key={i}>{d.source} cited {d.clauseId}: {d.reason}</li>)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}

export function SampleReplayPanel({ id }: { id: string }) {
  const { replay, error, loading } = useReplay<SampleReplay>(id);
  if (loading) return <div className="text-xs text-slate-500 p-4">Loading recorded run…</div>;
  if (error) return <ReplayError error={error} />;
  if (!replay || replay.kind !== 'sample') return <ReplayError error={`Recorded run "${id}" is not a sample-post recording.`} />;
  return <SampleReplayView replay={replay} />;
}

export type { CompareReplay };
