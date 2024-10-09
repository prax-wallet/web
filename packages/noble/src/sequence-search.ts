import { FullViewingKey } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import { NobleClientInterface, NobleRegistrationResponse } from './client';
import { getForwardingAddressForSequence } from '@penumbra-zone/wasm/keys';
import { bech32mAddress } from '@penumbra-zone/bech32m/penumbra';

// Search space (sequence number) is 2 bytes wide
const MAX_SEQUENCE_NUMBER = 65535;

// Perform binary search to find the first unused noble sequence number
export const getNextSequence = async ({
  fvk,
  accountIndex,
  client,
}: {
  client: NobleClientInterface;
  fvk: FullViewingKey;
  accountIndex?: number;
}): Promise<number> => {
  const left = 0;
  const right = MAX_SEQUENCE_NUMBER;
  const mid = Math.floor((left + right) / 2);

  return searchAndFetchSequence({ fvk, accountIndex, client, left, right, mid });
};

// Helper function to perform recursive binary search
const searchAndFetchSequence = async ({
  left,
  right,
  mid,
  client,
  fvk,
  accountIndex,
}: {
  left: number;
  right: number;
  mid: number;
  client: NobleClientInterface;
  fvk: FullViewingKey;
  accountIndex?: number;
}): Promise<number> => {
  const addr = getForwardingAddressForSequence(mid, fvk, accountIndex);
  const bech32Addr = bech32mAddress(addr);
  const response = await client.registerAccount(bech32Addr);

  switch (response) {
    case NobleRegistrationResponse.NeedsDeposit:
      if (left === mid || right === mid) {
        // We've iterated as far as we can; the next sequence number should be the midpoint
        return mid;
      }
      // The midpoint has not been registered yet; search the left-hand side
      return searchAndFetchSequence({
        left,
        right: mid,
        mid: Math.floor((left + mid) / 2),
        fvk,
        accountIndex,
        client,
      });

    case NobleRegistrationResponse.Success:
      // This means the midpoint had a deposit in it waiting for registration.
      // This will "flush" this unregistered address, however the user still wants a new one, so return the midpoint + 1.
      return mid + 1;

    case NobleRegistrationResponse.AlreadyRegistered:
      if (left === mid || right === mid) {
        // We've iterated as far as we can; the next sequence number after the midpoint should be the next available sequence number
        return mid + 1;
      }
      // The midpoint has been registered already; search the right-hand side
      return searchAndFetchSequence({
        left: mid,
        right,
        mid: Math.floor((right + mid) / 2),
        fvk,
        accountIndex,
        client,
      });
  }
};
