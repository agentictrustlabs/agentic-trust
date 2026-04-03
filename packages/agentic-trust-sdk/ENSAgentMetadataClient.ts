import { computeDelta, metadataReader } from '@ensmetadata/sdk';

export const ENS_AGENT_CLASS = 'Agent';
export const ENS_AGENT_SCHEMA_VERSION = '2.0.0';

export const ENS_AGENT_METADATA_KEYS = [
  'class',
  'schema',
  'agent-uri',
  'name',
  'description',
  'avatar',
  'services',
  'x402-support',
  'active',
  'registrations',
  'supported-trust',
  'agent-wallet',
] as const;

export type EnsAgentMetadataKey = (typeof ENS_AGENT_METADATA_KEYS)[number];

export type EnsAgentServiceEndpoint = {
  url: string;
  label?: string;
  description?: string;
  auth?: string;
  format?: string;
  [key: string]: unknown;
};

export type EnsAgentServicesPayload = {
  web?: EnsAgentServiceEndpoint | null;
  mcp?: EnsAgentServiceEndpoint | null;
  a2a?: EnsAgentServiceEndpoint | null;
  [key: string]: unknown;
};

export type EnsAgentRegistrationEntry = {
  system?: string;
  chain?: string;
  id?: string;
  registry?: string;
  [key: string]: unknown;
};

export type EnsAgentMetadataRecord = {
  class: string;
  schema: string;
  agentUri: string;
  name: string;
  description: string;
  avatar: string;
  services: string;
  x402Support: string;
  active: string;
  registrations: string;
  supportedTrust: string[];
  agentWallet: string;
};

export type EnsAgentCanonicalPayload = {
  type: string;
  name: string;
  description?: string;
  image?: string;
  services?: EnsAgentServicesPayload;
  servicesUri?: string;
  x402Support?: boolean;
  active?: boolean;
  registrations?: EnsAgentRegistrationEntry[];
  registrationsUri?: string;
  supportedTrust?: string[];
  agentWallet?: string;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // fall through
  }
  return trimmed
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeSupportedTrust(values: string[]): string {
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) return '';
  if (normalized.length === 1) return normalized[0]!;
  return JSON.stringify(normalized);
}

export function parseEnsAgentMetadataRecords(
  properties: Record<string, string | null | undefined>,
): EnsAgentMetadataRecord {
  return {
    class: asTrimmedString(properties.class) || ENS_AGENT_CLASS,
    schema: asTrimmedString(properties.schema),
    agentUri: asTrimmedString(properties['agent-uri']),
    name: asTrimmedString(properties.name),
    description: asTrimmedString(properties.description),
    avatar: asTrimmedString(properties.avatar),
    services: asTrimmedString(properties.services),
    x402Support: asTrimmedString(properties['x402-support']),
    active: asTrimmedString(properties.active),
    registrations: asTrimmedString(properties.registrations),
    supportedTrust: parseStringArray(properties['supported-trust']),
    agentWallet: asTrimmedString(properties['agent-wallet']),
  };
}

export function buildEnsAgentMetadataRecords(
  metadata: Partial<EnsAgentMetadataRecord>,
): Record<string, string> {
  const normalized: EnsAgentMetadataRecord = {
    class: asTrimmedString(metadata.class) || ENS_AGENT_CLASS,
    schema: asTrimmedString(metadata.schema),
    agentUri: asTrimmedString(metadata.agentUri),
    name: asTrimmedString(metadata.name),
    description: asTrimmedString(metadata.description),
    avatar: asTrimmedString(metadata.avatar),
    services: asTrimmedString(metadata.services),
    x402Support: asTrimmedString(metadata.x402Support),
    active: asTrimmedString(metadata.active),
    registrations: asTrimmedString(metadata.registrations),
    supportedTrust: Array.isArray(metadata.supportedTrust) ? metadata.supportedTrust : [],
    agentWallet: asTrimmedString(metadata.agentWallet),
  };

  return {
    class: normalized.class,
    schema: normalized.schema,
    'agent-uri': normalized.agentUri,
    name: normalized.name,
    description: normalized.description,
    avatar: normalized.avatar,
    services: normalized.services,
    'x402-support': normalized.x402Support,
    active: normalized.active,
    registrations: normalized.registrations,
    'supported-trust': serializeSupportedTrust(normalized.supportedTrust),
    'agent-wallet': normalized.agentWallet,
  };
}

export function buildEnsAgentServicesPayload(input: {
  webUrl?: string;
  mcpUrl?: string;
  a2aUrl?: string;
  web?: EnsAgentServiceEndpoint | null;
  mcp?: EnsAgentServiceEndpoint | null;
  a2a?: EnsAgentServiceEndpoint | null;
}): EnsAgentServicesPayload {
  const payload: EnsAgentServicesPayload = {};
  const webUrl = asTrimmedString(input.webUrl);
  const mcpUrl = asTrimmedString(input.mcpUrl);
  const a2aUrl = asTrimmedString(input.a2aUrl);
  if (input.web || webUrl) payload.web = input.web ?? { url: webUrl };
  if (input.mcp || mcpUrl) payload.mcp = input.mcp ?? { url: mcpUrl };
  if (input.a2a || a2aUrl) payload.a2a = input.a2a ?? { url: a2aUrl };
  return payload;
}

export function buildEnsAgentCanonicalPayload(input: {
  metadata: Partial<EnsAgentMetadataRecord>;
  servicesPayload?: EnsAgentServicesPayload | null;
  registrationsPayload?: EnsAgentRegistrationEntry[] | null;
}): EnsAgentCanonicalPayload {
  const normalized = parseEnsAgentMetadataRecords(
    buildEnsAgentMetadataRecords(input.metadata as Partial<EnsAgentMetadataRecord>),
  );

  const payload: EnsAgentCanonicalPayload = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: normalized.name,
  };

  if (normalized.description) payload.description = normalized.description;
  if (normalized.avatar) payload.image = normalized.avatar;
  if (normalized.services) payload.servicesUri = normalized.services;
  if (input.servicesPayload && Object.keys(input.servicesPayload).length > 0) {
    payload.services = input.servicesPayload;
  }
  if (normalized.x402Support) payload.x402Support = normalized.x402Support === 'true';
  if (normalized.active) payload.active = normalized.active === 'true';
  if (normalized.registrations) payload.registrationsUri = normalized.registrations;
  if (input.registrationsPayload && input.registrationsPayload.length > 0) {
    payload.registrations = input.registrationsPayload;
  }
  if (normalized.supportedTrust.length > 0) payload.supportedTrust = normalized.supportedTrust;
  if (normalized.agentWallet) payload.agentWallet = normalized.agentWallet;

  return payload;
}

export async function readEnsAgentMetadata(params: {
  publicClient: unknown;
  ensName: string;
}) {
  const reader = metadataReader()(params.publicClient as any);
  const metadata = await reader.getMetadata({
    name: params.ensName,
    keys: [...ENS_AGENT_METADATA_KEYS],
  });
  const parsed = parseEnsAgentMetadataRecords(metadata.properties);
  return {
    ...metadata,
    parsed,
  };
}

export function computeEnsAgentMetadataDelta(params: {
  current: Record<string, string | null | undefined>;
  desired: Partial<EnsAgentMetadataRecord>;
}) {
  const currentRecords = buildEnsAgentMetadataRecords(parseEnsAgentMetadataRecords(params.current));
  const desiredRecords = buildEnsAgentMetadataRecords(params.desired);
  return computeDelta(currentRecords, desiredRecords);
}
