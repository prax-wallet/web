import { FullViewingKey } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { Query } from '@penumbra-zone/protobuf/noble/forwarding/v1/query_connect';
import { Msg } from '@penumbra-zone/protobuf/noble/forwarding/v1/tx_connect';
import { createPromiseClient, PromiseClient } from '@connectrpc/connect';
import { bech32mAddress } from '@penumbra-zone/bech32m/penumbra';
import { generateNobleAddr, getForwardingAddressForSequence } from '@penumbra-zone/wasm/keys';
import { QueryAddressResponse } from '@penumbra-zone/protobuf/noble/forwarding/v1/query_pb';

export enum NobleRegistrationResponse {
  NeedsDeposit,
  Success,
  AlreadyRegistered,
}

interface ForwardingProps {
  sequence: number;
  accountIndex?: number;
}

export interface NobleClientInterface {
  registerAccount: (props: ForwardingProps) => Promise<string>;
  queryAddress: (props: ForwardingProps) => Promise<QueryAddressResponse>;
}

interface NobleClientProps {
  endpoint: string;
  channel: string;
  fvk: FullViewingKey;
}

export class NobleClient implements NobleClientInterface {
  private readonly querier: PromiseClient<typeof Query>;
  private readonly tx: PromiseClient<typeof Msg>;
  private readonly channel: string;
  private readonly fvk: FullViewingKey;

  constructor({ endpoint, channel, fvk }: NobleClientProps) {
    this.fvk = fvk;
    this.channel = channel;
    const transport = createGrpcWebTransport({
      baseUrl: endpoint,
    });
    this.querier = createPromiseClient(Query, transport);
    this.tx = createPromiseClient(Msg, transport);
  }

  async registerAccount(props: ForwardingProps) {
    const { nobleAddr, penumbraAddr } = this.deriveForwardingAddrs(props);
    const { address } = await this.tx.registerAccount({
      signer: nobleAddr,
      recipient: bech32mAddress(penumbraAddr),
      channel: this.channel,
    });
    return address;
  }

  async queryAddress(props: ForwardingProps) {
    const { nobleAddr } = this.deriveForwardingAddrs(props);
    return await this.querier.address({ channel: this.channel, recipient: nobleAddr });
  }

  // Need docs
  private deriveForwardingAddrs({ accountIndex, sequence }: ForwardingProps) {
    const penumbraAddr = getForwardingAddressForSequence(sequence, this.fvk, accountIndex);
    const nobleAddr = generateNobleAddr(penumbraAddr, this.channel);
    return { penumbraAddr, nobleAddr };
  }
}
