import { Address } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';

export enum NobleRegistrationResponse {
  NeedsDeposit,
  Success,
  AlreadyRegistered,
}

export interface NobleClientInterface {
  registerAccount: (forwardingAddr: Address) => Promise<NobleRegistrationResponse>;
}

export class NobleClient implements NobleClientInterface {
  constructor(
    private readonly endpoint: string,
    private readonly channel: string,
  ) {}

  private async registerAccount() {}
}
