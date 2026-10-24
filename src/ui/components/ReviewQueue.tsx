// src/ui/components/ReviewQueue.tsx
/**
 * ReviewQueue – displays all workflow posts, computes allowed transitions
 * based on the current user's role, performs state changes and records audit
 * logs. Designed for the Phase 7 "Workflow & Review Queue" page.
 */
import React, { useState } from 'react';
import { Role } from '@/src/types';
import { WorkflowPost, PostState } from '@/src/workflow/types';
import { seededWorkflowPosts } from '@/src/workflow/seedData';
import { canTransition, transitionState, getTransitionMatrix } from '@/src/workflow/permissions';
import { addAuditLog } from '@/src/workflow/audit';
import { useApp } from '@/src/ui/context/AppContext';
import Link from 'next/link';

export default function ReviewQueue() {
  const { role } = useApp();
  // For the demo, derive a stable display name from the active role
  const userId = `${role}-demo`;
  const [posts, setPosts] = useState<WorkflowPost[]>(seededWorkflowPosts);

  const allowedNextStates = (post: WorkflowPost): PostState[] => {
    const matrix = getTransitionMatrix();
    const candidates = matrix[post.state] ?? {};
    return (Object.keys(candidates) as PostState[]).filter((next) => {
      const res = canTransition(post.state, next, role as Role, post);
      return res.allowed;
    });
  };

  const handleTransition = (postId: string, next: PostState) => {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === postId);
      if (idx === -1) return prev;
      const post = prev[idx];
      try {
        const updated = transitionState(post, next, role as Role);
        const withLog = addAuditLog(updated, {
          user: userId ?? 'unknown',
          role: role as Role,
          action: `Transition ${post.state} → ${next}`,
          beforeState: post.state,
          afterState: next,
          details: `Performed by ${role} (demo)`,
          packHash: 'seeded-pack',
        });
        const newPosts = [...prev];
        newPosts[idx] = withLog;
        return newPosts;
      } catch (e) {
        console.error(e);
        return prev;
      }
    });
  };

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-slate-800 dark:text-white">{post.title}</h3>
            <span className="text-sm px-2 py-0.5 rounded uppercase font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
              {post.state}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Author: {post.author} | Role: {post.assignedRole ?? '—'}
          </p>
          <div className="flex flex-wrap gap-2">
            {allowedNextStates(post).map((next) => (
              <button
                key={next}
                onClick={() => handleTransition(post.id, next)}
                className="px-3 py-1 text-sm font-medium rounded bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 transition"
              >
                {post.state === 'draft' && next === 'in_review' && 'Submit for Review'}
                {post.state === 'in_review' && next === 'approved' && 'Approve'}
                {post.state === 'in_review' && next === 'changes_requested' && 'Request Changes'}
                {post.state === 'changes_requested' && next === 'draft' && 'Resubmit Draft'}
                {post.state === 'changes_requested' && next === 'in_review' && 'Resubmit for Review'}
                {post.state === 'approved' && next === 'published_mock' && 'Publish Mock'}
                {post.state === 'approved' && next === 'in_review' && 'Rollback to Review'}
                {post.state === 'in_review' && next === 'draft' && 'Revert to Draft'}
              </button>
            ))}
            <Link href={`/compare?postId=${post.id}`} className="px-3 py-1 text-sm font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:opacity-90 transition">
              Compare
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
