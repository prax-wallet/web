import { PlainMessage, toPlainMessage } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { viewTransactionPlan } from '@penumbra-zone/perspective/plan/view-transaction-plan';
import { TransactionClassification } from '@penumbra-zone/perspective/transaction/classification';
import { classifyTransaction } from '@penumbra-zone/perspective/transaction/classify';
import {
  asPublicTransactionView,
  asReceiverTransactionView,
} from '@penumbra-zone/perspective/translators/transaction-view';
import { AssetId, Metadata } from '@penumbra-zone/protobuf/penumbra/core/asset/v1/asset_pb';
import { FullViewingKey } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import {
  TransactionPlan,
  TransactionView,
} from '@penumbra-zone/protobuf/penumbra/core/transaction/v1/transaction_pb';
import { AuthorizeRequest } from '@penumbra-zone/protobuf/penumbra/custody/v1/custody_pb';
import type { Jsonified } from '@penumbra-zone/types/jsonified';
import { UserChoice } from '@penumbra-zone/types/user-choice';
import type { ExtensionStorage } from '@repo/storage-chrome/base';
import type { LocalStorageState } from '@repo/storage-chrome/local';
import { AllSlices, SliceCreator } from '.';
import { viewClient } from '../clients';
import { PopupRequest, PopupResponse, PopupType } from '../message/popup';
import { assertValidActionPlans } from './tx-validation/assert-valid-plan';

export interface TxApprovalSlice {
  responder?: PromiseWithResolvers<PopupResponse<PopupType.TxApproval>[PopupType.TxApproval]>;
  authorizeRequest?: PlainMessage<AuthorizeRequest>;
  transactionView?: PlainMessage<TransactionView>;
  invalidPlan?: Error;
  choice?: UserChoice;

  asSender?: PlainMessage<TransactionView>;
  asReceiver?: PlainMessage<TransactionView>;
  asPublic?: PlainMessage<TransactionView>;
  transactionClassification?: TransactionClassification;

  acceptRequest: (
    req: PopupRequest<PopupType.TxApproval>[PopupType.TxApproval],
  ) => Promise<PopupResponse<PopupType.TxApproval>[PopupType.TxApproval]>;

  setChoice: (choice: UserChoice) => void;

  sendResponse: () => void;
}

export const createTxApprovalSlice =
  (local: ExtensionStorage<LocalStorageState>): SliceCreator<TxApprovalSlice> =>
  (set, get) => ({
    acceptRequest: async req => {
      const authorizeRequest = AuthorizeRequest.fromJson(req.authorizeRequest);

      const existing = get().txApproval;
      if (existing.responder) {
        throw new Error('Another request is still pending');
      }

      const fvk = await local.get('wallets').then(([wallet0]) => {
        if (!wallet0) {
          throw new Error('No found wallet');
        }
        return FullViewingKey.fromJsonString(wallet0.fullViewingKey);
      });

      let invalidPlan: ConnectError | undefined;
      try {
        await assertValidActionPlans(authorizeRequest.plan?.actions, fvk);
        invalidPlan = undefined;
      } catch (e) {
        invalidPlan = ConnectError.from(e, Code.InvalidArgument);
      }

      const responder =
        Promise.withResolvers<PopupResponse<PopupType.TxApproval>[PopupType.TxApproval]>();
      set(state => {
        state.txApproval.responder = responder;
      });

      const getMetadata = async (assetId: AssetId) => {
        try {
          const { denomMetadata } = await viewClient.assetMetadataById({ assetId });
          return denomMetadata ?? new Metadata({ penumbraAssetId: assetId });
        } catch {
          return new Metadata({ penumbraAssetId: assetId });
        }
      };

      const transactionView = await viewTransactionPlan(
        authorizeRequest.plan ?? new TransactionPlan(),
        getMetadata,
        fvk,
      );

      // pregenerate views from various perspectives.
      const asSender = transactionView;
      const asPublic = asPublicTransactionView(transactionView);
      const asReceiver = await asReceiverTransactionView(transactionView, {
        // asRecieverTransactionView will need to ask viewClient about address provenace
        isControlledAddress: address =>
          viewClient.indexByAddress({ address }).then(({ addressIndex }) => Boolean(addressIndex)),
      });
      const transactionClassification = classifyTransaction(transactionView);

      set(state => {
        state.txApproval.authorizeRequest = toPlainMessage(authorizeRequest);
        state.txApproval.transactionView = toPlainMessage(transactionView);

        state.txApproval.asSender = toPlainMessage(asSender);
        state.txApproval.asPublic = toPlainMessage(asPublic);
        state.txApproval.asReceiver = toPlainMessage(asReceiver);
        state.txApproval.invalidPlan = invalidPlan;
        state.txApproval.transactionClassification = transactionClassification.type;

        state.txApproval.choice = undefined;
      });

      return responder.promise;
    },

    setChoice: choice => {
      set(state => {
        state.txApproval.choice = choice;
      });
    },

    sendResponse: () => {
      const { responder, choice, authorizeRequest, invalidPlan } = get().txApproval;

      try {
        if (!responder) {
          throw new ReferenceError('No responder');
        }

        try {
          if (invalidPlan) {
            throw invalidPlan;
          }

          if (choice === undefined || !authorizeRequest) {
            throw new ReferenceError('Missing response data');
          }

          responder.resolve({
            choice,
            authorizeRequest: new AuthorizeRequest(
              authorizeRequest,
            ).toJson() as Jsonified<AuthorizeRequest>,
          });
        } catch (e) {
          responder.reject(e);
        }
      } finally {
        set(state => {
          state.txApproval.responder = undefined;
          state.txApproval.authorizeRequest = undefined;
          state.txApproval.transactionView = undefined;
          state.txApproval.choice = undefined;
          state.txApproval.invalidPlan = undefined;

          state.txApproval.asSender = undefined;
          state.txApproval.asReceiver = undefined;
          state.txApproval.asPublic = undefined;
          state.txApproval.transactionClassification = undefined;
        });
      }
    },
  });

export const txApprovalSelector = (state: AllSlices) => state.txApproval;
