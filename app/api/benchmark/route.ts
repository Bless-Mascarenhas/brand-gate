import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'benchmark', 'results.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ available: false });
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || !data.meta || data.meta.execution === 'deterministic_only') {
      return NextResponse.json({ available: false });
    }
    return NextResponse.json({ available: true, data });
  } catch (err: any) {
    return NextResponse.json({ available: false, error: err.message }, { status: 500 });
  }
}
