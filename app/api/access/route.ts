import { NextRequest, NextResponse } from 'next/server';
import { demoAccessCode } from '@/src/llm/gatekeeper';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COOKIE_NAME = 'bg_access';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  const validCode = demoAccessCode();

  const isAuthenticated = Boolean(validCode) && cookie?.value === validCode;
  return NextResponse.json({ authenticated: isAuthenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;
    const validCode = demoAccessCode();

    if (validCode && typeof code === 'string' && code.trim() === validCode) {
      const response = NextResponse.json({ success: true, message: 'Access granted' });
      response.cookies.set({
        name: COOKIE_NAME,
        value: validCode,
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid access code' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
