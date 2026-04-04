import {
  buildDefaultEnsAgentRegistrationsPayload,
  buildEnsAgentServicesPayload,
  ENS_AGENT_CLASS,
  type EnsAgentRegistrationEntry,
  type EnsAgentServicesPayload,
} from '@agentic-trust/agentic-trust-sdk';
import { buildDidEthr } from './didEthr';

export type EnsRegistrationEndpoint = {
  name?: string | null;
  endpoint?: string | null;
  capabilities?: Record<string, unknown> | null;
};

export type PrepareEnsAgentMetadataRequest = {
  ensName: string;
  chainId: number;
  metadata: {
    class: string;
    name: string;
    description?: string;
    avatar?: string;
    active?: string;
    x402Support?: string;
    supportedTrust?: string[];
    agentWallet?: string;
  };
  servicesPayload: EnsAgentServicesPayload;
  registrationsPayload: EnsAgentRegistrationEntry[];
  autoBuildAgentDocument: true;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolText(value: boolean | string | null | undefined, fallback = ''): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === 'false') return trimmed;
  }
  return fallback;
}

function normalizeEnsFullName(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase();
  if (!trimmed) return '';
  return trimmed.endsWith('.eth') ? trimmed : `${trimmed}.eth`;
}

function findEndpoint(
  endpoints: EnsRegistrationEndpoint[] | undefined,
  names: string[],
): string {
  const targets = names.map((name) => name.trim().toLowerCase());
  for (const endpoint of endpoints ?? []) {
    const rawName = typeof endpoint?.name === 'string' ? endpoint.name.trim().toLowerCase() : '';
    if (!rawName || !targets.includes(rawName)) continue;
    const rawEndpoint = asTrimmedString(endpoint?.endpoint);
    if (rawEndpoint) return rawEndpoint;
  }
  return '';
}

function inferX402Support(endpoints: EnsRegistrationEndpoint[] | undefined): string {
  for (const endpoint of endpoints ?? []) {
    const capabilities = endpoint?.capabilities;
    if (!capabilities || typeof capabilities !== 'object') continue;
    const flag =
      (capabilities as Record<string, unknown>).x402Support ??
      (capabilities as Record<string, unknown>)['x402-support'];
    if (typeof flag === 'boolean') return flag ? 'true' : 'false';
    if (typeof flag === 'string') {
      const normalized = normalizeBoolText(flag);
      if (normalized) return normalized;
    }
  }
  return '';
}

export function buildEnsNameFromParts(agentName: string, orgName: string): string {
  const label = asTrimmedString(agentName).replace(/\.eth$/i, '');
  const org = asTrimmedString(orgName).replace(/\.eth$/i, '');
  return normalizeEnsFullName(`${label}.${org}`);
}

export function buildPrepareEnsAgentMetadataRequest(input: {
  ensName: string;
  chainId: number;
  agentName: string;
  agentWallet: string;
  agentUrl?: string | null;
  description?: string | null;
  image?: string | null;
  endpoints?: EnsRegistrationEndpoint[] | null;
  supportedTrust?: string[] | null;
  active?: boolean | string | null;
  x402Support?: boolean | string | null;
  agentId?: string | number | null;
  uaid?: string | null;
  agentDid?: string | null;
}): PrepareEnsAgentMetadataRequest {
  const ensName = normalizeEnsFullName(input.ensName);
  const agentWallet = asTrimmedString(input.agentWallet);
  const endpoints = Array.isArray(input.endpoints) ? input.endpoints : [];
  const webUrl = findEndpoint(endpoints, ['web']) || asTrimmedString(input.agentUrl);
  const a2aUrl =
    findEndpoint(endpoints, ['a2a']) ||
    (webUrl ? `${webUrl.replace(/\/+$/, '')}/.well-known/agent-card.json` : '');
  const mcpUrl = findEndpoint(endpoints, ['mcp']);
  const agentDid =
    asTrimmedString(input.agentDid) ||
    (input.chainId && agentWallet
      ? buildDidEthr(input.chainId, agentWallet as `0x${string}`, { encode: false })
      : '');

  const servicesPayload = buildEnsAgentServicesPayload({
    webUrl,
    a2aUrl,
    mcpUrl,
    ensName,
    agentDid,
  });

  const registrationsPayload = buildDefaultEnsAgentRegistrationsPayload({
    chainId: input.chainId,
    agentId: input.agentId,
    uaid: input.uaid,
    ensName,
    agentDid,
    agentWallet,
  });

  return {
    ensName,
    chainId: input.chainId,
    metadata: {
      class: ENS_AGENT_CLASS,
      name: asTrimmedString(input.agentName),
      description: asTrimmedString(input.description) || undefined,
      avatar: asTrimmedString(input.image) || undefined,
      active: normalizeBoolText(input.active, 'true'),
      x402Support: normalizeBoolText(input.x402Support, inferX402Support(endpoints)),
      supportedTrust: Array.isArray(input.supportedTrust)
        ? input.supportedTrust.map((value) => String(value).trim()).filter(Boolean)
        : undefined,
      agentWallet: agentWallet || undefined,
    },
    servicesPayload,
    registrationsPayload,
    autoBuildAgentDocument: true,
  };
}
