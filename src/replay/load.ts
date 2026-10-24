// src/replay/load.ts — server-side loader; never throws, always returns a typed error the UI can show.
import fs from 'fs';
import path from 'path';
import { Replay, ReplaySchema, compareReplayId, sampleReplayId } from '@/src/replay/schema';
import { COMPARE_SCENARIOS } from '@/src/compare/scenarios';

export const REPLAY_DIR = path.join(process.cwd(), 'data', 'replay');

export const REQUIRED_REPLAY_IDS = [
  ...Array.from({ length: 12 }, (_, i) => sampleReplayId(i + 1)),
  ...COMPARE_SCENARIOS.map((s) => compareReplayId(s.id)),
];

export type LoadReplayResult =
  | { ok: true; replay: Replay }
  | { ok: false; status: 400 | 404 | 422 | 500; error: string };

export function loadReplay(id: string, dir: string = REPLAY_DIR): LoadReplayResult {
  if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, status: 400, error: `Invalid replay id "${id}".` };
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return { ok: false, status: 404, error: `No recorded run "${id}" exists. Run \`npm run record-replay\` to create it.` };
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return { ok: false, status: 422, error: `Recorded run "${id}" is not valid JSON (${e instanceof Error ? e.message : String(e)}).` };
  }
  const parsed = ReplaySchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    return { ok: false, status: 422, error: `Recorded run "${id}" failed schema validation: ${issues}` };
  }
  if (parsed.data.id !== id) return { ok: false, status: 422, error: `Recorded run file "${id}" declares id "${parsed.data.id}".` };
  return { ok: true, replay: parsed.data };
}

/** Status of every required replay (12 samples + 6 compare scenarios). */
export function replayInventory(dir: string = REPLAY_DIR) {
  return REQUIRED_REPLAY_IDS.map((id) => {
    const r = loadReplay(id, dir);
    return r.ok
      ? { id, ok: true as const, kind: r.replay.kind, title: r.replay.title, provenance: r.replay.provenance, recordedAt: r.replay.recordedAt }
      : { id, ok: false as const, status: r.status, error: r.error };
  });
}
