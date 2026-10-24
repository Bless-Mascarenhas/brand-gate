'use client';
// Edit mode + version history for one policy document (Manager only; stored in this browser).
import React, { useState } from 'react';
import { History, Pencil, RotateCcw, Save, X } from 'lucide-react';
import { PolicyDoc } from '@/src/types';
import { useApp } from '@/src/ui/context/AppContext';
import { DocVersion, EditHistory, canEditPolicy, checkEdit, discardDocEdits, saveDocEdit } from '@/src/kb/edits';

export function DocEditor({ original, current, versions, onHistory }: { original: PolicyDoc; current: PolicyDoc; versions: DocVersion[]; onHistory: (h: EditHistory) => void }) {
  const { role } = useApp();
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const allowed = canEditPolicy(role);
  const check = draft !== null ? checkEdit(original, draft) : null;

  const save = async (content: string, why: string) => {
    setError(null);
    try {
      onHistory(await saveDocEdit(original, content, { role, user: `${role}-demo`, note: why }));
      setDraft(null);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section aria-label="Edit document" className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {draft === null ? (
          <button type="button" disabled={!allowed} onClick={() => setDraft(current.content)} title={allowed ? undefined : 'Switch to the Manager role to edit (EM-005)'}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 disabled:opacity-50">
            <Pencil className="w-3.5 h-3.5" aria-hidden /> Edit document
          </button>
        ) : (
          <button type="button" onClick={() => setDraft(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
            <X className="w-3.5 h-3.5" aria-hidden /> Cancel
          </button>
        )}
        {!allowed && <span className="text-slate-600 dark:text-slate-400">Only the Manager role edits policy (EM-005).</span>}
        {versions.length > 0 && allowed && (
          <button type="button" onClick={async () => onHistory(await discardDocEdits(original.id, role))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Discard local edits
          </button>
        )}
      </div>
      <p className="text-amber-700 dark:text-amber-300">
        Edits are saved in this browser, re-index the clauses and change the pack hash shown above. The review pipeline (gates and reviewers) keeps using the approved pack on the server.
      </p>

      {draft !== null && (
        <div className="space-y-2">
          <label className="block">
            <span className="font-semibold">Document markdown</span>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} className="mt-1 w-full p-2 font-mono rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          </label>
          <label className="block">
            <span className="font-semibold">Change note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
          </label>
          <div role="status" aria-live="polite" className="space-y-0.5">
            <div>{check?.clauseIds.length ?? 0} clause(s) found.</div>
            {check?.errors.map((e) => <div key={e} className="text-red-600 dark:text-red-400">{e}</div>)}
            {check?.warnings.map((w) => <div key={w} className="text-amber-700 dark:text-amber-300">{w}</div>)}
          </div>
          <button type="button" disabled={!check?.ok} onClick={() => save(draft, note)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50">
            <Save className="w-3.5 h-3.5" aria-hidden /> Save as version {versions.length + 1}
          </button>
        </div>
      )}
      {error && <div role="alert" className="text-red-600 dark:text-red-400">{error}</div>}

      {versions.length > 0 && (
        <details>
          <summary className="cursor-pointer inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400"><History className="w-3.5 h-3.5" aria-hidden /> Version history ({versions.length} local edit{versions.length > 1 ? 's' : ''})</summary>
          <ol className="mt-1 space-y-1">
            <li className="text-slate-600 dark:text-slate-400">v0 — approved document from the repository ({original.clauses.length} clauses)</li>
            {versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center gap-2">
                <span>v{v.version} — {v.at.slice(0, 16).replace('T', ' ')} by {v.role} · {v.clauseCount} clauses · “{v.note}”</span>
                {allowed && v.version < versions.length && (
                  <button type="button" onClick={() => save(v.content, `Restore v${v.version}`)} className="underline text-indigo-600 dark:text-indigo-400">Restore as new version</button>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
