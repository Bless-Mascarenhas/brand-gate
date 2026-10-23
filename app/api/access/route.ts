import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const COOKIE_NAME = 'bg_access';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME);
  const validCode = process.env.DEMO_ACCESS_CODE || 'brandgate2026';

  const isAuthenticated = cookie?.value === validCode;
  return NextResponse.json({ authenticated: isAuthenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;
    const validCode = process.env.DEMO_ACCESS_CODE || 'brandgate2026';

    if (code && code.trim() === validCode.trim()) {
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
