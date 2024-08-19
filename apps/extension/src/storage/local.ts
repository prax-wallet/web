import { ExtensionStorage } from './base';
import { localMigrations } from './local-migrations';
import { LocalStorageState, LocalStorageVersion } from './types';

export const localDefaults: Required<LocalStorageState> = {
  wallets: [],
  fullSyncHeight: undefined,
  grpcEndpoint: undefined,
  knownSites: [],
  params: undefined,
  passwordKeyPrint: undefined,
  frontendUrl: undefined,
  numeraires: [],
};

// Meant to be used for long-term persisted data. It is cleared when the extension is removed.
export const localExtStorage = new ExtensionStorage<LocalStorageState>(
  chrome.storage.local,
  localDefaults,
  LocalStorageVersion.V3,
  localMigrations,
);
