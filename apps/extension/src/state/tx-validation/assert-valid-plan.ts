import { AnyMessage, Message, PartialMessage } from '@bufbuild/protobuf';
import { bech32mAddress } from '@penumbra-zone/bech32m/penumbra';
import { Address, FullViewingKey } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import { ActionPlan } from '@penumbra-zone/protobuf/penumbra/core/transaction/v1/transaction_pb';
// Dynamic import to avoid bundling WASM into initial chunks (service worker)
// import { isControlledAddress } from '@penumbra-zone/wasm/address';
import { Code, ConnectError } from '@connectrpc/connect';

/** guard nonzero inner */
const hasInner = <M extends Message<M> = AnyMessage>(
  a?: PartialMessage<M>,
): a is PartialMessage<M> & { inner: Uint8Array } =>
  a != null &&
  'inner' in a &&
  a.inner instanceof Uint8Array &&
  !!a.inner.length &&
  a.inner.some(v => v);

/** Assert specific features for some plans. */
export async function assertValidActionPlans(
  actions?: PartialMessage<ActionPlan>[],
  fvk?: PartialMessage<FullViewingKey>,
): Promise<void> {
  if (!actions?.length) {
    throw new RangeError('No actions planned', { cause: actions });
  }

  for (const actionPlan of actions) {
    await assertValidActionPlan(actionPlan, fvk);
  }
}

export async function assertValidActionPlan(
  actionPlan: PartialMessage<ActionPlan>,
  fvk?: PartialMessage<FullViewingKey>,
): Promise<void> {
  const { action } = actionPlan;

  if (action?.value == null || !Object.values(action.value).some(v => v != null)) {
    throw new TypeError('Missing action plan', { cause: action });
  }

  /* eslint default-case: ["error"] -- explicitly require a default case for handling unexpected input */
  /* eslint @typescript-eslint/switch-exhaustiveness-check: ["error", { allowDefaultCaseForExhaustiveSwitch: true, considerDefaultExhaustiveForUnions: false }] -- explicitly mention every action type */
  switch (action.case) {
    /**
     * minimal sanity check: output destination address is present and valid
     * @todo: check if this is correct validation
     */
    case 'output':
      {
        if (!hasInner(action.value.destAddress)) {
          throw new ReferenceError('Output action missing destination address');
        }

        try {
          bech32mAddress(action.value.destAddress);
        } catch (invalidAddress) {
          throw new TypeError('Output action has invalid destination address', { cause: action });
        }
      }
      return;

    /**
     * swaps are followed by a swapClaim to deliver the outputs. the swap plan
     * specifies the claim address in advance.
     *
     * the swap plan is an external input, created by some frontend dapp.  any
     * output address may be planned, but most users will probably never want
     * their swap outputs to be delivered to somebody else.  so the claim
     * address is inspected to confirm that it's not someone else's address.
     */
    case 'swap':
      {
        if (!hasInner(action.value.swapPlaintext?.claimAddress)) {
          throw new ReferenceError('Swap action missing claim address', { cause: action });
        }

        let bech32mClaimAddress: string;
        try {
          bech32mClaimAddress = bech32mAddress(action.value.swapPlaintext.claimAddress);
        } catch (invalidAddress) {
          throw new TypeError('Swap action has invalid claim address', { cause: action });
        }

        if (!hasInner(fvk)) {
          throw ConnectError.from(
            new ReferenceError('Full viewing key is required to validate swap action'),
            Code.Unauthenticated,
          );
        }

        // Dynamic import to avoid bundling WASM into initial chunks (service worker)
        const { isControlledAddress } = await import('@penumbra-zone/wasm/address');

        if (
          !isControlledAddress(
            new FullViewingKey(fvk),
            new Address(action.value.swapPlaintext.claimAddress),
          )
        ) {
          throw new Error(`Swap action has uncontrolled claim address ${bech32mClaimAddress}`, {
            cause: action,
          });
        }
      }
      return;

    /**
     * for convenience, swapClaims support a unique feature: they may be issued
     * without authorization by the spend key, because the swap has specified
     * the claim address in advance.  so, a swapClaim should not be authorized.
     */
    case 'swapClaim':
      throw new TypeError('Swap claim action does not require authorization');

    case 'actionDutchAuctionEnd':
    case 'actionDutchAuctionSchedule':
    case 'actionDutchAuctionWithdraw':
    case 'actionLiquidityTournamentVote':
    case 'communityPoolDeposit':
    case 'communityPoolOutput':
    case 'communityPoolSpend':
    case 'delegate':
    case 'delegatorVote':
    case 'ibcRelayAction':
    case 'ics20Withdrawal':
    case 'positionClose':
    case 'positionOpen':
    case 'positionOpenPlan':
    case 'positionRewardClaim':
    case 'positionWithdraw':
    case 'proposalDepositClaim':
    case 'proposalSubmit':
    case 'proposalWithdraw':
    case 'spend':
    case 'undelegate':
    case 'undelegateClaim':
    case 'validatorDefinition':
    case 'validatorVote':
      // no specific assertions
      return;

    default:
      action satisfies never;
      throw new TypeError('Unknown action plan', { cause: action });
  }
}
