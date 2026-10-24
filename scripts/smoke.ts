/** Live smoke test: one tiny JSON call per configured provider. Prints status, model, latency, tokens — never keys. */
import './loadEnv';
import { callLLM } from '@/src/llm/callLLM';

async function main() {
  for (const provider of ['gemini', 'xai', 'nvidia'] as const) {
    const r = await callLLM<{ ok: boolean }>({ provider, system: 'Reply with JSON only.', user: 'Return {"ok": true}.', purpose: 'smoke test', clauseIdsSent: [] });
    console.log(`${provider.padEnd(7)} ok=${r.ok} model=${r.log.model} ms=${r.log.ms} tokens=${r.log.tokensIn ?? '?'}/${r.log.tokensOut ?? '?'} ${r.ok ? JSON.stringify(r.data) : r.error}`);
  }
}
main();
