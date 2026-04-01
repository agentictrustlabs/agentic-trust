export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

async function firstExistingPath(candidates: string[]): Promise<string | null> {
  for (const p of candidates) {
    try {
      await stat(p);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  const candidates = [
    // monorepo root
    resolve(process.cwd(), 'docs', 'NISTAgentSubmission.md'),
    // when running from apps/admin
    resolve(process.cwd(), '..', '..', 'docs', 'NISTAgentSubmission.md'),
    // fallback
    resolve(process.cwd(), '..', 'docs', 'NISTAgentSubmission.md'),
  ];

  const filePath = await firstExistingPath(candidates);
  if (!filePath) {
    return NextResponse.json(
      { ok: false, error: 'Submission markdown file not found.' },
      { status: 404 },
    );
  }

  const markdown = await readFile(filePath, 'utf8');

  if (format === 'raw' || format === 'md' || format === 'markdown') {
    return new Response(markdown, {
      status: 200,
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });
  }

  return NextResponse.json(
    { ok: true, markdown },
    {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=300',
      },
    },
  );
}

