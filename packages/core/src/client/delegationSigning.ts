import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  zeroAddress,
  type Address,
  type Chain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import {
  createDelegation,
  getSmartAccountsEnvironment,
  Implementation,
  toMetaMaskSmartAccount,
} from '@metamask/smart-accounts-kit';
import ValidationRegistryAbi from '@agentic-trust/agentic-trust-sdk/abis/ValidationRegistry.json';

import type { SessionPackageScDelegation, SignedDelegation } from '../shared/sessionPackage';
import { getChainConfig, getChainById, getChainIdHex, getChainRpcUrl } from '../server/lib/chainConfig';

export type SignAgentDelegationParams = {
  chainId: number;
  agentAccount: `0x${string}`;
  ownerAddress: `0x${string}`;
  provider: any;
  /**
   * The smart account receiving the delegation (session AA).
   */
  delegateeAA: `0x${string}`;
  rpcUrl?: string;
  selector?: `0x${string}`;
  validationRegistry?: `0x${string}`;
  associationsProxy?: `0x${string}`;
  includeValidationScope?: boolean;
  includeAssociationScope?: boolean;
  includeAgentAccountSignatureScope?: boolean;
};

export type DelegationSignatureArtifacts = {
  selector: `0x${string}`;
  targets: `0x${string}`[];
  selectors: `0x${string}`[];
  signedDelegation: SignedDelegation;
  scDelegation?: SessionPackageScDelegation;
};

function normalizeHex(value?: string | null): `0x${string}` | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('0x') ? (trimmed as `0x${string}`) : (`0x${trimmed}` as `0x${string}`);
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

/**
 * Smart-agent default selector: `isValidSignature(bytes32,bytes)`.
 */
export const SMART_AGENT_DEFAULT_SELECTOR = getIsValidSignatureSelector();

/**
 * Default selector used by legacy 8004 packages (ValidationRegistry.validationResponse(...)).
 */
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

async function buildClients(params: {
  chainId: number;
  rpcUrl: string;
  provider: any;
  ownerAddress: `0x${string}`;
}): Promise<{ chain: Chain; publicClient: PublicClient; walletClient: WalletClient }> {
  const chain = getChainById(params.chainId) as Chain;
  const publicClient = createPublicClient({ chain, transport: http(params.rpcUrl) });
  const walletClient = createWalletClient({
    chain,
    transport: custom(params.provider),
    account: params.ownerAddress as Address,
  });
  return { chain, publicClient, walletClient };
}

export async function signAgentDelegation(params: SignAgentDelegationParams): Promise<DelegationSignatureArtifacts> {
  const {
    chainId,
    agentAccount,
    ownerAddress,
    provider,
    delegateeAA,
    rpcUrl: rpcUrlOverride,
    selector = DEFAULT_SELECTOR,
    validationRegistry: validationRegistryOverride,
    associationsProxy: associationsProxyOverride,
    includeValidationScope = false,
    includeAssociationScope = false,
    includeAgentAccountSignatureScope = true,
  } = params;

  if (!provider) throw new Error('An EIP-1193 provider is required to sign a delegation.');
  if (!ownerAddress) throw new Error('ownerAddress is required to sign a delegation.');
  if (!agentAccount) throw new Error('agentAccount is required to sign a delegation.');
  if (!delegateeAA || delegateeAA === zeroAddress) {
    throw new Error('delegateeAA (sessionAA) is required to sign a delegation.');
  }

  const rpcUrl = rpcUrlOverride ?? getChainRpcUrl(chainId);
  if (!rpcUrl) throw new Error(`Missing RPC URL for chain ${chainId}`);

  await switchChain(provider, chainId, rpcUrl);
  await new Promise((r) => setTimeout(r, 250));

  const { publicClient, walletClient } = await buildClients({
    chainId,
    rpcUrl,
    provider,
    ownerAddress,
  });

  const smartAccount = await toMetaMaskSmartAccount({
    address: agentAccount,
    client: publicClient as any,
    implementation: Implementation.Hybrid,
    signer: { walletClient: walletClient as any },
  } as any);

  // Validate environment/implementation exists for this chain.
  const env = getSmartAccountsEnvironment(chainId);
  let hybridDelegatorAddress = (env.implementations as any)?.HybridDeleGatorImpl as `0x${string}` | undefined;
  if (!hybridDelegatorAddress) {
    const accountImpl =
      (smartAccount as any).implementationAddress ||
      (smartAccount as any).implementation?.address ||
      (smartAccount as any).getImplementationAddress?.();
    if (accountImpl) hybridDelegatorAddress = accountImpl as `0x${string}`;
  }
  if (!hybridDelegatorAddress) {
    throw new Error(
      `HybridDeleGator address not found for chainId ${chainId}. ` +
        `DeleGatorEnvironment: ${JSON.stringify({ EntryPoint: env.EntryPoint, implementations: env.implementations })}.`,
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
  if (validationRegistry) targets.push(validationRegistry);
  if (includeAgentAccountSignatureScope) targets.push(agentAccount);

  let scDelegation: SessionPackageScDelegation | undefined;
  const associationsProxy = includeAssociationScope
    ? getAssociationsProxyAddress(chainId, associationsProxyOverride)
    : undefined;
  if (includeAssociationScope && !associationsProxy) {
    const cfg = getChainConfig(chainId);
    const suffix = cfg?.suffix ?? String(chainId);
    throw new Error(
      `Missing AssociationsStore proxy for chain ${chainId}. ` +
        `Set NEXT_PUBLIC_ASSOCIATIONS_STORE_PROXY_${suffix}=0x...`,
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
    for (const associationSelector of getAssociationSelectors()) selectors.add(associationSelector);
  }
  if (includeAgentAccountSignatureScope) selectors.add(getIsValidSignatureSelector());

  const delegation = createDelegation({
    environment: env,
    scope: { type: 'functionCall', targets, selectors: Array.from(selectors) },
    from: agentAccount,
    to: delegateeAA,
    caveats: [],
  });

  const signature = (await (smartAccount as any).signDelegation({ delegation })) as `0x${string}`;

  const signedDelegation = { ...(delegation as any), signature } as SignedDelegation;

  return {
    selector,
    targets,
    selectors: Array.from(selectors),
    signedDelegation,
    scDelegation,
  };
}

