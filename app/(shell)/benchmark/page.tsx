// app/(shell)/benchmark/page.tsx
'use client';

import React, { useState } from 'react';
import { seededWorkflowPosts } from '@/src/workflow/seedData';
import Link from 'next/link';

export default function BenchmarkPage() {
  const [selectedPostId, setSelectedPostId] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const post = seededWorkflowPosts.find((p) => p.id === selectedPostId);

  const runBenchmark = async () => {
    if (!post) return;
    setRunning(true);
    // Simulate async work
    await new Promise((r) => setTimeout(r, 1500));
    // Dummy performance metrics based on number of revisions
    const revCount = post.revisions?.length ?? 0;
    const score = Math.max(0, 100 - revCount * 10);
    setResult(`Benchmark score: ${score} / 100 (based on ${revCount} revisions)`);
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 p-8">
      <h1 className="text-4xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-300">
        Workflow Benchmark
      </h1>
      <div className="max-w-2xl mx-auto bg-gray-900/60 rounded-xl shadow-xl p-6 backdrop-blur-lg">
        <label className="block text-sm font-medium mb-2" htmlFor="postSelect">
          Select a post to benchmark
        </label>
        <select
          id="postSelect"
          value={selectedPostId}
          onChange={(e) => setSelectedPostId(e.target.value)}
          className="w-full p-2 bg-gray-800 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        >
          <option value="">-- Choose post --</option>
          {seededWorkflowPosts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.state})
            </option>
          ))}
        </select>
        <button
          onClick={runBenchmark}
          disabled={!selectedPostId || running}
          className="mt-4 w-full py-2 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded hover:opacity-90 transition disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run Benchmark'}
        </button>
        {result && (
          <div className="mt-4 p-4 bg-gray-800 rounded text-center text-lg font-mono">
            {result}
          </div>
        )}
        <div className="mt-6 text-center">
          <Link href="/compare" className="text-indigo-300 hover:underline">
            → Compare Revisions
          </Link>
        </div>
      </div>
    </div>
  );
}
