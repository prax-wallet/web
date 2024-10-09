import { describe, it, expect } from 'vitest';
import { NobleClientInterface, NobleRegistrationResponse } from './client';
import { getNextSequence } from './sequence-search';
import { generateSpendKey, getFullViewingKey } from '@penumbra-zone/wasm/keys';

class MockNobleClient implements NobleClientInterface {
  private readonly responses = new Map<string, NobleRegistrationResponse>();

  // Mock registerAccount method
  async registerAccount(addr: string) {
    const response = this.responses.get(addr) ?? NobleRegistrationResponse.NeedsDeposit;
    return Promise.resolve(response);
  }
}

const seedPhrase =
  'benefit cherry cannon tooth exhibit law avocado spare tooth that amount pumpkin scene foil tape mobile shine apology add crouch situate sun business explain';
const spendKey = generateSpendKey(seedPhrase);
const fvk = getFullViewingKey(spendKey);

describe('getNextSequence', () => {
  it('should find the first unused sequence number when all numbers are unused', async () => {
    const client = new MockNobleClient();
    const seq = await getNextSequence({ client, fvk, accountIndex: 132 });
    expect(seq).toEqual(0);
  });
});
