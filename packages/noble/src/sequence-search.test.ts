import { describe, it, expect } from 'vitest';
import { NobleClientInterface, NobleRegistrationResponse } from './client';
import { getNextSequence, MAX_SEQUENCE_NUMBER } from './sequence-search';
import {
  generateSpendKey,
  getForwardingAddressForSequence,
  getFullViewingKey,
} from '@penumbra-zone/wasm/keys';
import { Address } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import { bech32mAddress } from '@penumbra-zone/bech32m/penumbra';

const seedPhrase =
  'benefit cherry cannon tooth exhibit law avocado spare tooth that amount pumpkin scene foil tape mobile shine apology add crouch situate sun business explain';
const spendKey = generateSpendKey(seedPhrase);
const fvk = getFullViewingKey(spendKey);

class MockNobleClient implements NobleClientInterface {
  private readonly responses = new Map<string, NobleRegistrationResponse>();
  private override?: NobleRegistrationResponse = undefined;

  // Mock registerAccount method
  async registerAccount(addr: Address) {
    if (this.override) {
      return this.override;
    }

    const bech32Addr = bech32mAddress(addr);
    const response = this.responses.get(bech32Addr) ?? NobleRegistrationResponse.NeedsDeposit;
    return Promise.resolve(response);
  }

  setAllResponses(res: NobleRegistrationResponse) {
    this.override = res;
  }

  setResponse({
    response,
    sequence,
    accountIndex,
  }: {
    response: NobleRegistrationResponse;
    sequence: number;
    accountIndex?: number;
  }) {
    const addr = getForwardingAddressForSequence(sequence, fvk, accountIndex);
    const bech32Addr = bech32mAddress(addr);
    this.responses.set(bech32Addr, response);
  }
}

describe('getNextSequence', () => {
  it('should find the first unused sequence number when all numbers are unused', async () => {
    const client = new MockNobleClient();
    const seq = await getNextSequence({ client, fvk });
    expect(seq).toEqual(0);
  });

  it('should find the next unused sequence number when some numbers are used', async () => {
    const client = new MockNobleClient();
    client.setResponse({ response: NobleRegistrationResponse.AlreadyRegistered, sequence: 0 });
    client.setResponse({ response: NobleRegistrationResponse.AlreadyRegistered, sequence: 1 });

    const seq = await getNextSequence({ client, fvk });
    expect(seq).toEqual(2);
  });

  it('should return the next sequence number when the midpoint has a deposit waiting for registration', async () => {
    const client = new MockNobleClient();
    client.setResponse({ response: NobleRegistrationResponse.AlreadyRegistered, sequence: 0 });
    client.setResponse({ response: NobleRegistrationResponse.AlreadyRegistered, sequence: 1 });
    client.setResponse({ response: NobleRegistrationResponse.Success, sequence: 2 });

    const seq = await getNextSequence({ client, fvk });
    expect(seq).toEqual(3);
  });

  it('should handle the case when all sequence numbers are used', async () => {
    const client = new MockNobleClient();
    client.setAllResponses(NobleRegistrationResponse.AlreadyRegistered);

    const seq = await getNextSequence({ client, fvk });
    expect(seq).toEqual(MAX_SEQUENCE_NUMBER);
  });
});
