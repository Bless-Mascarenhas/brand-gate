import { ZodSchema } from 'zod';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { LlmCallLog } from '@/src/types';
import { parseJsonSafe } from './jsonRepair';

export interface CallLlmParams<T> {
  provider: 'gemini' | 'xai' | 'nvidia';
  system: string;
  user: string;
  schema?: ZodSchema<T>;
  purpose: string;
  clauseIdsSent: string[];
}

export interface CallLlmResult<T> {
  ok: boolean;
  data?: T;
  rawText?: string;
  log: LlmCallLog;
  error?: string;
  modeSuggestion?: 'replay';
}

const TIMEOUT_MS = 45000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callLLM<T = any>(params: CallLlmParams<T>): Promise<CallLlmResult<T>> {
  const { provider, system, user, schema, purpose, clauseIdsSent } = params;
  const startTime = Date.now();

  let modelName = '';
  if (provider === 'gemini') {
    modelName = process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash';
  } else if (provider === 'xai') {
    modelName = process.env.XAI_MODEL || 'grok-2-latest';
  } else if (provider === 'nvidia') {
    modelName = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
  }

  // Pre-check for API keys
  if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      error: 'GEMINI_API_KEY is not configured on the server. Please switch to Replay mode.',
      modeSuggestion: 'replay',
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        ms: Date.now() - startTime,
        ok: false,
      },
    };
  }

  if (provider === 'xai' && !process.env.XAI_API_KEY) {
    return {
      ok: false,
      error: 'XAI_API_KEY is not configured on the server. Please switch to Replay mode.',
      modeSuggestion: 'replay',
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        ms: Date.now() - startTime,
        ok: false,
      },
    };
  }

  if (provider === 'nvidia' && !process.env.NVIDIA_API_KEY) {
    return {
      ok: false,
      error: 'NVIDIA_API_KEY is not configured on the server. Please switch to Replay mode.',
      modeSuggestion: 'replay',
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        ms: Date.now() - startTime,
        ok: false,
      },
    };
  }

  // Attempt call with 1 retry on 429/5xx
  let lastError: any = null;
  let rawResponseText = '';
  let tokensIn: number | undefined;
  let tokensOut: number | undefined;

  for (let attempt = 0; attempt <= 1; attempt++) {
    if (attempt > 0) {
      await sleep(1500); // 1.5s backoff
    }

    try {
      if (provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: `${system}\n\nUser:\n${user}`,
            config: {
              responseMimeType: 'application/json',
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM call timed out after 45s')), TIMEOUT_MS)
          ),
        ]);

        rawResponseText = response.text || '';
        tokensIn = response.usageMetadata?.promptTokenCount;
        tokensOut = response.usageMetadata?.candidatesTokenCount;
      } else {
        // xAI or NVIDIA using OpenAI SDK
        const client = new OpenAI({
          apiKey: provider === 'xai' ? process.env.XAI_API_KEY : process.env.NVIDIA_API_KEY,
          baseURL:
            provider === 'xai'
              ? process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
              : process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
          timeout: TIMEOUT_MS,
        });

        const completion = await client.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        });

        rawResponseText = completion.choices[0]?.message?.content || '';
        tokensIn = completion.usage?.prompt_tokens;
        tokensOut = completion.usage?.completion_tokens;
      }

      // Success in fetching raw output
      lastError = null;
      break;
    } catch (err: any) {
      lastError = err;
      // Retry only on rate limit (429) or server error (5xx)
      const status = err?.status || err?.statusCode;
      if (status !== 429 && (!status || status < 500)) {
        break;
      }
    }
  }

  if (lastError || !rawResponseText) {
    return {
      ok: false,
      error: `${provider} provider unavailable (${lastError?.message || 'Empty response'}). Switch to Replay mode.`,
      modeSuggestion: 'replay',
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        ms: Date.now() - startTime,
        ok: false,
      },
    };
  }

  // Parse JSON with repair tolerance
  const parseResult = parseJsonSafe<T>(rawResponseText);
  if (!parseResult.success) {
    // ONE repair re-prompt attempt if provider is reachable
    try {
      const repairedResult = await repairViaPrompt(provider, modelName, rawResponseText, system);
      if (repairedResult) {
        rawResponseText = repairedResult;
      }
    } catch {
      // ignore re-prompt failure and proceed
    }
  }

  // Final validation with Zod if schema provided
  const finalParsed = parseJsonSafe<T>(rawResponseText);
  if (!finalParsed.success) {
    return {
      ok: false,
      error: `Invalid JSON returned by ${provider}: ${finalParsed.error}`,
      rawText: rawResponseText,
      modeSuggestion: 'replay',
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        tokensIn,
        tokensOut,
        ms: Date.now() - startTime,
        ok: false,
      },
    };
  }

  if (schema) {
    const valResult = schema.safeParse(finalParsed.data);
    if (!valResult.success) {
      return {
        ok: false,
        error: `JSON schema validation failed: ${valResult.error.message}`,
        rawText: rawResponseText,
        data: finalParsed.data,
        modeSuggestion: 'replay',
        log: {
          provider,
          model: modelName,
          purpose,
          clauseIdsSent,
          tokensIn,
          tokensOut,
          ms: Date.now() - startTime,
          ok: false,
        },
      };
    }
    return {
      ok: true,
      data: valResult.data,
      rawText: rawResponseText,
      log: {
        provider,
        model: modelName,
        purpose,
        clauseIdsSent,
        tokensIn,
        tokensOut,
        ms: Date.now() - startTime,
        ok: true,
      },
    };
  }

  return {
    ok: true,
    data: finalParsed.data,
    rawText: rawResponseText,
    log: {
      provider,
      model: modelName,
      purpose,
      clauseIdsSent,
      tokensIn,
      tokensOut,
      ms: Date.now() - startTime,
      ok: true,
    },
  };
}

async function repairViaPrompt(
  provider: 'gemini' | 'xai' | 'nvidia',
  model: string,
  brokenJson: string,
  originalSystem: string
): Promise<string | null> {
  const repairPrompt = `The following output was supposed to be strictly valid JSON, but has formatting syntax errors. Please fix all syntax errors and return ONLY the corrected valid JSON:\n\n${brokenJson}`;

  if (provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await ai.models.generateContent({
      model,
      contents: `${originalSystem}\n\n${repairPrompt}`,
      config: { responseMimeType: 'application/json' },
    });
    return res.text || null;
  } else {
    const client = new OpenAI({
      apiKey: provider === 'xai' ? process.env.XAI_API_KEY : process.env.NVIDIA_API_KEY,
      baseURL:
        provider === 'xai'
          ? process.env.XAI_BASE_URL || 'https://api.x.ai/v1'
          : process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: repairPrompt }],
      response_format: { type: 'json_object' },
    });
    return completion.choices[0]?.message?.content || null;
  }
}
