import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/sessionStore';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ sessions: sessionStore });
}
