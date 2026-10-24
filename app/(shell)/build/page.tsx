'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Download,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ShieldCheck,
  Mic,
  Sliders,
  Layers,
  Check,
} from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';
import { compositeBrandPost } from '@/src/canvas/composite';
import { runGovernanceLoop, IterationResult, GovernanceLoopOutput } from '@/src/build/governanceLoop';
import { PolicyPack } from '@/src/types';
import { storage } from '@/src/storage';
import { saveWorkflowPost } from '@/src/workflow/store';
import { appendInsightEvents } from '@/src/insights/store';
import { workflowPostFromBuild, checkEventsFromBuild } from '@/src/build/toWorkflow';

const InstagramIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  output?: GovernanceLoopOutput;
}

export default function BuildPage() {
  const { role, demoDate } = useApp();

  // State
  const [pack, setPack] = useState<PolicyPack | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [language, setLanguage] = useState<'en' | 'hinglish'>('en');
  const [format, setFormat] = useState<'feed_4_5' | 'feed_1_1' | 'story_9_16'>('feed_4_5');
  const [festival, setFestival] = useState<string>('Diwali');
  const [showTrace, setShowTrace] = useState(false);

  // Execution state
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepText, setActiveStepText] = useState('');
  const [currentIterations, setCurrentIterations] = useState<IterationResult[]>([]);
  const [currentOutput, setCurrentOutput] = useState<GovernanceLoopOutput | null>(null);
  const [compositedImage, setCompositedImage] = useState<string | null>(null);

  // Review & Workflow state
  const [approvedPost, setApprovedPost] = useState<GovernanceLoopOutput | null>(null);
  const [isMockPublishOpen, setIsMockPublishOpen] = useState(false);
  const [isChangeRequestOpen, setIsChangeRequestOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('Tone');
  const [changeFeedback, setChangeFeedback] = useState('');
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // UI helpers
  const [expandedIterations, setExpandedIterations] = useState<Record<number, boolean>>({});
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Load policy pack on mount
  useEffect(() => {
    fetch('/api/pack')
      .then((res) => res.json())
      .then((data) => setPack(data))
      .catch((err) => console.error('Failed to load policy pack:', err));
  }, []);

  const quickPrompts = [
    {
      title: 'Diwali Teaser',
      text: 'Diwali Thrift Fest teaser for Mumbai college students. Up to 30% off vintage pieces at our Bandra pop-up.',
      festival: 'Diwali',
    },
    {
      title: 'Hinglish Pop-up',
      text: 'Weekend pop-up reminder in Hinglish for Bandra vintage lovers. Hand-inspected tees and jackets dropping this Friday.',
      language: 'hinglish' as const,
    },
    {
      title: 'Tier-2 Denim Drop',
      text: 'Curated 90s vintage denim jackets drop starting at ₹599. Free shipping above ₹999 for college shoppers.',
      language: 'en' as const,
    },
  ];

  const handleQuickPrompt = (qp: (typeof quickPrompts)[0]) => {
    setInputPrompt(qp.text);
    if (qp.language) setLanguage(qp.language);
    if (qp.festival) setFestival(qp.festival);
  };

  const handleGenerate = async (customPrompt?: string) => {
    const promptToRun = customPrompt || inputPrompt;
    if (!promptToRun.trim() || !pack || isGenerating) return;

    setIsGenerating(true);
    setCurrentIterations([]);
    setCurrentOutput(null);
    setCompositedImage(null);
    setApprovedPost(null);
    setIsChangeRequestOpen(false);
    setIsOverrideOpen(false);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: promptToRun,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');

    try {
      setActiveStepText('1. Drafting post with routed policies & active facts...');

      // 1. Run Automated Governance Loop
      const loopResult = await runGovernanceLoop({
        prompt: promptToRun,
        language,
        format,
        festival: festival !== 'None' ? festival : undefined,
        pack,
        demoDate,
        maxIterations: 3,
        onIteration: (iter) => {
          setCurrentIterations((prev) => [...prev, iter]);
          setActiveStepText(`Governing iteration ${iter.iteration}: Score ${iter.score}/100...`);
        },
      });

      setCurrentOutput(loopResult);

      // Save into Workflow (revision per iteration) and record the run for Insights.
      try {
        await saveWorkflowPost(workflowPostFromBuild(loopResult, { packHash: pack.hash, role, title: promptToRun.slice(0, 60) }));
        await appendInsightEvents(checkEventsFromBuild(loopResult, pack.rules.map((r) => r.clause), role));
      } catch (e: any) {
        console.warn('Failed to save build run to workflow/insights:', e.message);
      }

      // 2. Generate Base Image via Gemini Image endpoint
      setActiveStepText('2. Generating editorial imagery with Gemini Image model...');
      const accessCode =
        (typeof window !== 'undefined' && localStorage.getItem('bg_access_code')) || 'brandgate2026';

      const imageRes = await fetch('/api/llm/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-access-code': accessCode,
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          prompt: loopResult.imagePrompt || 'Vintage clothing in natural daylight Bandra studio',
          format,
          festival: festival !== 'None' ? festival : undefined,
        }),
      });

      const imageData = await imageRes.json();
      const rawImage = imageData.imageDataUrl;

      // 3. Client-Side HTML Canvas Compositing (strictly client-side)
      setActiveStepText('3. Client-side canvas compositing of official wordmark & offer bands...');
      const offerBannerText =
        festival === 'Diwali'
          ? 'DIWALI THRIFT FEST • UP TO 30% OFF • BANDRA POP-UP'
          : loopResult.purpose?.offer
            ? `${loopResult.purpose.offer.toUpperCase()} • BANDRA POP-UP`
            : 'CURATED PRE-LOVED CLOTHING • BANDRA, MUMBAI';

      const finalComposited = await compositeBrandPost({
        baseImageSrc: rawImage,
        format,
        offerText: offerBannerText,
        wordmarkBandColor: 'paper',
        showOfferBand: true,
      });

      setCompositedImage(finalComposited);

      // Save to IndexedDB
      await storage.setItem(`draft_${Date.now()}`, {
        post: loopResult.governedPost,
        compositedImage: finalComposited,
        purpose: loopResult.purpose,
        iterations: loopResult.iterations,
        verdict: loopResult.verdict,
        timestamp: Date.now(),
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: `Draft post generated and verified across ${loopResult.iterations.length} iteration(s). Compliance score: ${loopResult.verdict.score}/100 (${loopResult.verdict.status}).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        output: loopResult,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Generation failed:', err);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: `Error during generation: ${err.message || 'Unknown error'}. Please check API access code or try a quick prompt.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsGenerating(false);
      setActiveStepText('');
    }
  };

  const handleApprove = () => {
    if (!currentOutput) return;
    setApprovedPost(currentOutput);
  };

  const handleRequestChangesSubmit = () => {
    if (!currentOutput) return;
    const feedback = `[Human Change Request - Reason: ${changeReason}] ${changeFeedback}`;
    void appendInsightEvents([
      {
        kind: 'human_rejection', id: `build-rej-${Date.now()}`, ts: new Date().toISOString(), sample: false, role,
        clauseIds: Array.from(new Set(currentOutput.findings.map((f) => f.clauseId))),
        reason: `${changeReason}: ${changeFeedback || '(no detail)'}`,
      },
    ]).catch(() => undefined);
    handleGenerate(feedback);
  };

  const handleApproveAnyway = () => {
    if (!currentOutput) return;
    setOverrideError(null);

    // Rule EM-000: Critical findings require Manager role
    const hasCritical = currentOutput.findings.some((f) => f.severity === 'critical');
    if (hasCritical && role !== 'manager') {
      setOverrideError('Manager role required to override critical violations per Escalation Matrix [EM-000].');
      return;
    }

    if (!overrideJustification.trim()) {
      setOverrideError('A written justification is required to approve with active findings.');
      return;
    }

    // Approved with logged override
    void appendInsightEvents([
      {
        kind: 'human_override', id: `build-ovr-${Date.now()}`, ts: new Date().toISOString(), sample: false, role,
        clauseIds: Array.from(new Set(currentOutput.findings.map((f) => f.clauseId))),
        reason: overrideJustification.trim(),
      },
    ]).catch(() => undefined);
    setApprovedPost(currentOutput);
    setIsOverrideOpen(false);
  };

  const toggleIterationExpand = (idx: number) => {
    setExpandedIterations((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text: string, type: 'caption' | 'script') => {
    navigator.clipboard.writeText(text);
    if (type === 'caption') {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Build: Governed Content Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Brief &rarr; Draft &rarr; Gemini Imagen &rarr; Canvas Wordmark Compositing &rarr; Self-Governing Loop
          </p>
        </div>

        {/* Studio Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-indigo-500" />
            <span>Format:</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-800 text-xs px-2 py-1 rounded-md border-0 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="feed_4_5">4:5 Feed (1080&times;1350)</option>
              <option value="feed_1_1">1:1 Square (1080&times;1080)</option>
              <option value="story_9_16">9:16 Story (1080&times;1920)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
            <span>Lang:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-slate-100 dark:bg-slate-800 text-xs px-2 py-1 rounded-md border-0 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="en">English</option>
              <option value="hinglish">Light Hinglish</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
            <span>Festival:</span>
            <select
              value={festival}
              onChange={(e) => setFestival(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-xs px-2 py-1 rounded-md border-0 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="Diwali">Diwali (Active)</option>
              <option value="Eid al-Fitr">Eid al-Fitr</option>
              <option value="Christmas">Christmas</option>
              <option value="Holi">Holi</option>
              <option value="None">None</option>
            </select>
          </div>

          <button
            onClick={() => setShowTrace(!showTrace)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
              showTrace
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Trace</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Chat Conversation & Prompt Composer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[700px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Gemini Content Creator</h3>
                  <p className="text-[10px] text-slate-400">Grounded in 8 Thrift-It policies &amp; active facts</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Auto-Governing Loop
              </span>
            </div>

            {/* Quick Prompt Chips */}
            <div className="mb-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Briefs</span>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickPrompt(qp)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    {qp.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 p-6">
                  <Sparkles className="w-8 h-8 text-indigo-400 opacity-60" />
                  <p className="text-xs font-medium">Type a creative brief or click a quick prompt above.</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Brand Gate will draft your post, generate editorial imagery, composite official logos, and run an automated 3-iteration governance check.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] p-3 rounded-2xl ${
                        m.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200/60 dark:border-slate-700/60'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                  </div>
                ))
              )}

              {isGenerating && (
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2 animate-pulse">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>{activeStepText || 'Processing pipeline...'}</span>
                  </div>
                  <div className="w-full bg-indigo-200 dark:bg-indigo-900/60 h-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full w-2/3 animate-[pulse_1s_infinite]"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Composer Input */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGenerate();
                }}
                className="relative"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="e.g. Diwali teaser for Mumbai college students with up to 30% off..."
                  disabled={isGenerating}
                  className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isGenerating}
                  className="absolute right-1.5 top-1.5 p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Column: Live Studio Review & Human Approval (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Iteration Progress Cards */}
          {currentIterations.length > 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Self-Governance Progression
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {currentIterations.length} Iteration(s) run
                </span>
              </div>

              <div className="space-y-2">
                {currentIterations.map((iter) => (
                  <div
                    key={iter.iteration}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2"
                  >
                    <div
                      onClick={() => toggleIterationExpand(iter.iteration)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-black text-[11px] px-2 py-0.5 rounded-full ${
                            iter.verdict.status === 'READY_FOR_HUMAN'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          Iter {iter.iteration}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {iter.summary}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Score: {iter.score}/100
                        </span>
                        {expandedIterations[iter.iteration] ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {expandedIterations[iter.iteration] && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <p>
                          <strong>Post Caption:</strong> {iter.post.caption}
                        </p>
                        <p>
                          <strong>Hashtags:</strong> {iter.post.hashtags.join(' ')}
                        </p>
                        {iter.findings.length > 0 && (
                          <div className="space-y-1 mt-2">
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              Issues Handled:
                            </span>
                            {iter.findings.map((f, i) => (
                              <div key={i} className="pl-2 border-l-2 border-amber-400">
                                <Link
                                  href={`/company#${f.clauseId}`}
                                  className="font-bold hover:underline"
                                >
                                  [{f.clauseId}]
                                </Link>{' '}
                                {f.explanation}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Governed Draft Presentation Card */}
          {currentOutput ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <InstagramIcon className="w-5 h-5 text-pink-500" />
                    Human Review: Instagram Draft
                  </h2>
                  <p className="text-xs text-slate-400">
                    Governed preview with client-side composited brand assets
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                    <span>Score:</span>
                    <span
                      className={
                        currentOutput.verdict.score >= 90
                          ? 'text-emerald-500'
                          : 'text-amber-500'
                      }
                    >
                      {currentOutput.verdict.score}/100
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-black rounded-lg ${
                      currentOutput.verdict.status === 'READY_FOR_HUMAN'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    {currentOutput.verdict.status}
                  </span>
                </div>
              </div>

              {/* Instagram Card Mock */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left: Composited Image */}
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative shadow-sm">
                    {compositedImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={compositedImage}
                        alt={currentOutput.governedPost.altText || 'Composited Thrift-It post'}
                        className="w-full h-auto object-cover max-h-[420px]"
                      />
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                        <RotateCcw className="w-6 h-6 animate-spin mb-2" />
                        <span>Rendering canvas overlays...</span>
                      </div>
                    )}
                  </div>

                  {compositedImage && (
                    <a
                      href={compositedImage}
                      download={`thrift-it-${Date.now()}.jpg`}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Composited Creative (JPEG)
                    </a>
                  )}
                </div>

                {/* Right: Copy & Caption */}
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 font-semibold mb-1">
                      <span>Caption &amp; Hashtags</span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${currentOutput.governedPost.caption}\n\n${currentOutput.governedPost.hashtags.join(' ')}`,
                            'caption'
                          )
                        }
                        className="hover:text-indigo-500 flex items-center gap-1"
                      >
                        {copiedCaption ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedCaption ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 leading-relaxed text-slate-800 dark:text-slate-200 max-h-48 overflow-y-auto">
                      <p>{currentOutput.governedPost.caption}</p>
                      <div className="mt-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                        {currentOutput.governedPost.hashtags.join(' ')}
                      </div>
                    </div>
                  </div>

                  {/* Alt Text */}
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">
                      Accessibility Alt Text ({currentOutput.governedPost.altText?.length || 0} chars)
                    </span>
                    <p className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 italic text-[11px]">
                      &quot;{currentOutput.governedPost.altText}&quot;
                    </p>
                  </div>

                  {/* Marketing VO Script */}
                  {currentOutput.marketingScript && (
                    <div>
                      <div className="flex items-center justify-between text-slate-400 font-semibold mb-1">
                        <span className="flex items-center gap-1.5">
                          <Mic className="w-3.5 h-3.5 text-indigo-500" />
                          20-30s Spoken Script
                        </span>
                        <button
                          onClick={() => copyToClipboard(currentOutput.marketingScript, 'script')}
                          className="hover:text-indigo-500 flex items-center gap-1"
                        >
                          {copiedScript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          {copiedScript ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-700 dark:text-slate-300 leading-normal max-h-32 overflow-y-auto">
                        {currentOutput.marketingScript}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Compliance & Verification Findings */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Policy Compliance Status</span>
                  <span>
                    Hard Gates:{' '}
                    <span className="text-emerald-500">Passed (8/8)</span>
                  </span>
                </div>

                {currentOutput.findings.length > 0 ? (
                  <div className="space-y-1.5">
                    {currentOutput.findings.map((f, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/company#${f.clauseId}`}
                              className="font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
                            >
                              [{f.clauseId}]
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                              {f.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
                            {f.explanation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>All brand policies, facts, and accessibility gates verified with 0 violations.</span>
                  </div>
                )}
              </div>

              {/* Human Review Decision Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsChangeRequestOpen(!isChangeRequestOpen)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
                  >
                    Request Changes
                  </button>

                  {currentOutput.findings.length > 0 && (
                    <button
                      onClick={() => setIsOverrideOpen(!isOverrideOpen)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-all"
                    >
                      Approve Anyway (Override)
                    </button>
                  )}
                </div>

                <button
                  onClick={handleApprove}
                  className="px-6 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-4 h-4" />
                  Approve Draft
                </button>
              </div>

              {/* Request Changes Panel */}
              {isChangeRequestOpen && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Request Changes from Content Generator
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Tone', 'Wrong fact', 'Visual', 'Claim', 'Other'].map((reason) => (
                      <button
                        key={reason}
                        onClick={() => setChangeReason(reason)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                          changeReason === reason
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={changeFeedback}
                    onChange={(e) => setChangeFeedback(e.target.value)}
                    placeholder="Specific revision instructions (e.g. Tone is too preachy; ensure starting price ₹599 for denim is mentioned)..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                    rows={2}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsChangeRequestOpen(false)}
                      className="px-3 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestChangesSubmit}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      Submit Feedback &amp; Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* Override Justification Modal / Expander */}
              {isOverrideOpen && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Manager Policy Override [EM-000]</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Logged to the immutable audit trail. Critical violations require Manager role approval.
                  </p>
                  {overrideError && (
                    <div className="p-2 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold">
                      {overrideError}
                    </div>
                  )}
                  <input
                    type="text"
                    value={overrideJustification}
                    onChange={(e) => setOverrideJustification(e.target.value)}
                    placeholder="Provide mandatory business rationale for this override..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsOverrideOpen(false)}
                      className="px-3 py-1 text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApproveAnyway}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-500"
                    >
                      Confirm Logged Override
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center text-slate-400 space-y-3 h-[420px]">
              <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <div>
                <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">Studio Inactive</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Send a brief or select a quick prompt to generate, composite, and review an India-targeted post.
                </p>
              </div>
            </div>
          )}

          {/* Approved Final Card & Audit Receipt */}
          {approvedPost && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/30 dark:border-emerald-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500 text-white">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Approved Final Card &amp; Audit Receipt
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Approved by <strong className="capitalize">{role}</strong> role &bull; Pack Hash:{' '}
                      <code className="text-emerald-600 dark:text-emerald-400">
                        {pack?.hash?.slice(0, 10)}...
                      </code>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMockPublishOpen(true)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-pink-600 hover:bg-pink-500 text-white shadow-md flex items-center gap-1.5 transition-all"
                >
                  <InstagramIcon className="w-4 h-4" />
                  Publish to Instagram (Mock)
                </button>
              </div>

              {/* Receipt Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Score</span>
                  <span className="text-sm font-black text-emerald-500">
                    {approvedPost.verdict.score}/100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Iterations</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {approvedPost.iterations.length} Cycle(s)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Approver Role</span>
                  <span className="text-sm font-black capitalize text-slate-800 dark:text-slate-200">
                    {role}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Timestamp</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mock Instagram Publish Modal */}
      {isMockPublishOpen && approvedPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Instagram Header */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[2px]">
                  <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-[10px] font-black text-[#0E7C7B]">
                    TI
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    thriftit.in
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  </div>
                  <div className="text-[10px] text-slate-400">Bandra West, Mumbai</div>
                </div>
              </div>
              <button
                onClick={() => setIsMockPublishOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Simulated Photo */}
            {compositedImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={compositedImage}
                alt="Published post"
                className="w-full aspect-[4/5] object-cover"
              />
            )}

            {/* Post Metadata & Caption */}
            <div className="p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                <span className="font-bold">Liked by 1,420 others</span>
                <span className="text-[10px] text-emerald-500 font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60">
                  Brand Gate Verified
                </span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed text-[11px]">
                <strong className="mr-1">thriftit.in</strong>
                {approvedPost.governedPost.caption}
              </p>
              <div className="text-indigo-600 dark:text-indigo-400 font-semibold text-[11px]">
                {approvedPost.governedPost.hashtags.join(' ')}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setIsMockPublishOpen(false)}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              >
                Close Simulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
