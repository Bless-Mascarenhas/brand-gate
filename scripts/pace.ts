// Script-only rate pacing for free-tier provider limits. Wraps an LLM caller so long batch runs
// (benchmark, record-replay) wait instead of failing with 429. The app itself is not affected.
import { callLLM, CallLlmParams, CallLlmResult } from '@/src/llm/callLLM';
import type { LlmCaller } from '@/src/pipeline/governed';

type Provider = CallLlmParams<unknown>['provider'];

/** Tokens-per-minute budgets from env, e.g. GROQ_TOKENS_PER_MINUTE=8000. Unset = unpaced. */
function budgets(): Partial<Record<Provider, number>> {
  const n = (k: string) => (process.env[k] ? Number(process.env[k]) : undefined);
  return { gemini: n('GEMINI_TOKENS_PER_MINUTE'), groq: n('GROQ_TOKENS_PER_MINUTE'), nvidia: n('NVIDIA_TOKENS_PER_MINUTE') };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function pacedCaller(base: LlmCaller = callLLM as LlmCaller): LlmCaller & { waitedMs: () => number } {
  const limits = budgets();
  const windows = new Map<Provider, { t: number; tokens: number }[]>();
  let waited = 0;

  const fn = (async <T,>(p: CallLlmParams<T>): Promise<CallLlmResult<T>> => {
    const limit = limits[p.provider];
    const estimate = Math.ceil((p.system.length + p.user.length) / 3.5) + 1200;
    if (limit) {
      for (;;) {
        const now = Date.now();
        const w = (windows.get(p.provider) ?? []).filter((e) => now - e.t < 60_000);
        windows.set(p.provider, w);
        const used = w.reduce((s, e) => s + e.tokens, 0);
        if (used + estimate <= limit || w.length === 0) break;
        const wait = 60_000 - (now - w[0].t) + 250;
        waited += wait;
        await sleep(wait);
      }
    }
    let res = await base(p);
    for (let attempt = 1; attempt <= 3 && !res.ok && /429|503|rate limit|quota|high demand|UNAVAILABLE|overloaded/i.test(res.error ?? ''); attempt++) {
      const wait = 20_000 * attempt;
      waited += wait;
      await sleep(wait);
      res = await base(p);
    }
    if (limit) windows.get(p.provider)!.push({ t: Date.now(), tokens: (res.log.tokensIn ?? 0) + (res.log.tokensOut ?? 0) || estimate });
    return res;
  }) as LlmCaller & { waitedMs: () => number };
  fn.waitedMs = () => waited;
  return fn;
}
