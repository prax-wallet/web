import { Button } from '@penumbra-zone/ui';
import { useStore } from '../../../state/index.ts';
import { sendSelector, sendValidationErrors } from '../../../state/send.ts';
import { useToast } from '@penumbra-zone/ui/components/ui/use-toast';
import { InputBlock } from '../../shared/input-block';
import { LoaderFunction, useLoaderData } from 'react-router-dom';
import { AccountBalance, getBalancesByAccount } from '../../../fetchers/balances';
import { useMemo } from 'react';
import { penumbraAddrValidation } from '../helpers';
import { throwIfExtNotInstalled } from '../../../fetchers/is-connected';
import InputToken from '../../shared/input-token.tsx';
import { useRefreshFee } from './use-refresh-fee.ts';

export const SendAssetBalanceLoader: LoaderFunction = async (): Promise<AccountBalance[]> => {
  throwIfExtNotInstalled();
  const balancesByAccount = await getBalancesByAccount();

  if (balancesByAccount[0]) {
    // set initial account if accounts exist and asset if account has asset list
    useStore.setState(state => {
      state.send.selection = {
        address: balancesByAccount[0]?.address,
        accountIndex: balancesByAccount[0]?.index,
        asset: balancesByAccount[0]?.balances[0],
      };
    });
  }

  return balancesByAccount;
};

export const SendForm = () => {
  const accountBalances = useLoaderData() as AccountBalance[];
  const { toast } = useToast();
  const {
    selection,
    amount,
    recipient,
    memo,
    fee,
    setAmount,
    setSelection,
    setRecipient,
    setMemo,
    sendTx,
    txInProgress,
  } = useStore(sendSelector);

  useRefreshFee();

  const validationErrors = useMemo(() => {
    return sendValidationErrors(selection?.asset, amount, recipient);
  }, [selection?.asset, amount, recipient]);

  return (
    <form
      className='flex flex-col gap-4 xl:gap-3'
      onSubmit={e => {
        e.preventDefault();
        void sendTx(toast);
      }}
    >
      <InputBlock
        label='Recipient'
        placeholder='penumbra1…'
        className='mb-1'
        inputClassName='font-mono'
        value={recipient}
        onChange={e => setRecipient(e.target.value)}
        validations={[penumbraAddrValidation()]}
      />
      <InputToken
        label='Amount to send'
        placeholder='Enter an amount'
        className='mb-1'
        selection={selection}
        setSelection={setSelection}
        value={amount}
        onChange={e => {
          if (Number(e.target.value) < 0) return;
          setAmount(e.target.value);
        }}
        validations={[
          {
            type: 'error',
            issue: 'insufficient funds',
            checkFn: () => validationErrors.amountErr,
          },
        ]}
        balances={accountBalances}
        fee={fee}
      />
      <InputBlock
        label='Memo'
        placeholder='Optional message'
        value={memo}
        onChange={e => setMemo(e.target.value)}
        validations={[
          {
            type: 'error',
            issue: 'memo too long (>369 bytes)',
            checkFn: () => validationErrors.memoErr,
          },
        ]}
      />
      <Button
        type='submit'
        variant='gradient'
        className='mt-3'
        size='lg'
        disabled={
          !Number(amount) ||
          !recipient ||
          !!Object.values(validationErrors).find(Boolean) ||
          txInProgress ||
          !selection?.asset
        }
      >
        Send
      </Button>
    </form>
  );
};