/** Quick live check for configured providers. Loads .env.local like npm run smoke. */
import './loadEnv';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

async function testGroq() {
  console.log('--- Reviewer A (Groq / GROQ_* env) ---');
  const apiKey = process.env.GROQ_API_KEY;
  const baseURL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  if (!apiKey) {
    console.log('skip: GROQ_API_KEY not set');
    return;
  }
  try {
    const client = new OpenAI({ apiKey, baseURL });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello in JSON: {"msg": "hello"}' }],
      response_format: { type: 'json_object' },
    });
    console.log('ok model=', model, completion.choices[0]?.message?.content?.slice(0, 80));
  } catch (err: unknown) {
    console.error('failed:', err instanceof Error ? err.message : err);
  }
}

async function testNvidia() {
  console.log('--- Reviewer B (NVIDIA) ---');
  const apiKey = process.env.NVIDIA_API_KEY;
  const baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const model = process.env.NVIDIA_MODEL;
  if (!apiKey || !model) {
    console.log('skip: NVIDIA_API_KEY or NVIDIA_MODEL not set');
    return;
  }
  try {
    const client = new OpenAI({ apiKey, baseURL, timeout: 45000 });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Say hello in JSON: {"msg": "hello"}' }],
      response_format: { type: 'json_object' },
    });
    console.log('ok model=', model, completion.choices[0]?.message?.content?.slice(0, 80));
  } catch (err: unknown) {
    console.error('failed:', err instanceof Error ? err.message : err);
  }
}

async function testGemini() {
  console.log('--- Gemini ---');
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_TEXT_MODEL;
  if (!apiKey || !model) {
    console.log('skip: GEMINI_API_KEY or GEMINI_TEXT_MODEL not set');
    return;
  }
  const fallbacks = [model, 'gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const m of [...new Set(fallbacks)]) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Say hi in JSON: {"msg": "hi"}',
        config: { responseMimeType: 'application/json' },
      });
      console.log('ok model=', m, res.text?.slice(0, 80));
      return;
    } catch (err: unknown) {
      console.error(`model ${m} failed:`, err instanceof Error ? err.message : err);
    }
  }
}

async function run() {
  await testGroq();
  await testNvidia();
  await testGemini();
}

run();
