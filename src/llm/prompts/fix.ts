import { Finding, PostContent } from '@/src/types';

export function buildFixPrompt(post: PostContent, findings: Finding[]): { system: string; user: string } {
  const issuesList = findings.map((f, i) => {
    return `${i + 1}. [${f.clauseId}] Violation in ${f.postField}: "${f.postQuote}"
Reason: ${f.explanation}`;
  }).join('\n');

  const system = `You are an expert editorial copy doctor for Thrift-It.
Your job is to provide minimal, surgical edits to fix identified brand guideline violations while 100% preserving the creator's voice, humor, and purpose.

RULES:
1. Make the smallest necessary change.
2. Never alter parts of the text that are already compliant.
3. Return the complete corrected caption and hashtags.

RESPONSE FORMAT:
{
  "correctedCaption": string,
  "correctedHashtags": string[],
  "diffSummary": string
}`;

  const user = `Original Post:
Caption: "${post.caption}"
Hashtags: ${JSON.stringify(post.hashtags)}

Issues to fix:
${issuesList}

Provide the minimally corrected post.`;

  return { system, user };
}
