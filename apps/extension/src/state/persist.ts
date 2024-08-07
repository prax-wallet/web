import { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { AllSlices } from '.';
import { produce } from 'immer';

import { localExtStorage } from '../storage/local';
import { LocalStorageState } from '../storage/types';
import { sessionExtStorage, SessionStorageState } from '../storage/session';
import { StorageItem } from '../storage/base';
import { walletsFromJson } from '@penumbra-zone/types/wallet';
import { AppParameters } from '@buf/penumbra-zone_penumbra.bufbuild_es/penumbra/core/app/v1/app_pb';

export type Middleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

type Persist = (f: StateCreator<AllSlices>) => StateCreator<AllSlices>;

type Setter = (
  partial: (state: AllSlices) => Partial<AllSlices> | AllSlices,
  replace?: boolean | undefined,
) => void;

export const customPersistImpl: Persist = f => (set, get, store) => {
  void (async function () {
    // Part 1: Get storage values and sync them to store
    const passwordKey = await sessionExtStorage.get('passwordKey');
    const wallets = await localExtStorage.get('wallets');
    const grpcEndpoint = await localExtStorage.get('grpcEndpoint');
    const knownSites = await localExtStorage.get('knownSites');
    const frontendUrl = await localExtStorage.get('frontendUrl');
    const numeraires = await localExtStorage.get('numeraires');

    set(
      produce((state: AllSlices) => {
        state.password.key = passwordKey;
        state.wallets.all = walletsFromJson(wallets);
        state.network.grpcEndpoint = grpcEndpoint;
        state.connectedSites.knownSites = knownSites;
        state.defaultFrontend.url = frontendUrl;
        state.numeraires.selectedNumeraires = numeraires;
      }),
    );

    // Part 2: when chrome.storage changes sync select fields to store
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        syncLocal(changes, set);
      }
      if (area === 'session') {
        syncSession(changes, set);
      }
    });
  })();

  return f(set, get, store);
};

function syncLocal(changes: Record<string, chrome.storage.StorageChange>, set: Setter) {
  if (changes['wallets']) {
    const wallets = changes['wallets'].newValue as
      | StorageItem<LocalStorageState['wallets']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.wallets.all = wallets ? walletsFromJson(wallets.value) : [];
      }),
    );
  }

  if (changes['fullSyncHeight']) {
    const stored = changes['fullSyncHeight'].newValue as
      | StorageItem<LocalStorageState['fullSyncHeight']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.network.fullSyncHeight = stored?.value ?? 0;
      }),
    );
  }

  if (changes['grpcEndpoint']) {
    const stored = changes['grpcEndpoint'].newValue as
      | StorageItem<LocalStorageState['grpcEndpoint']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.network.grpcEndpoint = stored?.value ?? state.network.grpcEndpoint;
      }),
    );
  }

  if (changes['knownSites']) {
    const stored = changes['knownSites'].newValue as
      | StorageItem<LocalStorageState['knownSites']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.connectedSites.knownSites = stored?.value ?? state.connectedSites.knownSites;
      }),
    );
  }

  if (changes['frontendUrl']) {
    const stored = changes['frontendUrl'].newValue as
      | StorageItem<LocalStorageState['frontendUrl']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.defaultFrontend.url = stored?.value ?? state.defaultFrontend.url;
      }),
    );
  }

  if (changes['numeraires']) {
    const stored = changes['numeraires'].newValue as
      | StorageItem<LocalStorageState['numeraires']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.numeraires.selectedNumeraires = stored?.value ?? state.numeraires.selectedNumeraires;
      }),
    );
  }

  if (changes['params']) {
    const stored = changes['params'].newValue as
      | StorageItem<LocalStorageState['params']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.network.chainId = stored?.value
          ? AppParameters.fromJsonString(stored.value).chainId
          : state.network.chainId;
      }),
    );
  }
}

function syncSession(changes: Record<string, chrome.storage.StorageChange>, set: Setter) {
  if (changes['hashedPassword']) {
    const item = changes['hashedPassword'].newValue as
      | StorageItem<SessionStorageState['passwordKey']>
      | undefined;
    set(
      produce((state: AllSlices) => {
        state.password.key = item ? item.value : undefined;
      }),
    );
  }
}

export const customPersist = customPersistImpl as Middleware;
