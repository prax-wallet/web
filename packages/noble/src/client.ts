export enum NobleRegistrationResponse {
  NeedsDeposit,
  Success,
  AlreadyRegistered,
}

export interface NobleClientInterface {
  registerAccount: (nobleAddr: string) => Promise<NobleRegistrationResponse>;
}

export class NobleClient implements NobleClientInterface {
  constructor(
    private readonly endpoint: string,
    private readonly channel: string,
  ) {}

  private async registerAccount() {}
}
