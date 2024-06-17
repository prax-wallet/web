import { Code, ConnectError } from '@connectrpc/connect';
import { approveOrigin } from '../approve-origin';
import { PraxConnection } from '../message/prax';
import { JsonValue } from '@bufbuild/protobuf';
import { UserChoice } from '@penumbra-zone/types/user-choice';

// listen for page connection requests.
// this is the only message we handle from an unapproved content script.
chrome.runtime.onMessage.addListener(
  (req: PraxConnection.Request | JsonValue, sender, respond: (arg: PraxConnection) => void) => {
    if (req !== PraxConnection.Request) return false; // instruct chrome we will not respond

    void approveOrigin(sender).then(
      status => {
        // user made a choice
        if (status === UserChoice.Approved) {
          respond(PraxConnection.Init);
          void chrome.tabs.sendMessage(sender.tab!.id!, PraxConnection.Init);
        } else {
          respond(PraxConnection.Denied);
        }
      },
      e => {
        if (globalThis.__DEV__) {
          console.warn('Connection request listener failed:', e);
        }
        if (e instanceof ConnectError && e.code === Code.Unauthenticated) {
          respond(PraxConnection.NeedsLogin);
        } else {
          respond(PraxConnection.Denied);
        }
      },
    );
    return true; // instruct chrome to wait for the response
  },
);
