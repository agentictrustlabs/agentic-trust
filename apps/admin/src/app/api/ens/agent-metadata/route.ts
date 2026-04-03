import { NextResponse } from 'next/server';
import { getEnsAgentMetadataBundle, prepareEnsAgentMetadataUpdate } from '@agentic-trust/core/server';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ensName = String(url.searchParams.get('ensName') || '').trim();
  const chainId = Number(url.searchParams.get('chainId') || '');

  if (!ensName) {
    return NextResponse.json({ ok: false, error: 'Missing ensName.' }, { status: 400 });
  }
  if (!Number.isFinite(chainId)) {
    return NextResponse.json({ ok: false, error: 'Missing or invalid chainId.' }, { status: 400 });
  }

  try {
    const bundle = await getEnsAgentMetadataBundle({
      ensName,
      chainId,
    });

    return NextResponse.json({
      ok: true,
      chainId,
      ensName: bundle.ensName,
      resolver: bundle.resolver,
      textRecords: bundle.rawProperties,
      structured: bundle.metadata,
      payloads: bundle.payloads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to load ENS agent metadata.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      ensName?: string;
      chainId?: number | string;
      metadata?: Record<string, unknown>;
      servicesPayload?: Record<string, unknown> | null;
      registrationsPayload?: Array<Record<string, unknown>> | null;
      agentDocument?: Record<string, unknown> | null;
      autoBuildAgentDocument?: boolean;
    };

    const ensName = String(body.ensName || '').trim();
    const chainId = Number(body.chainId);

    if (!ensName) {
      return NextResponse.json({ ok: false, error: 'Missing ensName.' }, { status: 400 });
    }
    if (!Number.isFinite(chainId)) {
      return NextResponse.json({ ok: false, error: 'Missing or invalid chainId.' }, { status: 400 });
    }

    const prepared = await prepareEnsAgentMetadataUpdate({
      ensName,
      chainId,
      metadata:
        body.metadata && typeof body.metadata === 'object'
          ? (body.metadata as Record<string, unknown>)
          : {},
      servicesPayload:
        body.servicesPayload && typeof body.servicesPayload === 'object'
          ? (body.servicesPayload as Record<string, unknown>)
          : undefined,
      registrationsPayload: Array.isArray(body.registrationsPayload)
        ? (body.registrationsPayload as Array<Record<string, unknown>>)
        : undefined,
      agentDocument:
        body.agentDocument && typeof body.agentDocument === 'object'
          ? (body.agentDocument as Record<string, unknown>)
          : undefined,
      autoBuildAgentDocument: body.autoBuildAgentDocument !== false,
    });

    return NextResponse.json({
      ok: true,
      chainId: prepared.chainId,
      ensName: prepared.ensName,
      resolver: prepared.resolver,
      current: prepared.current,
      desired: prepared.desired,
      delta: prepared.delta,
      uploaded: prepared.uploaded,
      calls: prepared.calls,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to prepare ENS text-record calls.',
      },
      { status: 500 },
    );
  }
}
