import { Clause, FactEntry } from '@/src/types';

export interface GeneratorPromptParams {
  userPrompt: string;
  routedClauses: Clause[];
  activeFacts: FactEntry[];
  language?: 'en' | 'hinglish';
  format?: 'feed_4_5' | 'feed_1_1' | 'story_9_16';
  festival?: string;
  iteration?: number;
  previousFindings?: string[];
  originalPurpose?: any;
}

export function buildGeneratorPrompt(params: GeneratorPromptParams): { system: string; user: string } {
  const {
    userPrompt,
    routedClauses,
    activeFacts,
    language = 'en',
    format = 'feed_4_5',
    iteration = 1,
    previousFindings = [],
    originalPurpose,
  } = params;

  const clausesText = routedClauses.map((c) => `[${c.id}] ${c.text}`).join('\n');
  const factsText = activeFacts
    .filter((f) => f.status === 'active')
    .map((f) => `- ${f.key}: ${f.value} ${f.unit || ''} (Active from ${f.validFrom})`)
    .join('\n');

  const system = `You are the lead content creator for Thrift-It (@thriftit.in), an Indian curated pre-loved clothing store based in Bandra, Mumbai.
Your voice is "the stylish older cousin with great taste": warm, witty, approachable, with light Hinglish if requested.

MANDATORY BRAND POLICIES:
${clausesText}

ACTIVE GROUND TRUTH FACTS (Never contradict these):
${factsText}

REQUIREMENTS:
1. Generate an Instagram package tailored for Indian Gen-Z & young millennials (18-32).
2. Format: ${format}. Language: ${language}.
3. Always include #ThriftIt in CamelCase.
4. Maximum 2 emojis in caption. Maximum 8 hashtags.
5. Provide a 20-30 second spoken voice-over script with Hook, Body, and Call To Action.
6. Design an imagePrompt for an image generator that incorporates natural lighting, neutral/Mumbai backdrops, and brand colors (Thrift Teal, Marigold, Paper, Ink).

RESPONSE FORMAT:
Respond with valid JSON matching:
{
  "caption": string,
  "hashtags": string[],
  "altText": string,
  "imagePrompt": string,
  "marketingScript": string,
  "purpose": {
    "summary": string,
    "product": string,
    "offer": string,
    "cta": string,
    "audience": string,
    "requiredElements": string[]
  }
}`;

  let user = `Creative Brief:
"${userPrompt}"`;

  if (iteration > 1 && previousFindings.length > 0) {
    user += `\n\nGOVERNANCE FEEDBACK (Iteration ${iteration}):
The previous draft triggered policy violations. You must fix ONLY these issues, strictly preserve the original purpose, and change nothing else:
${previousFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Original Purpose to Preserve:
${JSON.stringify(originalPurpose, null, 2)}`;
  }

  return { system, user };
}
