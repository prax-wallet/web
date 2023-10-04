// The request sent from the content scripts or popup that is handled by the service worker
import { SwRequestMessage } from './router';

export interface ServiceWorkerRequest<T extends SwRequestMessage> {
  penumbraSwReq: IncomingRequest<T>;
}

// The Response given back to consumer that matches their request
export type ServiceWorkerResponse<T extends SwRequestMessage> =
  | {
      penumbraSwRes: AwaitedResponse<T>;
    }
  | { penumbraSwError: string };

// The base interface that service worker functions should implement
export interface SwMessage<Type extends string, Req, Res> {
  type: Type;
  request: Req;
  response: Res;
}

// Meant as a helper to annotate service worker functions
// Creates a function: (request) => response out of `SwMessage`
export type SwMessageHandler<M extends SwMessage<string, unknown, unknown>> = (
  request: M['request'],
) => M['response'];

// The core message sent content-script/popup
export type IncomingRequest<T> = T extends SwMessage<infer Type, infer Req, unknown>
  ? { type: Type; data: Req }
  : never;

// The awaitable outputs of the handlers
type Responses<T> = T extends SwMessage<string, unknown, infer Res> ? Res : never;
export type SwResponse = Responses<SwRequestMessage>;

// The awaited response sent back to requestor
export type AwaitedResponse<T> = T extends SwMessage<infer Type, unknown, infer Res>
  ? { type: Type; data: Awaited<Res> }
  : never;

export type NoParams = Record<string, never>;