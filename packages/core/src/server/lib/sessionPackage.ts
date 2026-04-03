/**
 * Session Package Utilities
 * 
 * Handles loading and validation of session packages for agent delegation
 * NOTE: These functions should only be called server-side (Next.js API routes, server components)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineChain, http, createPublicClient, createWalletClient, type Chain, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount, type Account } from 'viem/accounts';
import { getChainEnvVar } from './chainConfig';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import type {
  A2AOnlySessionPackage,
  AnySessionPackage,
  DelegationSessionPackage,
  SessionPackage,
  SmartAgentDelegationSessionPackage,
} from '../../shared/sessionPackage';
import {
  isA2AOnlySessionPackage as isA2AOnlySessionPackageShared,
  isErc8004SessionPackage,
  isSmartAgentDelegationSessionPackage as isSmartAgentDelegationSessionPackageShared,
} from '../../shared/sessionPackageGating';

type Hex = `0x${string}`;

export type DelegationSetup = {
  agentId?: number;
  chainId: number;
  chain: Chain;
  rpcUrl: string;
  bundlerUrl: string;
  entryPoint: Hex;
  aa: Hex;
  sessionAA?: Hex;
  selector: Hex;
  sessionKey: SessionPackage['sessionKey'];
  signedDelegation: SessionPackage['signedDelegation'];
  delegationRedeemData?: Hex;
  publicClient: PublicClient;
};

/**
 * Build an in-memory SessionPackage JSON object from the parameters produced by
 * the session creation flow (AA, session AA, session key, delegation, etc.).
 *
 * This is the canonical shape used by auth/session and downstream helpers.
 */
export function buildSessionPackage(params: {
  agentId: number;
  chainId: number;
  aa: Hex;
  sessionAA?: Hex;
  selector: Hex;
  sessionKey: {
    privateKey: Hex;
    address: Hex;
    validAfter: number;
    validUntil: number;
  };
  entryPoint: Hex;
  bundlerUrl: string;
  signedDelegation: SessionPackage['signedDelegation'];
  delegationRedeemData?: Hex;
}): SessionPackage {
  const {
    agentId,
    chainId,
    aa,
    sessionAA,
    selector,
    sessionKey,
    entryPoint,
    bundlerUrl,
    signedDelegation,
    delegationRedeemData,
  } = params;

  return {
    agentId,
    chainId,
    aa,
    sessionAA,
    selector,
    sessionKey,
    entryPoint,
    bundlerUrl,
    signedDelegation,
    delegationRedeemData,
  };
}

/**
 * Load session package from file
 * @param filePath - Optional path to session package file (defaults to sessionPackage.json.secret in same directory)
 */
export function loadSessionPackage(filePath?: string): SessionPackage {
  let p: string;
  
  if (filePath) {
    p = path.resolve(filePath);
  } else {
    // Try environment variable first
    const envPath = process.env.AGENTIC_TRUST_SESSION_PACKAGE_PATH;
    if (envPath) {
      p = path.resolve(envPath);
    } else {
      // Try current working directory
      p = path.join(process.cwd(), 'sessionPackage.json.secret');
      // If not found, try relative to this file's directory
      if (!fs.existsSync(p)) {
        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          p = path.join(__dirname, 'sessionPackage.json.secret');
        } catch {
          // Last resort: use cwd
          p = path.join(process.cwd(), 'sessionPackage.json.secret');
        }
      }
    }
  }

  if (!fs.existsSync(p)) {
    throw new Error(
      `Session package file not found: ${p}\n` +
      'Set AGENTIC_TRUST_SESSION_PACKAGE_PATH environment variable or provide filePath parameter.'
    );
  }

  const raw = fs.readFileSync(p, 'utf-8');
  const parsed = JSON.parse(raw);

  return parsed as SessionPackage;
}

export function loadAnySessionPackage(filePath?: string): AnySessionPackage {
  // Reuse the path resolution logic from loadSessionPackage by reading the same file,
  // but do not assume delegation-only shape.
  const raw = (() => {
    // The easiest way to preserve existing resolution logic is to call loadSessionPackage(),
    // but that casts to SessionPackage. Instead, we replicate the file read here.
    let p: string;
    if (filePath) {
      p = path.resolve(filePath);
    } else {
      const envPath = process.env.AGENTIC_TRUST_SESSION_PACKAGE_PATH;
      if (envPath) {
        p = path.resolve(envPath);
      } else {
        p = path.join(process.cwd(), 'sessionPackage.json.secret');
        if (!fs.existsSync(p)) {
          try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            p = path.join(__dirname, 'sessionPackage.json.secret');
          } catch {
            p = path.join(process.cwd(), 'sessionPackage.json.secret');
          }
        }
      }
    }

    if (!fs.existsSync(p)) {
      throw new Error(
        `Session package file not found: ${p}\n` +
          'Set AGENTIC_TRUST_SESSION_PACKAGE_PATH environment variable or provide filePath parameter.',
      );
    }
    return fs.readFileSync(p, 'utf-8');
  })();

  const parsed = JSON.parse(raw) as AnySessionPackage;
  return parsed;
}

export function isA2AOnlySessionPackage(pkg: unknown): pkg is A2AOnlySessionPackage {
  return isA2AOnlySessionPackageShared(pkg);
}

export function isSmartAgentDelegationSessionPackage(
  pkg: unknown,
): pkg is SmartAgentDelegationSessionPackage {
  return isSmartAgentDelegationSessionPackageShared(pkg);
}

export function validateA2AOnlySessionPackage(pkg: A2AOnlySessionPackage): void {
  if (pkg.kind !== 'a2a-only') throw new Error('sessionPackage.kind must be "a2a-only"');
  if (!pkg.chainId) throw new Error('sessionPackage.chainId is required');
  if (!pkg.did) throw new Error('sessionPackage.did is required');
  if (!pkg.sessionKey?.privateKey || !pkg.sessionKey?.address) {
    throw new Error('sessionPackage.sessionKey.privateKey and address are required');
  }
  if (!pkg.sessionKey?.validAfter || !pkg.sessionKey?.validUntil) {
    throw new Error('sessionPackage.sessionKey.validAfter and validUntil are required');
  }
}

export function validateDelegationSessionPackage(pkg: DelegationSessionPackage): void {
  if (!pkg.chainId) throw new Error('sessionPackage.chainId is required');
  if (!pkg.aa) throw new Error('sessionPackage.aa is required');
  if (!pkg.entryPoint) throw new Error('sessionPackage.entryPoint is required');

  const envBundlerUrl = process.env.AGENTIC_TRUST_BUNDLER_URL;
  if (!pkg.bundlerUrl && !envBundlerUrl) {
    throw new Error('sessionPackage.bundlerUrl is required (or set AGENTIC_TRUST_BUNDLER_URL env var)');
  }

  if (!pkg.sessionKey?.privateKey || !pkg.sessionKey?.address) {
    throw new Error('sessionPackage.sessionKey.privateKey and address are required');
  }
  if (!pkg.signedDelegation?.signature) {
    throw new Error('sessionPackage.signedDelegation.signature is required');
  }
  const hasFlattened = 'delegate' in pkg.signedDelegation && 'delegator' in pkg.signedDelegation;
  if (!hasFlattened) {
    throw new Error(
      'sessionPackage.signedDelegation must have either message (legacy) or flattened delegation properties (delegate, delegator, etc.)',
    );
  }

  if (isSmartAgentDelegationSessionPackage(pkg)) {
    if (!pkg.agentAccount) throw new Error('sessionPackage.agentAccount is required for smart-agent delegation packages');
    return;
  }

  if (isErc8004SessionPackage(pkg) && !Number.isFinite(pkg.agentId)) {
    throw new Error('sessionPackage.agentId is required for 8004 delegation packages');
  }
}

/**
 * Validate session package structure
 * Note: bundlerUrl and reputationRegistry can come from environment variables
 */
export function validateSessionPackage(pkg: SessionPackage): void {
  validateDelegationSessionPackage(pkg);
}

/**
 * Get default RPC URL for a chain ID
 */
function defaultRpcUrlFor(chainId: number): string | null {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  if (process.env.JSON_RPC_URL) return process.env.JSON_RPC_URL;
  switch (chainId) {
    case 11155111: return 'https://rpc.sepolia.org';
    case 1: return 'https://rpc.ankr.com/eth';
    default: return null;
  }
}

/**
 * Build delegation setup from session package
 * Uses environment variables only (no overrides allowed)
 * Priority: env vars > session package defaults
 */
export function buildDelegationSetup(
  pkg?: DelegationSessionPackage
): DelegationSetup {
  const session = pkg || loadSessionPackage();
  validateDelegationSessionPackage(session);
  
  // RPC URL: env var or default, then session package
  const envRpcUrl = getChainEnvVar('AGENTIC_TRUST_RPC_URL', session.chainId);
  const rpcUrl = envRpcUrl || defaultRpcUrlFor(session.chainId);
  if (!rpcUrl) {
    throw new Error(`RPC URL not provided and no default known for chainId ${session.chainId}`);
  }

  // Bundler URL: env var, then session package
  const envBundlerUrl = getChainEnvVar('AGENTIC_TRUST_BUNDLER_URL', session.chainId);
  const bundlerUrl = envBundlerUrl || session.bundlerUrl;


  const chain = defineChain({
    id: session.chainId,
    name: `chain-${session.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] }, public: { http: [rpcUrl] } },
  });

  // Create public client with timeout configuration
  // Default timeout: 30 seconds (30000ms)
  const publicClient = createPublicClient({ 
    chain,
    transport: http(rpcUrl, {
      timeout: 30000, // 30 seconds
      retryCount: 3,
      retryDelay: 1000,
    }),
  });

  return {
    agentId: isErc8004SessionPackage(session) ? session.agentId : undefined,
    chainId: session.chainId,
    chain,
    rpcUrl,
    bundlerUrl,
    entryPoint: session.entryPoint,
    aa: session.aa,
    sessionAA: session.sessionAA,
    selector: session.selector,
    sessionKey: session.sessionKey,
    signedDelegation: session.signedDelegation,
    delegationRedeemData: session.delegationRedeemData,
    publicClient,
  };
}


export async function buildAgentAccountFromSession(sessionPackage?: SessionPackage): Promise<Account> {
  if (!sessionPackage) {
    throw new Error('sessionPackage is required to build agent account');
  }

  const delegationSetup = buildDelegationSetup(sessionPackage);

  const publicClient = createPublicClient({
    chain: delegationSetup.chain,
    transport: http(delegationSetup.rpcUrl),
  });

  const agentOwnerEOA = privateKeyToAccount(delegationSetup.sessionKey.privateKey);

  // Create wallet client from the account
  const walletClient = createWalletClient({
    account: agentOwnerEOA,
    chain: delegationSetup.chain,
    transport: http(delegationSetup.rpcUrl),
  });

  // Use agent account (aa) as the address, not sessionAA, since we want to sign as the agent account
  const agentAccountAddress = delegationSetup.aa;

  const agentAccountClient = await toMetaMaskSmartAccount({
    address: agentAccountAddress as `0x${string}`,
    client: publicClient,
    implementation: Implementation.Hybrid,
    signer: { walletClient },
  } as any);

  return agentAccountClient as Account;
}

