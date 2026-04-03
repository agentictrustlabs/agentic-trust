import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { A2AOnlySessionPackage } from '../shared/sessionPackage';

function didEthrNetworkForChainId(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'mainnet';
    case 11155111:
      return 'sepolia';
    case 84532:
      return 'baseSepolia';
    case 11155420:
      return 'optimismSepolia';
    case 59144:
      return 'linea';
    case 59141:
      return 'lineaSepolia';
    default:
      return String(chainId);
  }
}

export async function generateA2AOnlySessionPackage(params: {
  chainId: number;
  agentAccount?: `0x${string}`;
  /** Defaults to 2 years */
  validForSeconds?: number;
}): Promise<A2AOnlySessionPackage> {
  const chainId = Number(params.chainId);
  if (!Number.isFinite(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId: ${String(params.chainId)}`);
  }

  const sessionPrivateKey = generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
  const nowSec = Math.floor(Date.now() / 1000);
  const validAfter = Math.max(0, nowSec - 60);
  const validUntil =
    nowSec + Math.max(60, Math.floor(params.validForSeconds ?? 60 * 60 * 24 * 365 * 2));

  const network = didEthrNetworkForChainId(chainId);
  const did = `did:ethr:${network}:${sessionKeyAccount.address}`;

  return {
    kind: 'a2a-only',
    chainId,
    agentAccount: params.agentAccount,
    did,
    sessionKey: {
      privateKey: sessionPrivateKey,
      address: sessionKeyAccount.address as `0x${string}`,
      validAfter,
      validUntil,
    },
  };
}

