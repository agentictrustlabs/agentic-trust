import { createPublicClient, http, namehash, zeroAddress, type Address, type Chain } from 'viem';

import { getENSClient } from '../singletons/ensClient';
import { getAgenticTrustClient } from './agenticTrust';
import { getChainById, getChainEnvVar, requireChainEnvVar } from './chainConfig';

const ENS_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'resolver',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const ENS_RESOLVER_ABI = [
  {
    type: 'function',
    name: 'addr',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'text',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export type EnsAgentLookup = {
  ok: true;
  chainId: number;
  ensName: string;
  account: string | null;
  agentUrl: string | null;
  image: string | null;
  description: string | null;
  identity: unknown;
};

export function normalizeOrgName(input: string): string {
  const t = (input || '').trim().toLowerCase();
  if (!t) return '';
  return t.endsWith('.eth') ? t.replace(/\.eth$/i, '') : t;
}

export function buildEnsName(params: { name: string; orgName: string }): string {
  const rawName = (params.name || '').trim();
  const rawOrg = normalizeOrgName(params.orgName);
  if (!rawName) return '';

  const lower = rawName.toLowerCase();
  if (lower.endsWith('.eth') || lower.includes('.')) {
    return lower.endsWith('.eth') ? lower : `${lower}.eth`;
  }
  if (!rawOrg) return '';
  return `${lower}.${rawOrg}.eth`;
}

async function resolveEnsViaRegistry(params: {
  chainId: number;
  fullName: string;
}): Promise<{
  name: string;
  account: string | null;
  url: string | null;
  image: string | null;
  description: string | null;
}> {
  const rpcUrl = requireChainEnvVar('AGENTIC_TRUST_RPC_URL', params.chainId);
  const chain = getChainById(params.chainId) as unknown as Chain;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const registry =
    (getChainEnvVar('AGENTIC_TRUST_ENS_REGISTRY', params.chainId) || '').trim() ||
    '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

  const node = namehash(params.fullName);
  let resolver: Address | null = null;
  try {
    resolver = (await client.readContract({
      address: registry as Address,
      abi: ENS_REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    })) as Address;
  } catch {
    resolver = null;
  }

  if (!resolver || resolver === zeroAddress) {
    return { name: params.fullName, account: null, url: null, image: null, description: null };
  }

  const readText = async (key: string) => {
    try {
      const v = await client.readContract({
        address: resolver as Address,
        abi: ENS_RESOLVER_ABI,
        functionName: 'text',
        args: [node, key],
      });
      const s = typeof v === 'string' ? v.trim() : '';
      return s || null;
    } catch {
      return null;
    }
  };

  let account: string | null = null;
  try {
    const addr = await client.readContract({
      address: resolver as Address,
      abi: ENS_RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    });
    const a = typeof addr === 'string' ? addr : '';
    account = a && a !== zeroAddress ? a : null;
  } catch {
    account = null;
  }

  const [url, image, description] = await Promise.all([
    readText('url'),
    readText('avatar'),
    readText('description'),
  ]);

  return { name: params.fullName, account, url, image, description };
}

export async function getEnsAgentLookup(params: {
  name: string;
  orgName?: string;
  chainId: number;
}): Promise<EnsAgentLookup> {
  const fullName = buildEnsName({
    name: params.name,
    orgName: params.orgName || '8004-agent.eth',
  });
  if (!fullName) {
    throw new Error('Missing name (and/or org). Provide name=alice or name=alice.8004-agent.eth');
  }

  const chainId = Number(params.chainId);
  const allowed = new Set([1, 11155111, 59144, 59141]);
  if (!allowed.has(chainId)) {
    throw new Error(`Unsupported chainId=${params.chainId}. Use 1, 11155111, 59144, or 59141.`);
  }

  const useMainnetResolvers = chainId === 1;
  const info = useMainnetResolvers
    ? await resolveEnsViaRegistry({ chainId, fullName })
    : await (async () => {
        const client = await getAgenticTrustClient();
        const i = await client.getENSInfo(fullName, chainId);
        return {
          name: i.name,
          account: i.account ?? null,
          url: i.url ?? null,
          image: i.image ?? null,
          description: i.description ?? null,
        };
      })();

  let identity: unknown = null;
  const canTryIdentity = chainId === 1 || chainId === 11155111 || chainId === 59144 || chainId === 59141;
  if (canTryIdentity) {
    try {
      const ens = await getENSClient(chainId);
      const extra = ens as unknown as {
        getAgentIdentityByName?: (name: string) => Promise<unknown> | unknown;
      };
      if (extra.getAgentIdentityByName) {
        try {
          identity = await extra.getAgentIdentityByName(fullName);
        } catch {
          identity = null;
        }
      }
    } catch {
      identity = null;
    }
  }

  return {
    ok: true,
    chainId,
    ensName: info.name,
    account: info.account ?? null,
    agentUrl: info.url ?? null,
    image: info.image ?? null,
    description: info.description ?? null,
    identity,
  };
}

export function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toJsonSafe(item));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toJsonSafe(nested);
    }
    return result;
  }
  return value;
}

export function toJsonSafeCalls(
  calls: Array<{ to: `0x${string}`; data: `0x${string}`; value?: bigint | number | string | null }>,
) {
  return calls.map((call) => ({
    to: call.to,
    data: call.data,
    value: typeof call.value === 'bigint' ? call.value.toString() : call.value ?? null,
  }));
}

export function toJsonSafeReceipt<T>(receipt: T): T {
  return toJsonSafe(receipt) as T;
}
