import {
  PostContent,
  PolicyPack,
  Purpose,
  Verdict,
  Finding,
} from '@/src/types';
import { evaluatePost } from '@/src/rules/engine';
import { verifyCitations } from '@/src/verify/citationVerifier';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { verifyIntentPreservation } from '@/src/verify/intent';

export interface IterationResult {
  iteration: number;
  post: PostContent;
  score: number;
  verdict: Verdict;
  findings: Finding[];
  intentScore: number;
  intentPreserved: boolean;
  fixedIssuesCount: number;
  summary: string;
}

export interface GovernanceLoopInput {
  prompt: string;
  language?: 'en' | 'hinglish';
  format?: 'feed_4_5' | 'feed_1_1' | 'story_9_16' | 'reel_9_16';
  festival?: string;
  pack: PolicyPack;
  demoDate?: string;
  maxIterations?: number;
  onIteration?: (iter: IterationResult) => void;
}

export interface GovernanceLoopOutput {
  initialDraft: PostContent;
  governedPost: PostContent;
  purpose: Purpose;
  marketingScript: string;
  imagePrompt: string;
  iterations: IterationResult[];
  verdict: Verdict;
  findings: Finding[];
  converged: boolean;
}

/**
 * Runs the automated governance loop (up to maxIterations = 3) on a draft.
 * If verdict is not READY_FOR_HUMAN, feeds verified findings and original purpose back to generator
 * until score converges or reaches READY_FOR_HUMAN.
 */
export async function runGovernanceLoop(input: GovernanceLoopInput): Promise<GovernanceLoopOutput> {
  const {
    prompt,
    language = 'en',
    format = 'feed_4_5',
    festival,
    pack,
    demoDate = '2026-10-24',
    maxIterations = 3,
    onIteration,
  } = input;

  const iterations: IterationResult[] = [];
  let currentPost: PostContent | null = null;
  let originalPurpose: Purpose | null = null;
  let marketingScript = '';
  let imagePrompt = '';
  let lastScore = 0;
  let previousFindingsCount = 0;
  let feedbackList: string[] = [];

  for (let iter = 1; iter <= maxIterations; iter++) {
    // 1. Call generator endpoint
    const accessCode =
      (typeof window !== 'undefined' && localStorage.getItem('bg_access_code')) || 'brandgate2026';

    const res: Response = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-access-code': accessCode,
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        prompt,
        language,
        format,
        festival,
        iteration: iter,
        previousFindings: feedbackList,
        originalPurpose,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Generator failed with status ${res.status}`);
    }

    const data = (await res.json()) as { draft: any };
    const draft = data.draft;
    marketingScript = draft.marketingScript || marketingScript;
    imagePrompt = draft.imagePrompt || imagePrompt;

    if (!originalPurpose) {
      originalPurpose = draft.purpose || {
        summary: prompt,
        audience: 'Indian Gen-Z & young millennials',
        requiredElements: ['Thrift-It'],
      };
    }
    const safePurpose: Purpose = originalPurpose!;

    currentPost = {
      caption: draft.caption || '',
      hashtags: draft.hashtags || ['#ThriftIt'],
      altText: draft.altText || 'Curated pre-loved clothing item from Thrift-It Bandra.',
      format,
      language,
    };

    // 2. Run deterministic gates
    const gateResult = evaluatePost(currentPost, pack, demoDate);

    // 3. Verify citations
    const verification = verifyCitations(gateResult.findings, pack, currentPost);

    // 4. Compute score & verdict
    const scoreResult = computeScoreAndVerdict(
      verification.verifiedFindings,
      gateResult.gatesFailed,
      verification.hallucinationsBlocked
    );

    // 5. Evaluate intent preservation against original purpose
    const intentRes = verifyIntentPreservation(safePurpose, currentPost.caption);

    const fixedIssuesCount = iter === 1 ? 0 : Math.max(0, previousFindingsCount - verification.verifiedFindings.length);
    const summary =
      iter === 1
        ? `Iteration 1: initial score ${scoreResult.score}/100 (${scoreResult.verdict.status}), ${verification.verifiedFindings.length} issue(s) flagged.`
        : `Iteration ${iter}: fixed ${fixedIssuesCount} issue(s), score ${lastScore} → ${scoreResult.score}, intent preserved ${intentRes.preservationScore}/5.`;

    const iterResult: IterationResult = {
      iteration: iter,
      post: currentPost,
      score: scoreResult.score,
      verdict: scoreResult.verdict,
      findings: verification.verifiedFindings,
      intentScore: intentRes.preservationScore,
      intentPreserved: intentRes.requiredElementsPreserved,
      fixedIssuesCount,
      summary,
    };

    iterations.push(iterResult);
    if (onIteration) onIteration(iterResult);

    // Stop condition: clean post reaching READY_FOR_HUMAN
    if (scoreResult.verdict.status === 'READY_FOR_HUMAN') {
      break;
    }

    // Stop condition: score did not improve after iteration 2
    if (iter > 1 && scoreResult.score <= lastScore) {
      break;
    }

    // Prepare feedback for next iteration
    lastScore = scoreResult.score;
    previousFindingsCount = verification.verifiedFindings.length;
    feedbackList = verification.verifiedFindings.map((f, i) => {
      const fix = f.suggestedFix ? ` (Suggested fix: ${f.suggestedFix})` : '';
      return `${i + 1}. [${f.clauseId}] In ${f.postField}: "${f.postQuote}" — ${f.explanation}${fix}`;
    });
  }

  const lastIter = iterations[iterations.length - 1];

  return {
    initialDraft: iterations[0].post,
    governedPost: lastIter.post,
    purpose: originalPurpose || {
      summary: prompt,
      requiredElements: [],
    },
    marketingScript,
    imagePrompt,
    iterations,
    verdict: lastIter.verdict,
    findings: lastIter.findings,
    converged: lastIter.verdict.status === 'READY_FOR_HUMAN',
  };
}
