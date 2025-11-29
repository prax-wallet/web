import { Key } from '@repo/encryption/key';
import { Box } from '@repo/encryption/box';
import { Wallet, type WalletJson } from '@repo/wallet';
// Dynamic import to avoid bundling WASM into initial chunks
// import { generateSpendKey, getFullViewingKey, getWalletId } from '@penumbra-zone/wasm/keys';
import type { ExtensionStorage } from '@repo/storage-chrome/base';
import type { LocalStorageState } from '@repo/storage-chrome/local';
import type { SessionStorageState } from '@repo/storage-chrome/session';
import { AllSlices, SliceCreator } from '.';

export interface WalletsSlice {
  /** new custody types aren't used yet */
  all: WalletJson<'encryptedSeedPhrase'>[];
  addWallet: (toAdd: { label: string; seedPhrase: string[] }) => Promise<void>;
  getSeedPhrase: () => Promise<string[]>;
}

export const createWalletsSlice =
  (
    session: ExtensionStorage<SessionStorageState>,
    local: ExtensionStorage<LocalStorageState>,
  ): SliceCreator<WalletsSlice> =>
  (set, get) => {
    return {
      all: [],
      addWallet: async ({ label, seedPhrase }) => {
        // Dynamic import to avoid bundling WASM into initial chunks (service worker)
        const { generateSpendKey, getFullViewingKey, getWalletId } = await import(
          '@penumbra-zone/wasm/keys'
        );

        const seedPhraseStr = seedPhrase.join(' ');
        const spendKey = generateSpendKey(seedPhraseStr);
        const fullViewingKey = getFullViewingKey(spendKey);

        const passwordKey = await session.get('passwordKey');
        if (passwordKey === undefined) {
          throw new Error('Password Key not in storage');
        }

        const key = await Key.fromJson(passwordKey);
        const newWallet = new Wallet(label, getWalletId(fullViewingKey), fullViewingKey, {
          encryptedSeedPhrase: await key.seal(seedPhraseStr),
        });

        set(state => {
          state.wallets.all.unshift(newWallet.toJson());
        });

        const wallets = await local.get('wallets');
        await local.set('wallets', [newWallet.toJson(), ...wallets]);
      },

      /** @deprecated */
      getSeedPhrase: async () => {
        const passwordKey = await session.get('passwordKey');
        if (!passwordKey) {
          throw new Error('no password set');
        }

        const key = await Key.fromJson(passwordKey);
        const activeWallet = getActiveWallet(get());
        if (!activeWallet) {
          throw new Error('no wallet set');
        }

        const phraseBox = Box.fromJson(activeWallet.toJson().custody.encryptedSeedPhrase);

        const phrase = await key.unseal(phraseBox);
        if (!phrase) {
          throw new Error('Unable to decrypt seed phrase with password');
        }

        return phrase.split(' ');
      },
    };
  };

export const walletsSelector = (state: AllSlices) => state.wallets;
export const getActiveWallet = (state: AllSlices) =>
  state.wallets.all[0] && Wallet.fromJson(state.wallets.all[0]);
