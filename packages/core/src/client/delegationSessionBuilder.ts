import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  zeroAddress,
  encodeFunctionData,
  parseAbi,
  keccak256,
  stringToHex,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { toHex } from 'viem';
import {
  toMetaMaskSmartAccount,
  Implementation,
  createDelegation,
  getSmartAccountsEnvironment,
  ExecutionMode,
} from '@metamask/smart-accounts-kit';
// @ts-ignore - contracts subpath may not be in main type definitions
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts';
import IdentityRegistryAbi from '@agentic-trust/agentic-trust-sdk/abis/IdentityRegistry.json';
import ValidationRegistryAbi from '@agentic-trust/agentic-trust-sdk/abis/ValidationRegistry.json';

import type {
  BaseDelegationSessionPackage,
  Erc8004SessionPackage,
  SessionPackage,
  SessionPackageScDelegation,
  SessionPackageSessionKey,
  SignedDelegation,
  SmartAgentDelegationSessionPackage,
} from '../shared/sessionPackage';
import {
  getChainRpcUrl,
  getChainBundlerUrl,
  getChainIdHex,
  getChainConfig,
  getChainById,
} from '../server/lib/chainConfig';
import { sendSponsoredUserOperation, waitForUserOperationReceipt } from './accountClient';
import { createSessionKeyAndSessionAccount } from './sessionAccountInit';
import { signAgentDelegation } from './delegationSigning';

export const DEFAULT_SELECTOR = encodeFunctionData({
  abi: ValidationRegistryAbi as any,
  functionName: 'validationResponse',
  args: [
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    0,
    '',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    '',
  ],
}).slice(0, 10) as `0x${string}`;

export const DEFAULT_ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

function normalizeHex(value?: string | null): `0x${string}` | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('0x') ? (trimmed as `0x${string}`) : (`0x${trimmed}` as `0x${string}`);
}

function getIdentityRegistryAddress(chainId: number): `0x${string}` | undefined {
  const cfg = getChainConfig(chainId);
  if (!cfg) return undefined;
  const key = `NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY_${cfg.suffix}`;
  return normalizeHex(process.env[key] ?? process.env.NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY ?? undefined);
}

function getValidationRegistryAddress(chainId: number): `0x${string}` | undefined {
  const cfg = getChainConfig(chainId);
  if (!cfg) return undefined;
  const key = `NEXT_PUBLIC_AGENTIC_TRUST_VALIDATION_REGISTRY_${cfg.suffix}`;
  return normalizeHex(process.env[key] ?? process.env.NEXT_PUBLIC_AGENTIC_TRUST_VALIDATION_REGISTRY ?? undefined);
}

function getAssociationsProxyAddress(chainId: number, override?: `0x${string}`): `0x${string}` | undefined {
  if (override) return override;
  if (chainId === 11155111) {
    return normalizeHex(process.env.NEXT_PUBLIC_ASSOCIATIONS_STORE_PROXY_SEPOLIA ?? undefined);
  }
  return undefined;
}

async function switchChain(provider: any, chainId: number, rpcUrl: string) {
  const chainIdHex = getChainIdHex(chainId);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    if (error?.code === 4902) {
      const chainConfig = getChainConfig(chainId);
      const chainName = chainConfig?.displayName ?? `Chain ${chainId}`;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName,
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [rpcUrl],
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export type CreateSessionWalletAndAccountParams = {
  chainId: number;
  agentAccount: `0x${string}`;
  provider: any;
  ownerAddress: `0x${string}`;
  bundlerUrl?: string;
  rpcUrl?: string;
  entryPoint?: `0x${string}`;
  sessionPrivateKey?: `0x${string}`;
  deploySalt?: `0x${string}`;
  ensureAgentAccountDeployed?: boolean;
  ensureSessionAccountDeployed?: boolean;
};

export type SessionWalletAndAccountArtifacts = {
  chainId: number;
  chain: Chain;
  rpcUrl: string;
  bundlerUrl: string;
  entryPoint: `0x${string}`;
  publicClient: PublicClient;
  walletClient: WalletClient;
  smartAccount: any;
  agentAccount: `0x${string}`;
  ownerAddress: `0x${string}`;
  sessionPrivateKey: `0x${string}`;
  sessionKeyAccount: PrivateKeyAccount;
  sessionKey: SessionPackageSessionKey;
  sessionAccountClient: any;
  sessionAA: `0x${string}`;
};

export async function createSessionWalletAndAccount(
  params: CreateSessionWalletAndAccountParams,
): Promise<SessionWalletAndAccountArtifacts> {
  const {
    chainId,
    agentAccount,
    provider,
    ownerAddress,
    rpcUrl: rpcUrlOverride,
    bundlerUrl: bundlerUrlOverride,
    entryPoint = DEFAULT_ENTRY_POINT,
    sessionPrivateKey: sessionPrivateKeyOverride,
    deploySalt = toHex(10),
    ensureAgentAccountDeployed = true,
    ensureSessionAccountDeployed = true,
  } = params;

  if (!provider) {
    throw new Error('An EIP-1193 provider is required to create a delegation session.');
  }
  if (!ownerAddress) {
    throw new Error('Wallet address is required to create a delegation session.');
  }
  if (!agentAccount) {
    throw new Error('Agent account is required to create a delegation session.');
  }

  const rpcUrl = rpcUrlOverride ?? getChainRpcUrl(chainId);
  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for chain ${chainId}`);
  }

  const bundlerUrl = bundlerUrlOverride ?? getChainBundlerUrl(chainId);
  if (!bundlerUrl) {
    throw new Error(`Missing bundler URL for chain ${chainId}`);
  }

  await switchChain(provider, chainId, rpcUrl);
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const chain = getChainById(chainId) as Chain;
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain,
    transport: custom(provider),
    account: ownerAddress as Address,
  });

  const smartAccount = await toMetaMaskSmartAccount({
    address: agentAccount,
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    signer: {
      walletClient: walletClient as any,
    },
  } as any);

  if (ensureAgentAccountDeployed) {
    const aaCode = await publicClient.getBytecode({ address: agentAccount });
    const aaDeployed = !!aaCode && aaCode !== '0x';
    if (!aaDeployed) {
      const hash = await sendSponsoredUserOperation({
        bundlerUrl,
        chain,
        accountClient: smartAccount as any,
        calls: [{ to: zeroAddress }],
      });
      await waitForUserOperationReceipt({ bundlerUrl, chain, hash });
    }
  }

  const sessionPrivateKey = sessionPrivateKeyOverride ?? generatePrivateKey();
  const sessionKeyAccount = privateKeyToAccount(sessionPrivateKey);
  const nowSec = Math.floor(Date.now() / 1000);
  const validAfter = Math.max(0, nowSec - 60);
  const validUntil = nowSec + 60 * 60 * 24 * 365 * 2;

  const sessionAccountClient = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    deployParams: [sessionKeyAccount.address as `0x${string}`, [], [], []],
    signer: { account: sessionKeyAccount },
    deploySalt,
  } as any);

  const sessionAA = (await sessionAccountClient.getAddress()) as `0x${string}`;

  if (ensureSessionAccountDeployed) {
    const sessionCode = await publicClient.getBytecode({ address: sessionAA });
    const sessionDeployed = !!sessionCode && sessionCode !== '0x';
    if (!sessionDeployed) {
      const hash = await sendSponsoredUserOperation({
        bundlerUrl,
        chain,
        accountClient: sessionAccountClient as any,
        calls: [{ to: zeroAddress }],
      });
      await waitForUserOperationReceipt({ bundlerUrl, chain, hash });
    }
  }

  return {
    chainId,
    chain,
    rpcUrl,
    bundlerUrl,
    entryPoint,
    publicClient,
    walletClient,
    smartAccount,
    agentAccount,
    ownerAddress,
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
}

function getAssociationSelectors(): `0x${string}`[] {
  const storeAssociationSignature =
    'storeAssociation((uint40,bytes2,bytes2,bytes,bytes,(bytes,bytes,uint40,uint40,bytes4,bytes)))';
  const updateAssociationSignaturesSignature = 'updateAssociationSignatures(bytes32,bytes,bytes)';
  const getAssociationSignature = 'getAssociation(bytes32)';

  return [
    keccak256(stringToHex(storeAssociationSignature)).slice(0, 10) as `0x${string}`,
    keccak256(stringToHex(updateAssociationSignaturesSignature)).slice(0, 10) as `0x${string}`,
    keccak256(stringToHex(getAssociationSignature)).slice(0, 10) as `0x${string}`,
  ];
}

function getIsValidSignatureSelector(): `0x${string}` {
  return keccak256(stringToHex('isValidSignature(bytes32,bytes)')).slice(0, 10) as `0x${string}`;
}

export const SMART_AGENT_DEFAULT_SELECTOR = getIsValidSignatureSelector();

export type BuildAgentDelegationParams = {
  session: SessionWalletAndAccountArtifacts;
  selector?: `0x${string}`;
  validationRegistry?: `0x${string}`;
  associationsProxy?: `0x${string}`;
  includeValidationScope?: boolean;
  includeAssociationScope?: boolean;
  includeAgentAccountSignatureScope?: boolean;
  performDelegationTest?: boolean;
};

export type AgentDelegationArtifacts = {
  selector: `0x${string}`;
  targets: `0x${string}`[];
  selectors: `0x${string}`[];
  signedDelegation: SignedDelegation;
  scDelegation?: SessionPackageScDelegation;
  delegationRedeemData?: `0x${string}`;
};

export async function buildAgentDelegation(
  params: BuildAgentDelegationParams,
): Promise<AgentDelegationArtifacts> {
  const {
    session,
    selector = DEFAULT_SELECTOR,
    validationRegistry: validationRegistryOverride,
    associationsProxy: associationsProxyOverride,
    includeValidationScope = true,
    includeAssociationScope = true,
    includeAgentAccountSignatureScope = true,
    performDelegationTest = true,
  } = params;

  const { chainId, agentAccount, publicClient, smartAccount, sessionAA, chain, bundlerUrl, sessionKeyAccount } =
    session;

  const deleGatorEnv = getSmartAccountsEnvironment(chainId);
  let hybridDelegatorAddress = (deleGatorEnv.implementations as any)?.HybridDeleGatorImpl as
    | `0x${string}`
    | undefined;

  if (!hybridDelegatorAddress) {
    const accountImpl =
      (smartAccount as any).implementationAddress ||
      (smartAccount as any).implementation?.address ||
      (smartAccount as any).getImplementationAddress?.();
    if (accountImpl) {
      hybridDelegatorAddress = accountImpl as `0x${string}`;
    }
  }

  if (!hybridDelegatorAddress) {
    throw new Error(
      `HybridDeleGator address not found for chainId ${chainId}. ` +
        `DeleGatorEnvironment: ${JSON.stringify({
          EntryPoint: deleGatorEnv.EntryPoint,
          implementations: deleGatorEnv.implementations,
        })}.`,
    );
  }

  const validationRegistry = includeValidationScope
    ? validationRegistryOverride ?? getValidationRegistryAddress(chainId)
    : undefined;
  if (includeValidationScope && !validationRegistry) {
    throw new Error(
      `Missing ValidationRegistry address for chain ${chainId}. ` +
        `Set NEXT_PUBLIC_AGENTIC_TRUST_VALIDATION_REGISTRY or NEXT_PUBLIC_AGENTIC_TRUST_VALIDATION_REGISTRY_<CHAIN_SUFFIX> in your env.`,
    );
  }

  const targets: Array<`0x${string}`> = [];
  if (validationRegistry) {
    targets.push(validationRegistry);
  }
  if (includeAgentAccountSignatureScope) {
    targets.push(agentAccount);
  }

  let scDelegation: SessionPackageScDelegation | undefined;
  const associationsProxy = includeAssociationScope
    ? getAssociationsProxyAddress(chainId, associationsProxyOverride)
    : undefined;
  if (includeAssociationScope && !associationsProxy) {
    const cfg = getChainConfig(chainId);
    const suffix = cfg?.suffix ?? String(chainId);
    throw new Error(
      `Missing AssociationsStore proxy for chain ${chainId}. ` +
        `Set NEXT_PUBLIC_ASSOCIATIONS_STORE_PROXY_${suffix}=0x3d282c9E5054E3d819639246C177676A98cB0a1E`,
    );
  }

  if (associationsProxy) {
    targets.push(associationsProxy);
    const delegationManager = (await publicClient.readContract({
      address: associationsProxy,
      abi: parseAbi(['function delegationManager() view returns (address)']),
      functionName: 'delegationManager',
      args: [],
    })) as `0x${string}`;
    const scDelegationEnforcer = (await publicClient.readContract({
      address: associationsProxy,
      abi: parseAbi(['function scDelegationEnforcer() view returns (address)']),
      functionName: 'scDelegationEnforcer',
      args: [],
    })) as `0x${string}`;
    const scDelegationVerifier = (await publicClient.readContract({
      address: associationsProxy,
      abi: parseAbi(['function scDelegationVerifier() view returns (address)']),
      functionName: 'scDelegationVerifier',
      args: [],
    })) as `0x${string}`;

    if (!delegationManager || delegationManager === zeroAddress) {
      throw new Error('AssociationsStore proxy has delegationManager=0x0. SC-DELEGATION is not configured.');
    }
    if (!scDelegationEnforcer || scDelegationEnforcer === zeroAddress) {
      throw new Error('AssociationsStore proxy has scDelegationEnforcer=0x0. SC-DELEGATION is not configured.');
    }
    if (!scDelegationVerifier || scDelegationVerifier === zeroAddress) {
      throw new Error('AssociationsStore proxy has scDelegationVerifier=0x0. SC-DELEGATION is not configured.');
    }

    scDelegation = {
      associationsStoreProxy: associationsProxy,
      delegationManager,
      scDelegationEnforcer,
      scDelegationVerifier,
    };
  }

  const selectors = new Set<`0x${string}`>();
  if (validationRegistry) {
    selectors.add(selector);
    selectors.add(
      encodeFunctionData({
        abi: ValidationRegistryAbi as any,
        functionName: 'getIdentityRegistry',
        args: [],
      }).slice(0, 10) as `0x${string}`,
    );
  }
  if (associationsProxy) {
    for (const associationSelector of getAssociationSelectors()) {
      selectors.add(associationSelector);
    }
  }
  if (includeAgentAccountSignatureScope) {
    selectors.add(getIsValidSignatureSelector());
  }

  const delegation = createDelegation({
    environment: deleGatorEnv,
    scope: {
      type: 'functionCall',
      targets,
      selectors: Array.from(selectors),
    },
    from: agentAccount,
    to: sessionAA,
    caveats: [],
  });

  const signature = (await (smartAccount as any).signDelegation({
    delegation,
  })) as `0x${string}`;

  const signedDelegation = {
    ...delegation,
    signature,
  } as SignedDelegation;

  let delegationRedeemData: `0x${string}` | undefined;

  if (performDelegationTest && validationRegistry) {
    try {
      const sessionAccountClient = await toMetaMaskSmartAccount({
        address: sessionAA,
        client: publicClient as any,
        implementation: Implementation.Hybrid,
        signer: { account: sessionKeyAccount },
        delegation: {
          delegation: signedDelegation,
          delegator: agentAccount,
        },
      } as any);

      const testCallData = encodeFunctionData({
        abi: ValidationRegistryAbi as any,
        functionName: 'getIdentityRegistry',
        args: [],
      });

      const delegationMessage = {
        delegate: (signedDelegation as any).delegate,
        delegator: (signedDelegation as any).delegator,
        authority: (signedDelegation as any).authority,
        caveats: (signedDelegation as any).caveats,
        salt: (signedDelegation as any).salt,
        signature: (signedDelegation as any).signature,
      };

      const includedExecutions = [
        {
          target: validationRegistry,
          value: BigInt(0),
          callData: testCallData,
        },
      ];

      delegationRedeemData = DelegationManager.encode.redeemDelegations({
        delegations: [[delegationMessage]],
        modes: [ExecutionMode.SingleDefault],
        executions: [includedExecutions],
      }) as `0x${string}`;

      const testHash = await sendSponsoredUserOperation({
        bundlerUrl,
        chain,
        accountClient: sessionAccountClient as any,
        calls: [
          {
            to: sessionAA,
            data: delegationRedeemData,
            value: 0n,
          },
        ],
      });
      await waitForUserOperationReceipt({ bundlerUrl, chain, hash: testHash });

      await publicClient.readContract({
        address: validationRegistry,
        abi: ValidationRegistryAbi as any,
        functionName: 'getIdentityRegistry',
        args: [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('Invalid Smart Account nonce') ||
        message.includes('AA25 invalid account deployment')
      ) {
        console.warn('*********** sessionPackageBuilder: Delegation test skipped:', message);
      } else {
        throw new Error(`Delegation test failed: ${message}`);
      }
    }
  }

  return {
    selector,
    targets,
    selectors: Array.from(selectors),
    signedDelegation,
    scDelegation,
    delegationRedeemData,
  };
}

export async function approveErc8004SessionOperator(params: {
  agentId: number;
  identityRegistry?: `0x${string}`;
  sessionAA: `0x${string}`;
  session: SessionWalletAndAccountArtifacts;
}): Promise<void> {
  const { agentId, sessionAA, session } = params;
  const identityRegistry = params.identityRegistry ?? getIdentityRegistryAddress(session.chainId);
  if (!identityRegistry || identityRegistry === zeroAddress) {
    throw new Error(
      `Missing IdentityRegistry address for chain ${session.chainId}. ` +
        `Set NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY or NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY_<CHAIN_SUFFIX> in your env.`,
    );
  }

  const approveCalldata = encodeFunctionData({
    abi: IdentityRegistryAbi as any,
    functionName: 'approve',
    args: [sessionAA, BigInt(agentId)],
  });

  const hash = await sendSponsoredUserOperation({
    bundlerUrl: session.bundlerUrl,
    chain: session.chain,
    accountClient: session.smartAccount as any,
    calls: [{ to: identityRegistry, data: approveCalldata }],
  });
  await waitForUserOperationReceipt({ bundlerUrl: session.bundlerUrl, chain: session.chain, hash });
}

export type BuildDelegationSessionPackageParams = {
  kind?: 'delegation-8004' | 'delegation-smart-agent';
  chainId: number;
  aa: `0x${string}`;
  agentId?: number;
  agentAccount?: `0x${string}`;
  uaid?: string;
  did?: string;
  ensName?: string;
  sessionAA?: `0x${string}`;
  selector: `0x${string}`;
  scDelegation?: SessionPackageScDelegation;
  sessionKey: SessionPackageSessionKey;
  entryPoint: `0x${string}`;
  bundlerUrl: string;
  signedDelegation: SignedDelegation;
  delegationRedeemData?: `0x${string}`;
};

export function buildDelegationSessionPackage(
  params: BuildDelegationSessionPackageParams,
): SessionPackage | SmartAgentDelegationSessionPackage {
  const common: BaseDelegationSessionPackage = {
    kind: params.kind,
    chainId: params.chainId,
    aa: params.aa,
    sessionAA: params.sessionAA,
    selector: params.selector,
    scDelegation: params.scDelegation,
    sessionKey: params.sessionKey,
    entryPoint: params.entryPoint,
    bundlerUrl: params.bundlerUrl,
    signedDelegation: params.signedDelegation,
    delegationRedeemData: params.delegationRedeemData,
  };

  if (params.kind === 'delegation-smart-agent') {
    return {
      ...common,
      kind: 'delegation-smart-agent',
      agentAccount: params.agentAccount ?? params.aa,
      uaid: params.uaid,
      did: params.did,
      ensName: params.ensName,
    };
  }

  if (!Number.isFinite(params.agentId)) {
    throw new Error('agentId is required for delegation-8004 session packages.');
  }

  return {
    ...common,
    kind: 'delegation-8004',
    agentId: Number(params.agentId),
  } as Erc8004SessionPackage;
}

export type GenerateSessionPackageParams = {
  agentId: number;
  chainId: number;
  agentAccount: `0x${string}`;
  provider: any;
  ownerAddress: `0x${string}`;
  reputationRegistry?: `0x${string}`;
  identityRegistry?: `0x${string}`;
  validationRegistry?: `0x${string}`;
  associationsProxy?: `0x${string}`;
  bundlerUrl?: string;
  rpcUrl?: string;
  selector?: `0x${string}`;
  performDelegationTest?: boolean;
};

export async function generateSessionPackage(
  params: GenerateSessionPackageParams,
): Promise<SessionPackage> {
  const sessionInit = await createSessionKeyAndSessionAccount({
    chainId: params.chainId,
    rpcUrl: params.rpcUrl,
    bundlerUrl: params.bundlerUrl,
    ensureSessionAccountDeployed: true,
  });
  const session = sessionInit.artifacts;

  // Keep legacy behavior: attempt to deploy the principal smart account if missing.
  await (async () => {
    const { chainId, agentAccount, provider, ownerAddress } = params;
    const rpcUrl = session.rpcUrl;
    await switchChain(provider, chainId, rpcUrl);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const walletClient = createWalletClient({
      chain: session.chain,
      transport: custom(provider),
      account: ownerAddress as Address,
    });
    const principalSmartAccount = await toMetaMaskSmartAccount({
      address: agentAccount,
      client: session.publicClient as any,
      implementation: Implementation.Hybrid,
      signer: { walletClient: walletClient as any },
    } as any);
    const aaCode = await session.publicClient.getBytecode({ address: agentAccount });
    const aaDeployed = !!aaCode && aaCode !== '0x';
    if (!aaDeployed) {
      const hash = await sendSponsoredUserOperation({
        bundlerUrl: session.bundlerUrl,
        chain: session.chain,
        accountClient: principalSmartAccount as any,
        calls: [{ to: zeroAddress }],
      });
      await waitForUserOperationReceipt({ bundlerUrl: session.bundlerUrl, chain: session.chain, hash });
    }
  })();

  const delegation = await signAgentDelegation({
    chainId: params.chainId,
    agentAccount: params.agentAccount,
    ownerAddress: params.ownerAddress,
    provider: params.provider,
    delegateeAA: session.sessionAA,
    rpcUrl: session.rpcUrl,
    selector: params.selector ?? DEFAULT_SELECTOR,
    validationRegistry: params.validationRegistry,
    associationsProxy: params.associationsProxy,
    includeValidationScope: true,
    includeAssociationScope: true,
    includeAgentAccountSignatureScope: true,
  });

  // Approve the session AA as operator in the identity registry (client-authorized call).
  await (async () => {
    const identityRegistry = params.identityRegistry ?? getIdentityRegistryAddress(params.chainId);
    if (!identityRegistry || identityRegistry === zeroAddress) {
      throw new Error(
        `Missing IdentityRegistry address for chain ${params.chainId}. ` +
          `Set NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY or NEXT_PUBLIC_AGENTIC_TRUST_IDENTITY_REGISTRY_<CHAIN_SUFFIX> in your env.`,
      );
    }

    await switchChain(params.provider, params.chainId, session.rpcUrl);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const walletClient = createWalletClient({
      chain: session.chain,
      transport: custom(params.provider),
      account: params.ownerAddress as Address,
    });
    const principalSmartAccount = await toMetaMaskSmartAccount({
      address: params.agentAccount,
      client: session.publicClient as any,
      implementation: Implementation.Hybrid,
      signer: { walletClient: walletClient as any },
    } as any);

    const approveCalldata = encodeFunctionData({
      abi: IdentityRegistryAbi as any,
      functionName: 'approve',
      args: [session.sessionAA, BigInt(params.agentId)],
    });

    const hash = await sendSponsoredUserOperation({
      bundlerUrl: session.bundlerUrl,
      chain: session.chain,
      accountClient: principalSmartAccount as any,
      calls: [{ to: identityRegistry, data: approveCalldata }],
    });
    await waitForUserOperationReceipt({ bundlerUrl: session.bundlerUrl, chain: session.chain, hash });
  })();

  // Preserve legacy optional on-chain delegation test behavior.
  const performTest = params.performDelegationTest ?? true;
  const validationRegistry = params.validationRegistry ?? getValidationRegistryAddress(params.chainId);
  const delegationRedeemData =
    performTest && validationRegistry
      ? await (async (): Promise<`0x${string}` | undefined> => {
          try {
            const sessionAccountClient = await toMetaMaskSmartAccount({
              address: session.sessionAA,
              client: session.publicClient as any,
              implementation: Implementation.Hybrid,
              signer: { account: session.sessionKeyAccount },
              delegation: {
                delegation: delegation.signedDelegation,
                delegator: params.agentAccount,
              },
            } as any);

            const testCallData = encodeFunctionData({
              abi: ValidationRegistryAbi as any,
              functionName: 'getIdentityRegistry',
              args: [],
            });

            const delegationMessage = {
              delegate: (delegation.signedDelegation as any).delegate,
              delegator: (delegation.signedDelegation as any).delegator,
              authority: (delegation.signedDelegation as any).authority,
              caveats: (delegation.signedDelegation as any).caveats,
              salt: (delegation.signedDelegation as any).salt,
              signature: (delegation.signedDelegation as any).signature,
            };

            const includedExecutions = [
              {
                target: validationRegistry,
                value: BigInt(0),
                callData: testCallData,
              },
            ];

            const redeemData = DelegationManager.encode.redeemDelegations({
              delegations: [[delegationMessage]],
              modes: [ExecutionMode.SingleDefault],
              executions: [includedExecutions],
            }) as `0x${string}`;

            const testHash = await sendSponsoredUserOperation({
              bundlerUrl: session.bundlerUrl,
              chain: session.chain,
              accountClient: sessionAccountClient as any,
              calls: [
                {
                  to: session.sessionAA,
                  data: redeemData,
                  value: 0n,
                },
              ],
            });
            await waitForUserOperationReceipt({ bundlerUrl: session.bundlerUrl, chain: session.chain, hash: testHash });

            await session.publicClient.readContract({
              address: validationRegistry,
              abi: ValidationRegistryAbi as any,
              functionName: 'getIdentityRegistry',
              args: [],
            });

            return redeemData;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('Invalid Smart Account nonce') || message.includes('AA25 invalid account deployment')) {
              console.warn('*********** sessionPackageBuilder: Delegation test skipped:', message);
              return undefined;
            }
            throw new Error(`Delegation test failed: ${message}`);
          }
        })()
      : undefined;

  return buildDelegationSessionPackage({
    kind: 'delegation-8004',
    agentId: params.agentId,
    chainId: session.chainId,
    aa: params.agentAccount,
    sessionAA: session.sessionAA,
    selector: delegation.selector,
    scDelegation: delegation.scDelegation,
    sessionKey: session.sessionKey,
    entryPoint: session.entryPoint,
    bundlerUrl: session.bundlerUrl,
    signedDelegation: delegation.signedDelegation,
    delegationRedeemData,
  }) as SessionPackage;
}

export type GenerateSmartAgentDelegationSessionPackageParams = {
  chainId: number;
  agentAccount: `0x${string}`;
  provider: any;
  ownerAddress: `0x${string}`;
  validationRegistry?: `0x${string}`;
  associationsProxy?: `0x${string}`;
  bundlerUrl?: string;
  rpcUrl?: string;
  selector?: `0x${string}`;
  performDelegationTest?: boolean;
  did?: string;
  uaid?: string;
  ensName?: string;
};

export async function generateSmartAgentDelegationSessionPackage(
  params: GenerateSmartAgentDelegationSessionPackageParams,
): Promise<SmartAgentDelegationSessionPackage> {
  const sessionInit = await createSessionKeyAndSessionAccount({
    chainId: params.chainId,
    rpcUrl: params.rpcUrl,
    bundlerUrl: params.bundlerUrl,
    ensureSessionAccountDeployed: true,
  });
  const session = sessionInit.artifacts;

  // Keep legacy behavior: attempt to deploy the principal smart account if missing.
  await (async () => {
    await switchChain(params.provider, params.chainId, session.rpcUrl);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const walletClient = createWalletClient({
      chain: session.chain,
      transport: custom(params.provider),
      account: params.ownerAddress as Address,
    });
    const principalSmartAccount = await toMetaMaskSmartAccount({
      address: params.agentAccount,
      client: session.publicClient as any,
      implementation: Implementation.Hybrid,
      signer: { walletClient: walletClient as any },
    } as any);
    const aaCode = await session.publicClient.getBytecode({ address: params.agentAccount });
    const aaDeployed = !!aaCode && aaCode !== '0x';
    if (!aaDeployed) {
      const hash = await sendSponsoredUserOperation({
        bundlerUrl: session.bundlerUrl,
        chain: session.chain,
        accountClient: principalSmartAccount as any,
        calls: [{ to: zeroAddress }],
      });
      await waitForUserOperationReceipt({ bundlerUrl: session.bundlerUrl, chain: session.chain, hash });
    }
  })();

  const delegation = await signAgentDelegation({
    chainId: params.chainId,
    agentAccount: params.agentAccount,
    ownerAddress: params.ownerAddress,
    provider: params.provider,
    delegateeAA: session.sessionAA,
    rpcUrl: session.rpcUrl,
    selector: params.selector ?? SMART_AGENT_DEFAULT_SELECTOR,
    validationRegistry: params.validationRegistry,
    associationsProxy: params.associationsProxy,
    includeValidationScope: false,
    includeAssociationScope: false,
    includeAgentAccountSignatureScope: true,
  });

  return buildDelegationSessionPackage({
    kind: 'delegation-smart-agent',
    chainId: session.chainId,
    aa: params.agentAccount,
    agentAccount: params.agentAccount,
    uaid: params.uaid,
    did: params.did,
    ensName: params.ensName,
    sessionAA: session.sessionAA,
    selector: delegation.selector,
    scDelegation: delegation.scDelegation,
    sessionKey: session.sessionKey,
    entryPoint: session.entryPoint,
    bundlerUrl: session.bundlerUrl,
    signedDelegation: delegation.signedDelegation,
  }) as SmartAgentDelegationSessionPackage;
}
