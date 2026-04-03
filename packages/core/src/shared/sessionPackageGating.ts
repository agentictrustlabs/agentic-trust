import type {
  A2AOnlySessionPackage,
  AnySessionPackage,
  DelegationSessionPackage,
  SessionPackage,
  SmartAgentDelegationSessionPackage,
} from './sessionPackage';

export function isA2AOnlySessionPackage(pkg: unknown): pkg is A2AOnlySessionPackage {
  if (!pkg || typeof pkg !== 'object') return false;
  return (pkg as any).kind === 'a2a-only';
}

export function isDelegationSessionPackage(pkg: unknown): pkg is DelegationSessionPackage {
  if (!pkg || typeof pkg !== 'object') return false;
  const p = pkg as any;
  return (
    (
      p.kind === undefined ||
      p.kind === 'delegation' ||
      p.kind === 'delegation-8004' ||
      p.kind === 'delegation-smart-agent'
    ) &&
    typeof p.chainId === 'number' &&
    typeof p.aa === 'string' &&
    typeof p.entryPoint === 'string' &&
    typeof p.selector === 'string' &&
    !!p.sessionKey?.privateKey &&
    !!p.sessionKey?.address &&
    !!p.signedDelegation?.signature
  );
}

export function isErc8004SessionPackage(pkg: unknown): pkg is SessionPackage {
  return isDelegationSessionPackage(pkg) && typeof (pkg as any).agentId === 'number';
}

export function isSmartAgentDelegationSessionPackage(
  pkg: unknown,
): pkg is SmartAgentDelegationSessionPackage {
  return (
    isDelegationSessionPackage(pkg) &&
    (pkg as any).kind === 'delegation-smart-agent' &&
    typeof (pkg as any).agentAccount === 'string'
  );
}

export function isSessionPackageReadyForChat(pkg: unknown): pkg is AnySessionPackage {
  return isA2AOnlySessionPackage(pkg) || isDelegationSessionPackage(pkg);
}

export function isSessionPackageReadyForOnchain(pkg: unknown): pkg is DelegationSessionPackage {
  return isDelegationSessionPackage(pkg);
}

