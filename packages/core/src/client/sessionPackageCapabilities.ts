export type SessionPackageMode = 'smart-agent' | 'erc8004';

export type SessionPackageFacts = {
  hasSmartAccount: boolean;
  hasEnsIdentity?: boolean;
  hasErc8004Extension?: boolean;
};

export type SessionPackageCapabilities = {
  hasSmartAccount: boolean;
  availableModes: SessionPackageMode[];
  defaultMode: SessionPackageMode | null;
};

export function getAvailableSessionPackageModes(
  facts: SessionPackageFacts,
): SessionPackageMode[] {
  const modes: SessionPackageMode[] = [];
  if (facts.hasSmartAccount && facts.hasEnsIdentity) {
    modes.push('smart-agent');
  }
  if (facts.hasSmartAccount && facts.hasErc8004Extension) {
    modes.push('erc8004');
  }
  return modes;
}

export function getDefaultSessionPackageMode(
  facts: SessionPackageFacts,
): SessionPackageMode | null {
  const availableModes = getAvailableSessionPackageModes(facts);
  return availableModes[0] ?? null;
}

export function resolveSessionPackageCapabilities(
  facts: SessionPackageFacts,
): SessionPackageCapabilities {
  const availableModes = getAvailableSessionPackageModes(facts);
  return {
    hasSmartAccount: facts.hasSmartAccount,
    availableModes,
    defaultMode: availableModes[0] ?? null,
  };
}

export function isSessionPackageModeAvailable(
  mode: SessionPackageMode,
  facts: SessionPackageFacts,
): boolean {
  return getAvailableSessionPackageModes(facts).includes(mode);
}
