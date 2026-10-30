import { ZodType } from 'zod';
import OpenAI from 'openai';
import { LlmCallLog } from '@/src/types';
import { parseJsonSafe } from './jsonRepair';

export type LlmProvider = 'groq1' | 'groq2' | 'groq3' | 'gemini' | 'groq' | 'nvidia';

export interface CallLlmParams<T> {
  provider: LlmProvider;
  system: string;
  user: string;
  schema?: ZodType<T, any, any>;
  purpose: string;
  clauseIdsSent: string[];
}

export interface CallLlmResult<T> {
  ok: boolean;
  data?: T;
  rawText?: string;
  log: LlmCallLog;
  error?: string;
  failureCode?: LlmFailureCode;
}

export type LlmFailureCode =
  | 'configuration'
  | 'authentication'
  | 'permission'
  | 'model_not_found'
  | 'invalid_request'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'timeout'
  | 'network'
  | 'invalid_json'
  | 'invalid_schema';

export const TIMEOUT_MS = 45000; // 45 s per call

export interface SlotConfig {
  keyEnv: string;
  modelEnv: string;
  baseEnv: string;
  keyFallback?: string;
  modelFallback?: string;
  defaultModel: string;
  label: string;
}

export const PROVIDER_SLOTS: Record<LlmProvider, SlotConfig> = {
  groq1: {
    keyEnv: 'GROQ_API_KEY_1',
    modelEnv: 'GROQ_MODEL_1',
    baseEnv: 'GROQ_BASE_URL_1',
    keyFallback: 'GROQ_API_KEY',
    modelFallback: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
    label: 'Groq 1 (GPT OSS 120B)',
  },
  groq2: {
    keyEnv: 'GROQ_API_KEY_2',
    modelEnv: 'GROQ_MODEL_2',
    baseEnv: 'GROQ_BASE_URL_2',
    keyFallback: 'GROQ_API_KEY',
    modelFallback: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-20b',
    label: 'Groq 2 (GPT OSS 20B)',
  },
  groq3: {
    keyEnv: 'GROQ_API_KEY_3',
    modelEnv: 'GROQ_MODEL_3',
    baseEnv: 'GROQ_BASE_URL_3',
    keyFallback: 'GROQ_API_KEY',
    modelFallback: 'GROQ_MODEL',
    defaultModel: 'qwen/qwen3.8-27b',
    label: 'Groq 3 (Qwen 3.8 27B)',
  },
  gemini: {
    keyEnv: 'GROQ_API_KEY_1',
    modelEnv: 'GROQ_MODEL_1',
    baseEnv: 'GROQ_BASE_URL_1',
    keyFallback: 'GEMINI_API_KEY',
    modelFallback: 'GEMINI_TEXT_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
    label: 'Groq 1 (GPT OSS 120B)',
  },
  groq: {
    keyEnv: 'GROQ_API_KEY_2',
    modelEnv: 'GROQ_MODEL_2',
    baseEnv: 'GROQ_BASE_URL_2',
    keyFallback: 'GROQ_API_KEY',
    modelFallback: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-20b',
    label: 'Groq 2 (GPT OSS 20B)',
  },
  nvidia: {
    keyEnv: 'GROQ_API_KEY_3',
    modelEnv: 'GROQ_MODEL_3',
    baseEnv: 'GROQ_BASE_URL_3',
    keyFallback: 'NVIDIA_API_KEY',
    modelFallback: 'NVIDIA_MODEL',
    defaultModel: 'qwen/qwen3.8-27b',
    label: 'Groq 3 (Qwen 3.8 27B)',
  },
};

/** Model IDs come only from environment variables (spec §0, §24) — never a hardcoded default. */
export const MODEL_ENV: Record<LlmProvider, string> = {
  groq1: 'GROQ_MODEL_1',
  groq2: 'GROQ_MODEL_2',
  groq3: 'GROQ_MODEL_3',
  gemini: 'GROQ_MODEL_1',
  groq: 'GROQ_MODEL_2',
  nvidia: 'GROQ_MODEL_3',
};

const GROQ_DEFAULT_BASE = 'https://api.groq.com/openai/v1';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerFailure(err: unknown): { code: LlmFailureCode; message: string } {
  const error = err as { status?: number; statusCode?: number; code?: string; name?: string };
  const status = error?.status || error?.statusCode;
  const code = error?.code?.toLowerCase() || '';
  const name = error?.name?.toLowerCase() || '';

  if (name.includes('timeout') || code.includes('timeout') || code === 'etimedout') {
    return { code: 'timeout', message: 'The provider timed out. Please retry.' };
  }
  if (code === 'json_validate_failed') {
    return { code: 'invalid_json', message: 'The provider could not validate the JSON response for this request. Retry or use a shorter brief.' };
  }
  if (status === 401) return { code: 'authentication', message: 'The provider rejected its server API key. Check the configured credentials.' };
  if (status === 403) return { code: 'permission', message: 'The provider denied access. Check the key permissions and account status.' };
  if (status === 404) return { code: 'model_not_found', message: 'The provider could not find the configured model or endpoint. Check the model ID and base URL.' };
  if (status === 400 || status === 413) {
    const providerCode = error?.code && /^[a-z0-9_-]{1,60}$/i.test(error.code) ? `, ${error.code}` : '';
    return { code: 'invalid_request', message: `The provider rejected the request (HTTP ${status}${providerCode}). Check model compatibility and request size.` };
  }
  if (status === 429) return { code: 'rate_limited', message: 'The provider rate limit or quota was reached. Please retry later.' };
  if (typeof status === 'number' && status >= 500) return { code: 'provider_unavailable', message: 'The provider is temporarily unavailable. Please retry.' };
  return { code: 'network', message: 'The provider could not be reached. Check the server network and provider endpoint.' };
}

export function shouldRetryProviderError(err: unknown): boolean {
  const error = err as { status?: number; statusCode?: number; code?: string };
  const status = error?.status || error?.statusCode;
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  return status === 429 || (typeof status === 'number' && status >= 500) || code === 'json_validate_failed';
}

function resolveSlot(provider: LlmProvider) {
  const slot = PROVIDER_SLOTS[provider] || PROVIDER_SLOTS.groq1;
  const apiKey =
    process.env[slot.keyEnv]?.trim() ||
    (slot.keyFallback ? process.env[slot.keyFallback]?.trim() : undefined) ||
    process.env.GROQ_API_KEY?.trim() ||
    '';

  const model =
    process.env[slot.modelEnv]?.trim() ||
    (slot.modelFallback ? process.env[slot.modelFallback]?.trim() : undefined) ||
    '';

  const baseUrl =
    process.env[slot.baseEnv]?.trim() ||
    process.env.GROQ_BASE_URL?.trim() ||
    GROQ_DEFAULT_BASE;

  return { slot, apiKey, model, baseUrl };
}

export async function callLLM<T = any>(params: CallLlmParams<T>): Promise<CallLlmResult<T>> {
  const { provider, system, user, schema, purpose, clauseIdsSent } = params;
  const startTime = Date.now();
  const { slot, apiKey, model: modelName, baseUrl } = resolveSlot(provider);

  // Pre-check for API keys
  if (!apiKey) {
    let keyName = slot.keyEnv;
    if (provider === 'gemini' && !process.env.GROQ_API_KEY_1) keyName = 'GEMINI_API_KEY';
    else if (provider === 'groq' && !process.env.GROQ_API_KEY_2) keyName = 'GROQ_API_KEY';
    else if (provider === 'nvidia' && !process.env.GROQ_API_KEY_3) keyName = 'NVIDIA_API_KEY';

    return {
      ok: false,
      error: `${keyName} is not configured on the server.`,
      failureCode: 'configuration',
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

  if (!modelName) {
    let modelEnvName = slot.modelEnv;
    if (provider === 'gemini' && process.env.GEMINI_API_KEY && !process.env.GROQ_MODEL_1) {
      modelEnvName = 'GEMINI_TEXT_MODEL';
    } else if (provider === 'groq' && process.env.GROQ_API_KEY && !process.env.GROQ_MODEL_2 && !process.env.GROQ_MODEL) {
      modelEnvName = 'GROQ_MODEL';
    } else if (provider === 'nvidia' && process.env.NVIDIA_API_KEY && !process.env.GROQ_MODEL_3) {
      modelEnvName = 'NVIDIA_MODEL';
    }

    return {
      ok: false,
      error: `${modelEnvName} is not configured on the server.`,
      failureCode: 'configuration',
      log: { provider, model: '(not configured)', purpose, clauseIdsSent, ms: Date.now() - startTime, ok: false },
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
      const client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
        timeout: TIMEOUT_MS,
        maxRetries: 0,
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

      // Success in fetching raw output
      lastError = null;
      break;
    } catch (err: any) {
      lastError = err;
      if (!shouldRetryProviderError(err)) {
        break;
      }
    }
  }

  if (lastError || !rawResponseText) {
    const failure = providerFailure(lastError);
    return {
      ok: false,
      error: `${slot.label}: ${failure.message}`,
      failureCode: failure.code,
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
      const repairedResult = await repairViaPrompt(apiKey, baseUrl, modelName, rawResponseText);
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
      error: `${slot.label} returned malformed JSON. Please retry.`,
      failureCode: 'invalid_json',
      rawText: rawResponseText,
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
      const invalidFields = [...new Set(valResult.error.issues.map((issue) => issue.path.join('.')).filter(Boolean))].slice(0, 4);
      return {
        ok: false,
        error: `${slot.label} returned output that failed schema validation${invalidFields.length ? ` (${invalidFields.join(', ')})` : ''}. Please retry.`,
        failureCode: 'invalid_schema',
        rawText: rawResponseText,
        data: finalParsed.data,
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
  apiKey: string,
  baseURL: string,
  model: string,
  brokenJson: string
): Promise<string | null> {
  const repairPrompt = `The following output was supposed to be strictly valid JSON, but has formatting syntax errors. Please fix all syntax errors and return ONLY the corrected valid JSON:\n\n${brokenJson}`;

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: repairPrompt }],
    response_format: { type: 'json_object' },
  });
  return completion.choices[0]?.message?.content || null;
}
