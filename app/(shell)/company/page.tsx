'use client';

import React, { useEffect, useState } from 'react';
import {
  Building2,
  FileText,
  CheckCircle2,
  Shield,
  Palette,
  Hash,
  Search,
} from 'lucide-react';
import { PolicyPack, PolicyDoc, FactEntry, Rule } from '@/src/types';

export default function CompanyPage() {
  const [pack, setPack] = useState<PolicyPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<'docs' | 'facts' | 'rules' | 'assets'>('docs');
  const [selectedDocId, setSelectedDocId] = useState<string>('DOC-BV-001');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedClause, setHighlightedClause] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/pack')
      .then((res) => res.json())
      .then((data: PolicyPack) => {
        setPack(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load policy pack', err);
        setLoading(false);
      });

    // Check hash on load for deep linking (e.g. #BV-007)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash) {
        setHighlightedClause(hash);
      }
    }
  }, []);

  const activeDoc: PolicyDoc | undefined = pack?.docs.find((d) => d.id === selectedDocId);

  const filteredRules: Rule[] = (pack?.rules || []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.id.toLowerCase().includes(q) ||
      r.clause.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q)
    );
  });

  const filteredFacts: FactEntry[] = (pack?.facts || []).filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.id.toLowerCase().includes(q) ||
      f.clauseId.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Thrift-It Governed Knowledge Base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Snapshot Hash */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Company Knowledge Base (Thrift-It)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Governing rules, facts, terminology, visual guidelines, and escalation protocols for @thriftit.in.
          </p>
        </div>

        {pack && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 font-mono text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Pack Hash:</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{pack.hash}</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 text-[10px]">{pack.clauses.length} Clauses</span>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'docs', label: '8 Policy Documents', icon: FileText, count: pack?.docs.length },
          { id: 'facts', label: 'Approved Facts', icon: CheckCircle2, count: pack?.facts.length },
          { id: 'rules', label: 'Deterministic Rules', icon: Shield, count: pack?.rules.length },
          { id: 'assets', label: 'Brand Assets & Palette', icon: Palette, count: pack?.assets.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setMainTab(tab.id as any);
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content: Policy Documents */}
      {mainTab === 'docs' && pack && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Document List Sub-sidebar */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
              Policies ({pack.docs.length})
            </h3>
            {pack.docs.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    setHighlightedClause(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl text-xs font-semibold transition border ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      [{doc.prefix}]
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">v{doc.version}</span>
                  </div>
                  <div className="truncate font-bold">{doc.title.replace(/\s*\([A-Z]+\)$/, '')}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{doc.clauses.length} clauses</div>
                </button>
              );
            })}
          </div>

          {/* Document Content View */}
          <div className="lg:col-span-3 space-y-4">
            {activeDoc && (
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
                {/* Doc Meta Header */}
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 font-bold">
                        {activeDoc.id}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">Version {activeDoc.version}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span>Effective: {activeDoc.effectiveDate}</span>
                      <span>Owner: {activeDoc.owner}</span>
                    </div>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">{activeDoc.title}</h2>
                  <p className="text-[11px] text-slate-400 italic mt-1">
                    Fictional company policy for demo purposes. Regulatory references are illustrative.
                  </p>
                </div>

                {/* Clauses list with anchorable IDs */}
                <div className="space-y-4">
                  {activeDoc.clauses.map((clause) => {
                    const isAnchorHighlighted = highlightedClause === clause.id;
                    return (
                      <div
                        key={clause.id}
                        id={clause.id}
                        className={`p-4 rounded-xl transition-all ${
                          isAnchorHighlighted
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-500 shadow-md ring-2 ring-amber-400/20'
                            : 'bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <a
                            href={`#${clause.id}`}
                            onClick={() => setHighlightedClause(clause.id)}
                            className="inline-flex items-center gap-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Hash className="w-3.5 h-3.5" />
                            <span>{clause.id}</span>
                          </a>
                          <span className="text-[10px] text-slate-400 font-mono">{activeDoc.prefix}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                          {clause.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Approved Facts */}
      {mainTab === 'facts' && pack && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search facts by key, ID, or clause..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Demo Date: <strong>2026-10-24</strong>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Fact ID</th>
                  <th className="py-3 px-4">Clause</th>
                  <th className="py-3 px-4">Key / Parameter</th>
                  <th className="py-3 px-4">Approved Value</th>
                  <th className="py-3 px-4">Validity Window</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                {filteredFacts.map((fact) => {
                  const isActive = fact.status === 'active';
                  const isExpired = fact.status === 'expired';
                  return (
                    <tr key={fact.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{fact.id}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setMainTab('docs');
                            setSelectedDocId('DOC-AF-001');
                            setHighlightedClause(fact.clauseId);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          [{fact.clauseId}]
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{fact.key}</td>
                      <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-300">
                        {String(fact.value)} {fact.unit ? `(${fact.unit})` : ''}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[10px]">
                        {fact.validFrom} &rarr; {fact.validTo || 'Present'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : isExpired
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {fact.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Deterministic Rules */}
      {mainTab === 'rules' && pack && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 47 rules by ID, type, or message..."
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Total Rules: <strong>{pack.rules.length}</strong> (100% Deterministic)
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Rule ID</th>
                  <th className="py-3 px-4">Clause</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Auto-Fix</th>
                  <th className="py-3 px-4">Verification Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                {filteredRules.map((rule) => {
                  const isCrit = rule.severity === 'critical';
                  const isMajor = rule.severity === 'major';
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{rule.id}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            setMainTab('docs');
                            const prefix = rule.clause.split('-')[0];
                            const doc = pack.docs.find((d) => d.prefix === prefix);
                            if (doc) setSelectedDocId(doc.id);
                            setHighlightedClause(rule.clause);
                          }}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                        >
                          [{rule.clause}]
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{rule.type}</td>
                      <td className="py-3 px-4 text-slate-500 capitalize">{rule.category}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            isCrit
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                              : isMajor
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {rule.autoFix ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">Yes</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Manual</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate" title={rule.message}>
                        {rule.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Brand Assets */}
      {mainTab === 'assets' && pack && (
        <div className="space-y-6">
          {/* Swatches Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Thrift-It Official Brand Palette</h3>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {[
                { name: 'Thrift Teal', hex: '#0E7C7B', usage: 'Primary brand accent' },
                { name: 'Marigold', hex: '#F2A900', usage: 'CTA fill & hyphen' },
                { name: 'Ink', hex: '#1B1B1F', usage: 'Typography & dark bands' },
                { name: 'Paper', hex: '#FAF6EE', usage: 'Neutral backgrounds' },
                { name: 'Chili', hex: '#D7263D', usage: 'Status alerts only' },
              ].map((swatch, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="h-20 w-full" style={{ backgroundColor: swatch.hex }} />
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60">
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{swatch.name}</div>
                    <div className="text-[11px] font-mono text-slate-500">{swatch.hex}</div>
                    <div className="text-[10px] text-slate-400 mt-1">{swatch.usage}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wordmark Preview */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Official Wordmark SVG</h3>
            <p className="text-xs text-slate-500">
              Clear space equals the height of the &quot;T&quot;. Marigold hyphen is mandatory.
            </p>
            <div className="p-6 rounded-xl bg-[#FAF6EE] flex items-center justify-center border border-slate-200">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60" width="240" height="60">
                <text x="10" y="42" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="34" fill="#1B1B1F" letterSpacing="-1">
                  Thrift<tspan fill="#F2A900">-</tspan>It
                </text>
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
