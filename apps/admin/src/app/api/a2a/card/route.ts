import { NextRequest, NextResponse } from 'next/server';
import { fetchA2AAgentCard } from '@agentic-trust/core/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = String(request.nextUrl.searchParams.get('url') || '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Missing url parameter.' }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Only http(s) URLs are supported.' }, { status: 400 });
    }

    const card = await fetchA2AAgentCard(url);
    if (!card) {
      return NextResponse.json({ error: 'Failed to fetch agent card.' }, { status: 404 });
    }

    return NextResponse.json({ card });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch agent card.',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
