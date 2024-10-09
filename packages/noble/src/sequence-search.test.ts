import { describe, it } from 'vitest';
import { NobleClientInterface, NobleRegistrationResponse } from './client';
import { getNextSequence } from './sequence-search';
import { Address } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';

class MockNobleClient implements NobleClientInterface {
  private readonly sequenceResponses: Map<number, NobleRegistrationResponse>;
  private readonly getCurrentSequenceNumber: () => number;

  // Mock registerAccount method
  async registerAccount(addr: string) {
    const sequenceNumber = this.getCurrentSequenceNumber();
    const response =
      this.sequenceResponses.get(sequenceNumber) ?? NobleRegistrationResponse.NeedsDeposit;
    return Promise.resolve(response);
  }
}

describe('getNextSequence', () => {
  it('should find the first unused sequence number when all numbers are unused', async () => {
    const mockClient = new MockNobleClient();

    await getNextSequence({ client: mockClient, address: new Address() });
  });

  it('should find the next unused sequence number when some are already registered', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // Sequences 0 to 9 are already registered
    for (let i = 0; i <= 9; i++) {
      sequenceResponses.set(i, NobleRegistrationResponse.AlreadyRegistered);
    }
    const expectedSequence = 10;
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should handle alternating registered and unregistered sequence numbers', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // Alternate between AlreadyRegistered and NeedsDeposit
    for (let i = 0; i <= 20; i++) {
      if (i % 2 === 0) {
        sequenceResponses.set(i, NobleRegistrationResponse.AlreadyRegistered);
      } else {
        sequenceResponses.set(i, NobleRegistrationResponse.NeedsDeposit);
      }
    }
    const expectedSequence = 1; // First NeedsDeposit at sequence number 1
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should handle when all sequence numbers are already registered', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // All numbers return AlreadyRegistered
    for (let i = 0; i <= 65535; i++) {
      sequenceResponses.set(i, NobleRegistrationResponse.AlreadyRegistered);
    }
    // Since all are registered, it should return 65536 (one beyond the max)
    const expectedSequence = 65536;
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should correctly handle a Success response', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // Simulate a Success at sequence number 5
    sequenceResponses.set(5, NobleRegistrationResponse.Success);
    const expectedSequence = 6; // Should return 5 + 1
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should find the correct next sequence in a large range', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // Sequences 0 to 50000 are already registered
    for (let i = 0; i <= 50000; i++) {
      sequenceResponses.set(i, NobleRegistrationResponse.AlreadyRegistered);
    }
    // Next sequence number with NeedsDeposit
    sequenceResponses.set(50001, NobleRegistrationResponse.NeedsDeposit);
    const expectedSequence = 50001;
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should handle sequences where NeedsDeposit is followed by AlreadyRegistered', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // NeedsDeposit at sequence number 100
    sequenceResponses.set(100, NobleRegistrationResponse.NeedsDeposit);
    // AlreadyRegistered for sequences after 100
    for (let i = 101; i <= 65535; i++) {
      sequenceResponses.set(i, NobleRegistrationResponse.AlreadyRegistered);
    }
    const expectedSequence = 100;
    await getNextSequence(sequenceResponses, expectedSequence);
  });

  it('should handle sequences where Success is encountered during search', async () => {
    const sequenceResponses = new Map<number, NobleRegistrationResponse>();
    // Success at sequence number 25000
    sequenceResponses.set(25000, NobleRegistrationResponse.Success);
    const expectedSequence = 25001; // Should return 25000 + 1
    await getNextSequence(sequenceResponses, expectedSequence);
  });
});
