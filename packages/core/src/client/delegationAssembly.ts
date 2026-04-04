import type { SessionPackageSessionKey, SignedDelegation, SmartAgentDelegationSessionPackage } from '../shared/sessionPackage';
import type { SessionPackageScDelegation } from '../shared/sessionPackage';
import { buildDelegationSessionPackage, type BuildDelegationSessionPackageParams } from './delegationSessionBuilder';

export type AssembleSmartAgentSessionPackageParams = {
  chainId: number;
  agentAccount: `0x${string}`;
  sessionAA: `0x${string}`;
  sessionKey: SessionPackageSessionKey;
  entryPoint: `0x${string}`;
  bundlerUrl: string;
  selector: `0x${string}`;
  signedDelegation: SignedDelegation;
  scDelegation?: SessionPackageScDelegation;
  uaid?: string;
  did?: string;
  ensName?: string;
};

export function assembleSmartAgentSessionPackage(
  params: AssembleSmartAgentSessionPackageParams,
): SmartAgentDelegationSessionPackage {
  const buildParams: BuildDelegationSessionPackageParams = {
    kind: 'delegation-smart-agent',
    chainId: params.chainId,
    aa: params.agentAccount,
    agentAccount: params.agentAccount,
    uaid: params.uaid,
    did: params.did,
    ensName: params.ensName,
    sessionAA: params.sessionAA,
    selector: params.selector,
    scDelegation: params.scDelegation,
    sessionKey: params.sessionKey,
    entryPoint: params.entryPoint,
    bundlerUrl: params.bundlerUrl,
    signedDelegation: params.signedDelegation,
  };
  return buildDelegationSessionPackage(buildParams) as SmartAgentDelegationSessionPackage;
}

