'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wand2,
} from 'lucide-react';
import { diffWords } from 'diff';
import { useApp } from '@/src/ui/context/AppContext';
import { usePipeline } from '@/src/pipeline';
import { PolicyPack, PostContent } from '@/src/types';
import { SAMPLE_POSTS, SamplePostItem } from '@/data/samples/samplePosts';
import { ArchitectureDiagram } from '@/src/ui/components/ArchitectureDiagram';
import { AiBadge } from '@/src/ui/components/AiBadge';
import { workflowPostFromVerify } from '@/src/build/toWorkflow';
import { saveWorkflowPost } from '@/src/workflow/store';

export default function VerifyPage() {
  const { demoDate, speedMode, role } = useApp();
  const [pack, setPack] = useState<PolicyPack | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'findings' | 'debate' | 'diff' | 'trace' | 'dataflow'>('findings');
  const [isDebateExpanded, setIsDebateExpanded] = useState(true);
  const [savedToWorkflow, setSavedToWorkflow] = useState<boolean>(false);

  // Form input state
  const [caption, setCaption] = useState<string>(SAMPLE_POSTS[0].post.caption);
  const [hashtagsStr, setHashtagsStr] = useState<string>(SAMPLE_POSTS[0].post.hashtags.join(' '));
  const [altText, setAltText] = useState<string>(SAMPLE_POSTS[0].post.altText || '');
  const [format, setFormat] = useState<'feed_4_5' | 'feed_1_1' | 'story_9_16' | 'reel_9_16'>('feed_4_5');
  const [paidPartnership, setPaidPartnership] = useState<boolean>(false);
  const [language, setLanguage] = useState<'en' | 'hinglish'>('en');

  const {
    status,
    currentStep,
    progressPercent,
    traceEvents,
    reviewerAFindings,
    reviewerBFindings,
    verifiedFindings,
    verdict,
    hallucinationsBlocked,
    fixSuggestions,
    runPipeline,
    resetPipeline,
  } = usePipeline({ demoDate, speedMode });

  // Load Policy Pack on mount
  useEffect(() => {
    fetch('/api/pack')
      .then((r) => r.json())
      .then((data: PolicyPack) => {
        setPack(data);
      })
      .catch((err) => console.error('Failed to load pack:', err));
  }, []);

  // Handle sample post selection
  const handleSelectSample = (sample: SamplePostItem) => {
    setSelectedSampleId(sample.id);
    setCaption(sample.post.caption);
    setHashtagsStr(sample.post.hashtags.join(' '));
    setAltText(sample.post.altText || '');
    setFormat(sample.post.format);
    setPaidPartnership(Boolean(sample.post.paidPartnership));
    setLanguage(sample.post.language as any || 'en');
    setSavedToWorkflow(false);
    resetPipeline();
  };

  const handleRun = () => {
    if (!pack) return;
    setSavedToWorkflow(false);
    const post: PostContent = {
      caption,
      hashtags: hashtagsStr.split(/\s+/).filter(Boolean),
      altText,
      format,
      paidPartnership,
      language,
    };
    runPipeline(post, pack);
  };

  const handleApplySafeFixes = () => {
    if (fixSuggestions?.correctedCaption) {
      setCaption(fixSuggestions.correctedCaption);
      if (fixSuggestions.correctedHashtags) {
        setHashtagsStr(fixSuggestions.correctedHashtags.join(' '));
      }
      // Re-trigger pipeline
      setTimeout(() => {
        if (!pack) return;
        const revisedPost: PostContent = {
          caption: fixSuggestions.correctedCaption!,
          hashtags: fixSuggestions.correctedHashtags || hashtagsStr.split(/\s+/).filter(Boolean),
          altText,
          format,
          paidPartnership,
          language,
        };
        runPipeline(revisedPost, pack, { pass: 'after_fix' });
      }, 100);
    }
  };

  const diffChunks = fixSuggestions?.correctedCaption
    ? diffWords(caption, fixSuggestions.correctedCaption)
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            Verify: Multi-Model Audit Pipeline
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Upload or paste social posts. Deterministic gates execute first, followed by two independent LLM reviewers (Reviewer A, Reviewer B), verbatim citation checks, and code-governed scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-600 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-400">
            Speed: <strong className="text-indigo-600 dark:text-indigo-400 uppercase">{speedMode}</strong>
          </span>
          {verdict && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full uppercase font-mono ${
                verdict.status === 'READY_FOR_HUMAN'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                  : verdict.status === 'REVISE'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800'
              }`}
            >
              {verdict.status}
            </span>
          )}
        </div>
      </div>

      {/* 12 Sample Post Quick Selector Carousel / Pills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            12 Example Inputs (Section 21)
          </span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">Click any card to load example input scenario</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {SAMPLE_POSTS.map((sample) => {
            const isSelected = selectedSampleId === sample.id;
            return (
              <button
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className={`px-3 py-2 rounded-xl text-left shrink-0 transition border text-xs flex flex-col gap-0.5 max-w-[200px] ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-bold uppercase font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-600 dark:text-slate-400'}`}>
                    Example #{sample.id}
                  </span>
                  <span
                    className={`text-[9px] px-1 rounded uppercase font-semibold ${
                      sample.expectedVerdict === 'READY_FOR_HUMAN'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : sample.expectedVerdict === 'REVISE'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {sample.expectedVerdict === 'READY_FOR_HUMAN' ? 'READY' : sample.expectedVerdict}
                  </span>
                </div>
                <div className="font-semibold truncate w-full">{sample.title.split(': ')[1]}</div>
                <div className={`text-[10px] truncate w-full ${isSelected ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}`}>
                  {sample.category}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Post Input & Parameters */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Post Input</span>
                <span className="text-[11px] font-normal text-slate-600 dark:text-slate-400">(@thriftit.in)</span>
              </h2>
              <button
                onClick={() => handleSelectSample(SAMPLE_POSTS[selectedSampleId - 1])}
                className="text-xs text-indigo-600 hover:text-indigo-400 flex items-center gap-1 font-semibold dark:text-indigo-300"
                title="Reset current sample"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Caption
              </label>
              <textarea
                rows={5}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Enter caption for review..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>

            {/* Hashtags */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Hashtags (Space separated)
              </label>
              <input
                type="text"
                value={hashtagsStr}
                onChange={(e) => setHashtagsStr(e.target.value)}
                placeholder="#ThriftIt #PreLovedFashion"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-mono"
              />
            </div>

            {/* Alt Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Alt Text (AR-001 Accessibility requirement)
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe image for screen-reader accessibility..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Format & Partnership Toggles */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 dark:text-slate-400">Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                >
                  <option value="feed_4_5">4:5 Feed Portrait</option>
                  <option value="feed_1_1">1:1 Square</option>
                  <option value="story_9_16">9:16 Story</option>
                  <option value="reel_9_16">9:16 Reel</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 dark:text-slate-400">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                >
                  <option value="en">English (India)</option>
                  <option value="hinglish">Light Hinglish</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Paid Partnership Collab Tag
              </span>
              <input
                type="checkbox"
                checked={paidPartnership}
                onChange={(e) => setPaidPartnership(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2" data-tour="verify-run">
              <button
                onClick={handleRun}
                disabled={status === 'running' || !pack}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {status === 'running' ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Evaluating Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run Verification Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Scenario Note */}
          <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-xs space-y-1">
            <span className="font-bold text-indigo-700 dark:text-indigo-400">
              Scenario #{selectedSampleId}:
            </span>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {SAMPLE_POSTS[selectedSampleId - 1].description}
            </p>
          </div>
        </div>

        {/* Right Column (7 Cols): Stepper, Verdict, Tabs (Findings, Debate, Diff, Data-Flow) */}
        <div className="lg:col-span-7 space-y-5">
          <details className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" open>
            <summary className="cursor-pointer text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Architecture — the active step lights up during a live run</summary>
            <div className="mt-3"><ArchitectureDiagram activeStep={status === 'running' ? currentStep : null} title="Live verification pipeline" /></div>
          </details>
          {/* Live Pipeline Stepper */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Pipeline State Machine</span>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300">{currentStep || 'Idle'}</span>
            </div>

            {/* Stepper Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stepper Nodes */}
            <div className="grid grid-cols-5 text-center text-[10px] font-mono text-slate-600 dark:text-slate-400">
              <div className={progressPercent >= 15 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>1. Ingest</div>
              <div className={progressPercent >= 40 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>2. Gates</div>
              <div className={progressPercent >= 60 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>3. Review</div>
              <div className={progressPercent >= 75 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>4. Verify</div>
              <div className={progressPercent >= 100 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''}>5. Verdict</div>
            </div>
          </div>

          {/* Verdict Score Card */}
          {verdict ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Brand Compliance Score</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">
                      {verdict.score}
                    </span>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">/ 100</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Hallucinations Blocked Badge */}
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <div className="text-[9px] uppercase font-bold text-indigo-400">Hallucinations Blocked</div>
                      <div className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300">
                        {hallucinationsBlocked} Discarded
                      </div>
                    </div>
                  </div>

                  {/* Verdict Status */}
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                      verdict.status === 'READY_FOR_HUMAN'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : verdict.status === 'REVISE'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        : 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {verdict.status === 'READY_FOR_HUMAN' && <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />}
                    {verdict.status === 'REVISE' && <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300" />}
                    {verdict.status === 'BLOCKED' && <XCircle className="w-5 h-5 text-red-700 dark:text-red-300" />}
                    <span>{verdict.status}</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!pack || !verdict) return;
                      const wfPost = workflowPostFromVerify({
                        post: { caption, hashtags: hashtagsStr.split(/\s+/).filter(Boolean), altText, format, paidPartnership, language },
                        verdict,
                        findings: verifiedFindings,
                        packHash: pack.hash,
                        role,
                        title: caption.slice(0, 50) || `Verified Post #${selectedSampleId}`,
                      });
                      await saveWorkflowPost(wfPost);
                      setSavedToWorkflow(true);
                    }}
                    disabled={savedToWorkflow}
                    className="text-xs px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 transition shadow disabled:opacity-60 shrink-0"
                  >
                    {savedToWorkflow ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Saved to Workflow</span>
                      </>
                    ) : (
                      <span>Send to Workflow</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Warnings / Needs-Human Notices */}
              {verdict.needsHuman.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Requires Human Sign-off glance:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {verdict.needsHuman.map((nh, idx) => (
                      <li key={idx}>{nh}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
              Click &quot;Run Verification Pipeline&quot; to inspect this post against deterministic gates and multi-model reviews.
            </div>
          )}

          {/* Results Tabs & Detail Container */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* Tab Bar */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setActiveTab('findings')}
                className={`py-2 px-3 border-b-2 transition ${
                  activeTab === 'findings'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                Verified Findings ({verifiedFindings.length})
              </button>
              <button
                onClick={() => setActiveTab('debate')}
                className={`py-2 px-3 border-b-2 transition ${
                  activeTab === 'debate'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                2-Model Debate ({reviewerAFindings.length + reviewerBFindings.length})
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`py-2 px-3 border-b-2 transition ${
                  activeTab === 'diff'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                Fix Suggestions {fixSuggestions ? '✨' : ''}
              </button>
              <button
                onClick={() => setActiveTab('dataflow')}
                className={`py-2 px-3 border-b-2 transition ${
                  activeTab === 'dataflow'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                Data-Flow &amp; Routing
              </button>
              <button
                onClick={() => setActiveTab('trace')}
                className={`py-2 px-3 border-b-2 transition ${
                  activeTab === 'trace'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-600 hover:text-slate-800 dark:hover:text-slate-200 dark:text-slate-400'
                }`}
              >
                Live Trace ({traceEvents.length})
              </button>
            </div>

            {/* TAB 1: Verified Findings */}
            {activeTab === 'findings' && (
              <div className="p-5 space-y-3">
                {verifiedFindings.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-700 mx-auto mb-2 opacity-80 dark:text-emerald-300" />
                    <span>No policy violations detected. Content is compliant with brand guidelines.</span>
                  </div>
                ) : (
                  verifiedFindings.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono uppercase font-bold text-[10px] ${
                              f.severity === 'critical'
                                ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                : f.severity === 'major'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {f.severity}
                          </span>
                          <span className="font-semibold text-slate-600 uppercase text-[10px] dark:text-slate-400">
                            {f.category}
                          </span>
                          <span className="font-mono text-slate-600 text-[10px] dark:text-slate-400">&bull; {f.source}</span>
                        </div>

                        {/* Clickable link directly to policy clause in Company KB */}
                        <Link
                          href={`/company#${f.clauseId}`}
                          className="flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>[{f.clauseId}]</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      {/* Explanation */}
                      <p className="text-slate-700 dark:text-slate-200 font-medium">{f.explanation}</p>

                      {/* Verbatim Quotes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="text-[9px] uppercase font-bold text-slate-600 block dark:text-slate-400">Post Quote ({f.postField}):</span>
                          <span className="text-red-600 dark:text-red-400">&quot;{f.postQuote}&quot;</span>
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="text-[9px] uppercase font-bold text-slate-600 block dark:text-slate-400">Clause Quote:</span>
                          <span className="text-emerald-700 dark:text-emerald-400">&quot;{f.clauseQuote}&quot;</span>
                        </div>
                      </div>

                      {f.suggestedFix && (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 pt-1">
                          <strong>Suggested fix:</strong> &quot;{f.suggestedFix}&quot;
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: 2-Model Debate Transcript */}
            {activeTab === 'debate' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Parallel Reviewers: Reviewer A (GROQ_MODEL) vs Reviewer B (NVIDIA_MODEL)
                  </div>
                  <button
                    onClick={() => setIsDebateExpanded(!isDebateExpanded)}
                    className="text-xs text-indigo-600 flex items-center gap-1 dark:text-indigo-300"
                  >
                    <span>{isDebateExpanded ? 'Collapse' : 'Expand'}</span>
                    {isDebateExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isDebateExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Reviewer A Column */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-700 dark:text-sky-400">Reviewer A (GROQ_MODEL)</span>
                        <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">{reviewerAFindings.length} findings</span>
                      </div>
                      {reviewerAFindings.length === 0 ? (
                        <p className="text-slate-600 text-[11px] italic dark:text-slate-400">No soft violations detected by Reviewer A.</p>
                      ) : (
                        reviewerAFindings.map((f, i) => (
                          <div key={i} className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="flex justify-between font-mono text-[10px]">
                              <span className="font-bold text-slate-600 dark:text-slate-400">[{f.clauseId}]</span>
                              <span className="uppercase text-amber-700 dark:text-amber-300">{f.severity}</span>
                            </div>
                            <div className="font-medium">{f.explanation}</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate dark:text-slate-400">&quot;{f.postQuote}&quot;</div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reviewer B Column */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">Reviewer B (NVIDIA)</span>
                        <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">{reviewerBFindings.length} findings</span>
                      </div>
                      {reviewerBFindings.length === 0 ? (
                        <p className="text-slate-600 text-[11px] italic dark:text-slate-400">No soft violations detected by Reviewer B.</p>
                      ) : (
                        reviewerBFindings.map((f, i) => (
                          <div key={i} className="p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="flex justify-between font-mono text-[10px]">
                              <span className="font-bold text-slate-600 dark:text-slate-400">[{f.clauseId}]</span>
                              <span className="uppercase text-amber-700 dark:text-amber-300">{f.severity}</span>
                            </div>
                            <div className="font-medium">{f.explanation}</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate dark:text-slate-400">&quot;{f.postQuote}&quot;</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Surgical Diff & Safe AutoFix */}
            {activeTab === 'diff' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Surgical Fix Suggestions <AiBadge what="AI-suggested" />
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">Minimal edits preserving creator purpose &amp; voice</p>
                  </div>

                  {fixSuggestions?.correctedCaption && (
                    <button
                      onClick={handleApplySafeFixes}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Apply Safe Fixes &amp; Re-verify</span>
                    </button>
                  )}
                </div>

                {fixSuggestions?.correctedCaption ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono leading-relaxed">
                      {diffChunks.map((part, index) => {
                        const color = part.added
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1 rounded'
                          : part.removed
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 line-through px-1 rounded'
                          : 'text-slate-700 dark:text-slate-300';
                        return (
                          <span key={index} className={color}>
                            {part.value}
                          </span>
                        );
                      })}
                    </div>
                    {fixSuggestions.diffSummary && (
                      <p className="text-xs text-slate-600 italic dark:text-slate-400">
                        {fixSuggestions.diffSummary}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    No active fix suggestions. Post is either compliant or awaiting pipeline evaluation.
                  </p>
                )}
              </div>
            )}

            {/* TAB 4: Data-Flow & Routing Map */}
            {activeTab === 'dataflow' && (
              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Minimum Necessary Disclosure Routing</span>
                  <span className="font-mono text-slate-600 text-[10px] dark:text-slate-400">Zero Unnecessary Clause Leakage</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                        <th className="py-2">Category</th>
                        <th className="py-2">Document Prefix</th>
                        <th className="py-2">Sent To Provider</th>
                        <th className="py-2">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold dark:text-indigo-300">tone</td>
                        <td className="py-2">BV</td>
                        <td className="py-2">Reviewer A / Reviewer B</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Persona &amp; conversational style</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold dark:text-indigo-300">terminology</td>
                        <td className="py-2">TM</td>
                        <td className="py-2">Reviewer A / Reviewer B</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Approved vocabulary &amp; slang</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold dark:text-indigo-300">messaging</td>
                        <td className="py-2">BV, SR</td>
                        <td className="py-2">Reviewer A / Reviewer B</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Tone &amp; social constraints</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold dark:text-indigo-300">claims</td>
                        <td className="py-2">CL, AF</td>
                        <td className="py-2">Reviewer A / Reviewer B</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Substantiation &amp; greenwashing</td>
                      </tr>
                      <tr>
                        <td className="py-2 text-indigo-600 font-bold dark:text-indigo-300">security</td>
                        <td className="py-2">EM</td>
                        <td className="py-2 font-bold text-red-700 dark:text-red-300">None (Pure Code)</td>
                        <td className="py-2 text-slate-600 dark:text-slate-400">Hard deterministic gate blocks injection</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: Live Trace Stepper Events */}
            {activeTab === 'trace' && (
              <div className="p-5 space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
                {traceEvents.length === 0 ? (
                  <p className="text-slate-600 dark:text-slate-400">No trace events recorded yet.</p>
                ) : (
                  traceEvents.map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex items-start justify-between gap-3"
                    >
                      <div>
                        <span className="font-bold text-indigo-600 mr-2 dark:text-indigo-300">[{t.step}]</span>
                        <span className="text-slate-700 dark:text-slate-300">{t.message}</span>
                      </div>
                      <span className="text-[10px] text-slate-600 shrink-0 dark:text-slate-400">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
