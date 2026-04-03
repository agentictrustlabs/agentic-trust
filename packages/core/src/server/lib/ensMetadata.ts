import {
  buildEnsAgentCanonicalPayload,
  buildEnsAgentMetadataRecords,
  computeEnsAgentMetadataDelta,
  parseEnsAgentMetadataRecords,
  readEnsAgentMetadata,
  type EnsAgentCanonicalPayload,
  type EnsAgentMetadataRecord,
  type EnsAgentRegistrationEntry,
  type EnsAgentServicesPayload,
} from '@agentic-trust/agentic-trust-sdk';
import { createPublicClient, encodeFunctionData, http, namehash, type Address } from 'viem';
import { getChainById, requireChainEnvVar, getChainEnvVar } from './chainConfig';
import { getIPFSStorage } from './ipfs';

const ENS_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'resolver',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const ENS_RESOLVER_SET_TEXT_ABI = [
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

function normalizeEnsName(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.endsWith('.eth') ? trimmed : `${trimmed}.eth`;
}

async function createEnsPublicClient(chainId: number) {
  const rpcUrl = requireChainEnvVar('AGENTIC_TRUST_RPC_URL', chainId);
  const chain = getChainById(chainId);
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

async function resolveResolverAddress(params: {
  chainId: number;
  ensName: string;
}): Promise<Address | null> {
  const client = await createEnsPublicClient(params.chainId);
  const node = namehash(params.ensName);
  const configuredRegistry =
    (getChainEnvVar('AGENTIC_TRUST_ENS_REGISTRY', params.chainId) || '').trim() ||
    (params.chainId === 1 || params.chainId === 11155111
      ? '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
      : '');

  if (configuredRegistry) {
    try {
      const resolver = await client.readContract({
        address: configuredRegistry as Address,
        abi: ENS_REGISTRY_ABI,
        functionName: 'resolver',
        args: [node],
      });
      if (resolver && resolver !== '0x0000000000000000000000000000000000000000') {
        return resolver as Address;
      }
    } catch {
      // fall through to configured resolver
    }
  }

  const configuredResolver = (getChainEnvVar('AGENTIC_TRUST_ENS_RESOLVER', params.chainId) || '').trim();
  return configuredResolver ? (configuredResolver as Address) : null;
}

async function uploadJsonPayload(payload: unknown, filename: string): Promise<string> {
  const ipfs = getIPFSStorage();
  const serialized = JSON.stringify(payload, null, 2);
  const uploaded = await ipfs.upload(serialized, filename);
  return uploaded.tokenUri;
}

async function loadJsonPayload(uri: string | null): Promise<unknown | null> {
  if (!uri) return null;
  const ipfs = getIPFSStorage();
  return await ipfs.getJson(uri);
}

export async function getEnsAgentMetadataBundle(params: {
  ensName: string;
  chainId: number;
}): Promise<{
  ensName: string;
  chainId: number;
  resolver: Address | null;
  metadata: EnsAgentMetadataRecord;
  rawProperties: Record<string, string | null>;
  payloads: {
    agentDocument: unknown | null;
    services: unknown | null;
    registrations: unknown | null;
  };
}> {
  const ensName = normalizeEnsName(params.ensName);
  const publicClient = await createEnsPublicClient(params.chainId);
  const metadata = await readEnsAgentMetadata({
    publicClient,
    ensName,
  });

  const parsed = parseEnsAgentMetadataRecords(metadata.properties);
  const payloads = {
    agentDocument: await loadJsonPayload(parsed.agentUri || null),
    services: await loadJsonPayload(parsed.services || null),
    registrations: await loadJsonPayload(parsed.registrations || null),
  };

  return {
    ensName,
    chainId: params.chainId,
    resolver: (metadata.resolver as Address | null) ?? (await resolveResolverAddress({ chainId: params.chainId, ensName })),
    metadata: parsed,
    rawProperties: metadata.properties,
    payloads,
  };
}

export async function prepareEnsAgentMetadataUpdate(params: {
  ensName: string;
  chainId: number;
  metadata: Partial<EnsAgentMetadataRecord>;
  servicesPayload?: EnsAgentServicesPayload | null;
  registrationsPayload?: EnsAgentRegistrationEntry[] | null;
  agentDocument?: EnsAgentCanonicalPayload | Record<string, unknown> | null;
  autoBuildAgentDocument?: boolean;
}): Promise<{
  ensName: string;
  chainId: number;
  resolver: Address;
  current: EnsAgentMetadataRecord;
  desired: Record<string, string>;
  delta: { changes: Record<string, string>; deleted: string[] };
  uploaded: {
    services?: string;
    registrations?: string;
    agentUri?: string;
  };
  calls: Array<{ to: Address; data: `0x${string}`; value: string }>;
}> {
  const ensName = normalizeEnsName(params.ensName);
  const currentBundle = await getEnsAgentMetadataBundle({
    ensName,
    chainId: params.chainId,
  });
  const resolver = currentBundle.resolver;
  if (!resolver) {
    throw new Error(`No resolver found for ${ensName} on chain ${params.chainId}.`);
  }

  const uploaded: {
    services?: string;
    registrations?: string;
    agentUri?: string;
  } = {};

  const desiredMetadata: Partial<EnsAgentMetadataRecord> = {
    ...currentBundle.metadata,
    ...params.metadata,
  };

  if (params.servicesPayload && Object.keys(params.servicesPayload).length > 0) {
    uploaded.services = await uploadJsonPayload(params.servicesPayload, `${ensName}-services.json`);
    desiredMetadata.services = uploaded.services;
  }

  if (params.registrationsPayload && params.registrationsPayload.length > 0) {
    uploaded.registrations = await uploadJsonPayload(
      params.registrationsPayload,
      `${ensName}-registrations.json`,
    );
    desiredMetadata.registrations = uploaded.registrations;
  }

  const shouldBuildAgentDocument = params.autoBuildAgentDocument !== false;
  const explicitAgentDocument = params.agentDocument ?? null;
  if (explicitAgentDocument || shouldBuildAgentDocument) {
    const canonicalDocument =
      explicitAgentDocument ??
      buildEnsAgentCanonicalPayload({
        metadata: desiredMetadata,
        servicesPayload: params.servicesPayload ?? undefined,
        registrationsPayload: params.registrationsPayload ?? undefined,
      });
    uploaded.agentUri = await uploadJsonPayload(canonicalDocument, `${ensName}-agent.json`);
    desiredMetadata.agentUri = uploaded.agentUri;
  }

  const desired = buildEnsAgentMetadataRecords(desiredMetadata);
  const delta = computeEnsAgentMetadataDelta({
    current: currentBundle.rawProperties,
    desired: desiredMetadata,
  });
  const node = namehash(ensName);

  const calls = [
    ...Object.entries(delta.changes).map(([key, value]: [string, string]) => ({
      to: resolver,
      data: encodeFunctionData({
        abi: ENS_RESOLVER_SET_TEXT_ABI,
        functionName: 'setText',
        args: [node, key, value],
      }),
      value: '0',
    })),
    ...delta.deleted.map((key: string) => ({
      to: resolver,
      data: encodeFunctionData({
        abi: ENS_RESOLVER_SET_TEXT_ABI,
        functionName: 'setText',
        args: [node, key, ''],
      }),
      value: '0',
    })),
  ];

  return {
    ensName,
    chainId: params.chainId,
    resolver,
    current: currentBundle.metadata,
    desired,
    delta,
    uploaded,
    calls,
  };
}
