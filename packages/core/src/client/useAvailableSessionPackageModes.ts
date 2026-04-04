'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  type SessionPackageFacts,
  type SessionPackageMode,
  resolveSessionPackageCapabilities,
} from './sessionPackageCapabilities';

export type UseAvailableSessionPackageModesOptions = {
  initialMode?: SessionPackageMode;
};

export function useAvailableSessionPackageModes(
  facts: SessionPackageFacts,
  options: UseAvailableSessionPackageModesOptions = {},
) {
  const capabilities = useMemo(
    () => resolveSessionPackageCapabilities(facts),
    [facts.hasSmartAccount, facts.hasEnsIdentity, facts.hasErc8004Extension],
  );

  const [mode, setMode] = useState<SessionPackageMode>(
    options.initialMode ?? capabilities.defaultMode ?? 'smart-agent',
  );

  useEffect(() => {
    if (!capabilities.availableModes.includes(mode)) {
      setMode(capabilities.defaultMode ?? 'smart-agent');
    }
  }, [capabilities.availableModes, capabilities.defaultMode, mode]);

  return {
    ...capabilities,
    mode,
    setMode,
  };
}
