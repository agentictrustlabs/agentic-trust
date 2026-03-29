export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDiscoveryClient } from '@agentic-trust/core/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eoaAddress = (searchParams.get('eoaAddress') || '').trim();
    const chainIdRaw = (searchParams.get('chainId') || '').trim();
    const source = searchParams.get('source') || 'unknown';

    if (!eoaAddress) {
      return NextResponse.json({ error: 'eoaAddress parameter is required' }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(eoaAddress)) {
      return NextResponse.json({ error: 'Invalid EOA address format' }, { status: 400 });
    }

    const chainId = Number.parseInt(chainIdRaw, 10);
    if (!Number.isFinite(chainId) || chainId <= 0) {
      return NextResponse.json({ error: 'chainId parameter is required (number)' }, { status: 400 });
    }

    const firstRaw = (searchParams.get('first') || '').trim();
    const skipRaw = (searchParams.get('skip') || '').trim();
    const orderBy = (searchParams.get('orderBy') || 'updatedAtTime').trim();
    const orderDirection = ((searchParams.get('orderDirection') || 'DESC').trim().toUpperCase() === 'ASC'
      ? 'ASC'
      : 'DESC') as 'ASC' | 'DESC';

    const first = firstRaw ? Math.max(1, Math.floor(Number.parseInt(firstRaw, 10))) : 100;
    const skip = skipRaw ? Math.max(0, Math.floor(Number.parseInt(skipRaw, 10))) : 0;

    const accessCode = (process.env.GRAPHQL_ACCESS_CODE || process.env.AGENTIC_TRUST_DISCOVERY_API_KEY || '').trim();
    if (!accessCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing discovery access code. Set GRAPHQL_ACCESS_CODE (preferred) or AGENTIC_TRUST_DISCOVERY_API_KEY.',
        },
        { status: 500 },
      );
    }

    const discoveryClient = await getDiscoveryClient({ apiKey: accessCode });
    const result = await discoveryClient.getAgentsByEoa(chainId, eoaAddress, {
      first,
      skip,
      orderBy: orderBy as any,
      orderDirection,
      includeIdentityAndAccounts: true,
    });

    const addrPreview = `${eoaAddress.slice(0, 6)}…${eoaAddress.slice(-4)}`;
    console.info('[API][agents/by-eoa]', { source, chainId, eoa: addrPreview, count: result.agents.length });

    return NextResponse.json({
      success: true,
      chainId,
      eoaAddress,
      ...result,
    });
  } catch (error: any) {
    console.error('[API] Error fetching agents by eoa:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch agents by eoa',
      },
      { status: 500 },
    );
  }
}

