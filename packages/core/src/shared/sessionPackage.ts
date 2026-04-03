export type DelegationMessage = {
  delegate: `0x${string}`;
  delegator: `0x${string}`;
  authority: `0x${string}`;
  caveats: any[];
  salt: `0x${string}`;
  signature: `0x${string}`;
};

export type SignedDelegation = 
  | {
      // New flattened structure: delegation properties at top level
      delegate: `0x${string}`;
      delegator: `0x${string}`;
      authority: `0x${string}`;
      caveats: any[];
      salt: `0x${string}`;
      signature: `0x${string}`;
    }
  | {
      // Legacy structure: delegation properties nested under message
      message: DelegationMessage;
      signature: `0x${string}`;
    };

export type SessionPackageScDelegation = {
  associationsStoreProxy: `0x${string}`;
  delegationManager: `0x${string}`;
  scDelegationEnforcer: `0x${string}`;
  scDelegationVerifier: `0x${string}`;
};

export type SessionPackageSessionKey = {
  privateKey: `0x${string}`;
  address: `0x${string}`;
  validAfter: number;
  validUntil: number;
};

export type BaseDelegationSessionPackage = {
  /**
   * Discriminator for union-friendly session packages.
   * Omitted in legacy packages (treated as delegation).
   */
  kind?: 'delegation' | 'delegation-8004' | 'delegation-smart-agent';
  chainId: number;
  aa: `0x${string}`;
  sessionAA?: `0x${string}`;
  selector: `0x${string}`;
  // SC-DELEGATION config used for ERC-8092 keyType 0x8004 proof validation.
  // Required when the agent intends to produce SC-DELEGATION proofs off-chain.
  scDelegation?: SessionPackageScDelegation;
  sessionKey: SessionPackageSessionKey;
  entryPoint: `0x${string}`;
  bundlerUrl: string;
  delegationRedeemData?: `0x${string}`;
  signedDelegation: SignedDelegation;
};

export type Erc8004SessionPackage = BaseDelegationSessionPackage & {
  kind?: 'delegation' | 'delegation-8004';
  agentId: number;
};

export type SmartAgentDelegationSessionPackage = BaseDelegationSessionPackage & {
  kind: 'delegation-smart-agent';
  /**
   * Explicit principal smart account identity anchor.
   * This duplicates `aa` for callers that want an identity-specific field.
   */
  agentAccount: `0x${string}`;
  /**
   * Optional smart-agent identity fields for downstream storage/discovery.
   */
  uaid?: string;
  did?: string;
  ensName?: string;
};

export type DelegationSessionPackage =
  | Erc8004SessionPackage
  | SmartAgentDelegationSessionPackage;

// Backward-compatible alias used by 8004-specific runtime paths.
export type SessionPackage = Erc8004SessionPackage;

export type A2AOnlySessionPackage = {
  kind: 'a2a-only';
  chainId: number;
  /**
   * Optional hint for downstream callers.
   * Not required for A2A authentication.
   */
  agentAccount?: `0x${string}`;
  /**
   * Canonical agent/client DID for A2A auth handshakes.
   * Expected format: did:ethr:<network>:<address>
   */
  did: string;
  sessionKey: {
    privateKey: `0x${string}`;
    address: `0x${string}`;
    validAfter: number;
    validUntil: number;
  };
};

export type AnySessionPackage = DelegationSessionPackage | A2AOnlySessionPackage;


