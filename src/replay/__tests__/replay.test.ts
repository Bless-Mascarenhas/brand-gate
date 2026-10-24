import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { getPolicyPack } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { compareMetrics } from '@/src/compare/metrics';
import { REQUIRED_REPLAY_IDS, loadReplay, replayInventory } from '@/src/replay/load';
import { CompareReplay, SampleReplay } from '@/src/replay/schema';
import { SAMPLE_POSTS } from '@/data/samples/samplePosts';
import { GET as replayGET } from '@/app/api/replay/route';
import { POST as baselinePOST } from '@/app/api/llm/baseline/route';
import { POST as governedPOST } from '@/app/api/compare/governed/route';

const pack = getPolicyPack();
const KEY_VARS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'NVIDIA_API_KEY'] as const;
const saved: Record<string, string | undefined> = {};
beforeAll(() => { for (const k of KEY_VARS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterAll(() => { for (const k of KEY_VARS) if (saved[k] !== undefined) process.env[k] = saved[k]; });

describe('recorded replays', () => {
  it('all 18 required replays (12 samples + 6 compare scenarios) exist and pass schema validation', () => {
    expect(REQUIRED_REPLAY_IDS).toHaveLength(18);
    const inv = replayInventory();
    expect(inv.filter((r) => !r.ok)).toEqual([]);
  });

  it('every replay is labelled with honest provenance consistent with its recorded calls', () => {
    for (const id of REQUIRED_REPLAY_IDS) {
      const r = loadReplay(id);
      if (!r.ok) throw new Error(r.error);
      const calls = r.replay.kind === 'sample' ? r.replay.llmCalls : r.replay.columns.flatMap((c) => c.llmCalls);
      if (r.replay.provenance === 'live_recording') expect(calls.some((c) => c.ok)).toBe(true);
      else expect(calls).toEqual([]); // nothing non-live may pretend to have called a model
      expect(r.replay.generator).toBe('scripts/record-replay.ts');
      if (r.replay.kind === 'compare') {
        for (const c of r.replay.columns) if (c.provenance !== 'live_recording') expect(c.wallMs).toBeNull();
        if (r.replay.provenance === 'illustrative_fixture') expect(r.replay.notes.join(' ')).toMatch(/not model output/i);
      }
    }
  });

  it('sample replays match the sample posts and cite real clauses with the current pack', () => {
    const clauses = new Set(pack.clauses.map((c) => c.id));
    for (const s of SAMPLE_POSTS) {
      const r = loadReplay(`sample-${String(s.id).padStart(2, '0')}`);
      if (!r.ok) throw new Error(r.error);
      const rep = r.replay as SampleReplay;
      expect(rep.sampleId).toBe(s.id);
      expect(rep.post.caption).toBe(s.post.caption);
      expect(rep.packHash).toBe(pack.hash);
      for (const f of rep.findings) expect(clauses.has(f.clauseId)).toBe(true);
    }
  });

  it('recorded compare scores re-derive exactly from the independent scorer', () => {
    for (const id of REQUIRED_REPLAY_IDS.filter((x) => x.startsWith('compare-'))) {
      const r = loadReplay(id);
      if (!r.ok) throw new Error(r.error);
      const rep = r.replay as CompareReplay;
      expect(rep.columns.map((c) => c.key)).toEqual(['bare', 'policies', 'governed']);
      for (const c of rep.columns) expect(compareMetrics(evaluatePost(c.post, pack, rep.demoDate), pack.rules)).toEqual(c.metrics);
    }
  });
});

describe('replay loader errors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-'));
  const good = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'replay', 'sample-01.json'), 'utf-8'));
  fs.writeFileSync(path.join(dir, 'corrupt.json'), '{ not json');
  fs.writeFileSync(path.join(dir, 'wrong-shape.json'), JSON.stringify({ ...good, id: 'wrong-shape', verdict: { status: 'PUBLISHED' } }));
  fs.writeFileSync(path.join(dir, 'mismatch.json'), JSON.stringify(good));

  it('missing → 404, corrupt → 422, wrong schema → 422, id mismatch → 422, bad id → 400; never throws', () => {
    expect(loadReplay('nope', dir)).toMatchObject({ ok: false, status: 404 });
    expect(loadReplay('corrupt', dir)).toMatchObject({ ok: false, status: 422, error: expect.stringMatching(/not valid JSON/) });
    expect(loadReplay('wrong-shape', dir)).toMatchObject({ ok: false, status: 422, error: expect.stringMatching(/schema validation/) });
    expect(loadReplay('mismatch', dir)).toMatchObject({ ok: false, status: 422, error: expect.stringMatching(/declares id/) });
    expect(loadReplay('../../etc/passwd', dir)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('replay works without provider credentials', () => {
  it('the replay route serves recorded runs with no API keys configured', async () => {
    for (const k of KEY_VARS) expect(process.env[k]).toBeUndefined();
    const res = await replayGET(new NextRequest('http://localhost/api/replay?id=compare-expired-offer'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(true);
    expect(body.replay.kind).toBe('compare');
    const inv = await (await replayGET(new NextRequest('http://localhost/api/replay'))).json();
    expect(inv.replays.every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect((await replayGET(new NextRequest('http://localhost/api/replay?id=missing-one'))).status).toBe(404);
  });

  it('live Compare routes fail clearly and point to Replay instead of fabricating output', async () => {
    const headers = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026', 'content-type': 'application/json' };
    const base = await baselinePOST(new NextRequest('http://localhost/api/llm/baseline', { method: 'POST', headers, body: JSON.stringify({ variant: 'bare', scenarioId: 'expired-offer' }) }));
    expect(base.status).toBe(503);
    expect(await base.json()).toMatchObject({ modeSuggestion: 'replay', error: expect.stringMatching(/GEMINI_API_KEY/) });
    const gov = await governedPOST(new NextRequest('http://localhost/api/compare/governed', { method: 'POST', headers, body: JSON.stringify({ scenarioId: 'expired-offer' }) }));
    expect(gov.status).toBe(503);
    expect((await gov.json()).modeSuggestion).toBe('replay');
  });

  it('live Compare routes require the access code', async () => {
    const res = await baselinePOST(new NextRequest('http://localhost/api/llm/baseline', { method: 'POST', body: JSON.stringify({ variant: 'bare', scenarioId: 'expired-offer' }) }));
    expect(res.status).toBe(401);
  });

  it('unknown scenarios are rejected', async () => {
    const headers = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
    const res = await baselinePOST(new NextRequest('http://localhost/api/llm/baseline', { method: 'POST', headers, body: JSON.stringify({ variant: 'bare', scenarioId: 'nope' }) }));
    expect(res.status).toBe(404);
  });
});
