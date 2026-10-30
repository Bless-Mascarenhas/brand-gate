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
import { DraftSelectionSummary, ImagePromptSpec, ImagePromptSpecSchema } from '@/src/llm/schemas';

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
  draftSelection?: DraftSelectionSummary;
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
  imagePrompt: ImagePromptSpec;
  iterations: IterationResult[];
  verdict: Verdict;
  findings: Finding[];
  converged: boolean;
  draftSelection?: DraftSelectionSummary;
  generationWarning?: string;
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
  let bestIteration: IterationResult | null = null;
  let bestMarketingScript = '';
  let bestImagePrompt: ImagePromptSpec = { prompt: '', negativePrompt: '' };
  let currentPost: PostContent | null = null;
  let originalPurpose: Purpose | null = null;
  let marketingScript = '';
  let imagePrompt: ImagePromptSpec = { prompt: '', negativePrompt: '' };
  let generationWarning: string | undefined;
  let lastScore = 0;
  let previousFindingsCount = 0;
  let feedbackList: string[] = [];

  for (let iter = 1; iter <= maxIterations; iter++) {
    // 1. Call generator endpoint
    const accessCode =
      (typeof window !== 'undefined' && localStorage.getItem('bg_access_code')) || '';

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
        festival: festival || undefined,
        iteration: iter,
        previousFindings: feedbackList,
        originalPurpose: originalPurpose || undefined,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (iterations.length > 0) {
        generationWarning = errJson.error || `A later draft iteration failed with status ${res.status}; keeping the last successful draft.`;
        break;
      }
      throw new Error(errJson.error || `Generator failed with status ${res.status}`);
    }

    const data = (await res.json().catch(() => null)) as { draft?: any; selection?: DraftSelectionSummary } | null;
    if (!data?.draft) {
      if (iterations.length > 0) {
        generationWarning = 'A later draft response was incomplete; keeping the last successful draft.';
        break;
      }
      throw new Error('The draft provider returned an incomplete response. Please retry.');
    }
    const draft = data.draft;
    marketingScript = draft.marketingScript || marketingScript;
    const parsedImagePrompt = ImagePromptSpecSchema.safeParse(draft.imagePrompt);
    if (!parsedImagePrompt.success) {
      if (iterations.length > 0) {
        generationWarning = 'A later draft returned an invalid image prompt; keeping the last successful draft.';
        break;
      }
      throw new Error('The model returned an invalid image prompt. Please try again.');
    }
    imagePrompt = parsedImagePrompt.data;

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
      draftSelection: data.selection,
    };

    iterations.push(iterResult);
    if (!bestIteration || iterResult.score > bestIteration.score) {
      bestIteration = iterResult;
      bestMarketingScript = marketingScript;
      bestImagePrompt = imagePrompt;
    }
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

  const lastIter = bestIteration || iterations[iterations.length - 1];

  return {
    initialDraft: iterations[0].post,
    governedPost: lastIter.post,
    purpose: originalPurpose || {
      summary: prompt,
      requiredElements: [],
    },
    marketingScript: bestMarketingScript,
    imagePrompt: bestImagePrompt,
    iterations,
    verdict: lastIter.verdict,
    findings: lastIter.findings,
    converged: lastIter.verdict.status === 'READY_FOR_HUMAN',
    draftSelection: lastIter.draftSelection,
    generationWarning,
  };
}
