import { addToL1OrgPK, setL1NameInfoPK } from '../../server/lib/names';
import { getAgenticTrustClient } from '../../server/lib/agenticTrust';
import {
  getEnsAgentLookup,
  toJsonSafe,
  toJsonSafeCalls,
  toJsonSafeReceipt,
} from '../../server/lib/ensAdmin';

const hasNativeResponse =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as Record<string, unknown>).Response === 'function';

function jsonResponse(body: unknown, status = 200) {
  const safeBody = toJsonSafe(body);
  if (hasNativeResponse) {
    const ResponseCtor = (globalThis as Record<string, any>).Response;
    return new ResponseCtor(JSON.stringify(safeBody), {
      status,
      headers: {
        'content-type': 'application/json',
      },
    });
  }

  return {
    status,
    body: safeBody,
    headers: { 'content-type': 'application/json' },
  } as unknown;
}

function errorResponse(error: unknown, fallbackMessage: string, status = 500) {
  return jsonResponse(
    {
      error: fallbackMessage,
      message: error instanceof Error ? error.message : 'Unknown error',
    },
    status,
  );
}

export function ensAgentLookupRouteHandler() {
  return async (request: Request) => {
    try {
      const url = new URL(request.url);
      const name = url.searchParams.get('name') || '';
      const orgName = url.searchParams.get('org') || '8004-agent.eth';
      const chainIdRaw = url.searchParams.get('chainId') || '59144';
      const chainId = Number(chainIdRaw);

      const result = await getEnsAgentLookup({ name, orgName, chainId });
      return jsonResponse(result);
    } catch (error) {
      return errorResponse(
        error,
        'ENS lookup failed (check your AGENTIC_TRUST_ENS_REGISTRY_* / AGENTIC_TRUST_ENS_RESOLVER_* env vars are set to contract addresses)',
      );
    }
  };
}

export function prepareL1NameInfoRouteHandler() {
  return async (request: Request) => {
    try {
      const { agentName, orgName, agentAddress, agentUrl, agentDescription, chainId } = await request.json() as any;

      if (!agentName || !orgName || !agentAddress) {
        return jsonResponse(
          { error: 'Missing required fields: agentName, orgName, and agentAddress' },
          400,
        );
      }

      const client = await getAgenticTrustClient();
      const result = await client.prepareL1AgentNameInfoCalls({
        agentAddress,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        ...(typeof chainId === 'number' ? { chainId } : {}),
      });

      return jsonResponse({
        success: true,
        calls: toJsonSafeCalls(result.calls),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to prepare ENS agent info calls');
    }
  };
}

export function prepareL2NameInfoRouteHandler() {
  return async (request: Request) => {
    try {
      const { agentName, orgName, agentAddress, agentUrl, agentDescription, chainId } = await request.json() as any;

      if (!agentName || !orgName || !agentAddress) {
        return jsonResponse(
          { error: 'Missing required fields: agentName, orgName, and agentAddress' },
          400,
        );
      }

      const client = await getAgenticTrustClient();
      const result = await client.prepareL2AgentNameInfoCalls({
        agentAddress,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        ...(typeof chainId === 'number' ? { chainId } : {}),
      });

      return jsonResponse({
        success: true,
        calls: toJsonSafeCalls(result.calls),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to prepare ENS agent info calls');
    }
  };
}

export function addToL1OrgRouteHandler() {
  return async (request: Request) => {
    try {
      const body = await request.json() as any;
      const { agentAccount, orgName, agentName, agentUrl, chainId } = body ?? {};

      if (!agentName || typeof agentName !== 'string') {
        return jsonResponse({ error: 'agentName is required' }, 400);
      }
      if (!orgName || typeof orgName !== 'string') {
        return jsonResponse({ error: 'orgName is required' }, 400);
      }
      if (!agentAccount || typeof agentAccount !== 'string' || !agentAccount.startsWith('0x')) {
        return jsonResponse({ error: 'agentAccount must be a valid 0x-prefixed address' }, 400);
      }

      const client = await getAgenticTrustClient();
      const result = await client.addAgentNameToL1Org({
        agentAddress: agentAccount as `0x${string}`,
        orgName,
        agentName,
        agentUrl,
        chainId,
      });

      return jsonResponse({
        success: true,
        message: result,
      });
    } catch (error) {
      return jsonResponse(
        {
          error: 'Failed to add agent name to ENS org',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        531,
      );
    }
  };
}

export function addToL2OrgRouteHandler() {
  return async (request: Request) => {
    try {
      const body = await request.json() as any;
      const {
        agentAddress,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        agentImage,
        chainId,
      } = body ?? {};

      if (!agentAddress || !orgName || !agentName) {
        return jsonResponse(
          { error: 'Missing required fields: agentAddress, orgName, and agentName' },
          400,
        );
      }

      const client = await getAgenticTrustClient();
      const result = await client.addAgentNameToL2Org({
        agentAddress,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        agentImage,
        chainId,
      });

      return jsonResponse({
        success: true,
        calls: toJsonSafeCalls(result.calls),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isAlreadyRegistered = message === 'ENS name is already registered.';
      return jsonResponse(
        {
          error: isAlreadyRegistered ? 'ENS name is already registered' : 'Failed to prepare L2 ENS calls',
          message,
        },
        isAlreadyRegistered ? 409 : 500,
      );
    }
  };
}

export function setL1NameInfoPkRouteHandler() {
  return async (request: Request) => {
    try {
      const body = await request.json() as any;
      const {
        agentAddress,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        chainId,
      } = body ?? {};

      if (!agentAddress || !orgName || !agentName) {
        return jsonResponse(
          { error: 'Missing required fields: agentAddress, orgName, agentName' },
          400,
        );
      }

      const targetChainId = chainId ? Number(chainId) : 11155111;
      const { userOpHash, receipt } = await setL1NameInfoPK({
        agentAddress: agentAddress as `0x${string}`,
        orgName,
        agentName,
        agentUrl,
        agentDescription,
        chainId: targetChainId,
      });

      return jsonResponse({
        success: true,
        userOpHash,
        receipt: toJsonSafeReceipt(receipt),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to set L1 name info (server PK)');
    }
  };
}

export function addToL1OrgPkRouteHandler() {
  return async (request: Request) => {
    try {
      const body = await request.json() as any;
      const {
        orgName,
        agentName,
        agentAddress,
        agentUrl,
        chainId,
      } = body ?? {};

      if (!orgName || !agentName || !agentAddress) {
        return jsonResponse(
          { error: 'Missing required fields: orgName, agentName, agentAddress' },
          400,
        );
      }

      const targetChainId = chainId ? Number(chainId) : 11155111;
      const { userOpHash, receipt } = await addToL1OrgPK({
        orgName,
        agentName,
        agentAddress: agentAddress as `0x${string}`,
        agentUrl,
        chainId: targetChainId,
      });

      return jsonResponse({
        success: true,
        userOpHash,
        receipt: toJsonSafeReceipt(receipt),
      });
    } catch (error) {
      return errorResponse(error, 'Failed to add agent name to L1 org (server PK)');
    }
  };
}
