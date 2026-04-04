import { createPublicClient, http, zeroAddress, type Chain, type PublicClient } from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { toHex } from 'viem';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { sendSponsoredUserOperation, waitForUserOperationReceipt } from './accountClient';
import { getChainBundlerUrl, getChainById, getChainRpcUrl } from '../server/lib/chainConfig';
import type { SessionPackageSessionKey } from '../shared/sessionPackage';

export type CreateSessionKeyAndSessionAccountParams = {
  chainId: number;
  rpcUrl?: string;
  bundlerUrl?: string;
  entryPoint?: `0x${string}`;
  sessionPrivateKey?: `0x${string}`;
  deploySalt?: `0x${string}`;
  /**
   * When true, sends a sponsored userOp to deploy the session account if not deployed.
   * Defaults to true.
   */
  ensureSessionAccountDeployed?: boolean;
  /**
   * When true, checks bytecode and deploys if missing.
   * When false, always returns counterfactual sessionAA without network calls beyond address computation.
   */
  checkDeployment?: boolean;
  validAfter?: number;
  validUntil?: number;
};

export type SessionAccountInitArtifacts = {
  chainId: number;
  chain: Chain;
  rpcUrl: string;
  bundlerUrl: string;
  entryPoint: `0x${string}`;
  publicClient: PublicClient;
  sessionPrivateKey: `0x${string}`;
  sessionKeyAccount: PrivateKeyAccount;
  sessionKey: SessionPackageSessionKey;
  sessionAccountClient: any;
  sessionAA: `0x${string}`;
};

/**
 * A minimal DTO safe to send to an untrusted client.
 */
export type SessionAccountInitPublic = {
  chainId: number;
  sessionAA: `0x${string}`;
};

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function createSessionKeyAndSessionAccount(
  params: CreateSessionKeyAndSessionAccountParams,
): Promise<{ artifacts: SessionAccountInitArtifacts; pub: SessionAccountInitPublic }> {
  const {
    chainId,
    rpcUrl: rpcUrlOverride,
    bundlerUrl: bundlerUrlOverride,
    entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    sessionPrivateKey: sessionPrivateKeyOverride,
    deploySalt = toHex(10),
    ensureSessionAccountDeployed = true,
    checkDeployment = true,
    validAfter: validAfterOverride,
    validUntil: validUntilOverride,
  } = params;

  const rpcUrl = rpcUrlOverride ?? getChainRpcUrl(chainId);
  if (!rpcUrl) throw new Error(`Missing RPC URL for chain ${chainId}`);

  const bundlerUrl = bundlerUrlOverride ?? getChainBundlerUrl(chainId);
  if (!bundlerUrl) throw new Error(`Missing bundler URL for chain ${chainId}`);

  const chain = getChainById(chainId) as Chain;
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const sessionPrivateKey = sessionPrivateKeyOverride ?? generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);

  const now = nowSec();
  const validAfter = validAfterOverride ?? Math.max(0, now - 60);
  const validUntil = validUntilOverride ?? now + 60 * 60 * 24 * 365 * 2;

  const sessionAccountClient = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [sessionKeyAccount.address as `0x${string}`, [], [], []],
    signer: { account: sessionKeyAccount },
    deploySalt,
  } as any);

  const sessionAA = (await sessionAccountClient.getAddress()) as `0x${string}`;

  if (ensureSessionAccountDeployed) {
    const shouldCheck = checkDeployment;
    const deployed = shouldCheck
      ? (() => publicClient.getBytecode({ address: sessionAA }).then((c) => !!c && c !== '0x'))()
      : Promise.resolve(false);

    const isDeployed = await deployed;
    if (!isDeployed) {
      const hash = await sendSponsoredUserOperation({
        bundlerUrl,
        chain,
        accountClient: sessionAccountClient as any,
        calls: [{ to: zeroAddress }],
      });
      await waitForUserOperationReceipt({ bundlerUrl, chain, hash });
    }
  }

  const artifacts: SessionAccountInitArtifacts = {
    chainId,
    chain,
    rpcUrl,
    bundlerUrl,
    entryPoint,
    publicClient,
    sessionPrivateKey,
    sessionKeyAccount,
    sessionKey: {
      privateKey: sessionPrivateKey,
      address: sessionKeyAccount.address as `0x${string}`,
      validAfter,
      validUntil,
    },
    sessionAccountClient,
    sessionAA,
  };

  return {
    artifacts,
    pub: { chainId, sessionAA },
  };
}

