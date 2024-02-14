import { create, StateCreator } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createIbcSendSlice, IbcSendSlice } from './ibc.ts';
import { createSendSlice, SendSlice } from './send.ts';
import { createSwapSlice, SwapSlice } from './swap.ts';
import { createUnclaimedSwapsSlice, UnclaimedSwapsSlice } from './unclaimed-swaps.ts';

export interface AllSlices {
  send: SendSlice;
  ibc: IbcSendSlice;
  swap: SwapSlice;
  unclaimedSwaps: UnclaimedSwapsSlice;
}

export type SliceCreator<SliceInterface> = StateCreator<
  AllSlices,
  [['zustand/immer', never]],
  [],
  SliceInterface
>;

export const initializeStore = () => {
  return immer((setState, getState: () => AllSlices, store) => ({
    send: createSendSlice()(setState, getState, store),
    ibc: createIbcSendSlice()(setState, getState, store),
    swap: createSwapSlice()(setState, getState, store),
    unclaimedSwaps: createUnclaimedSwapsSlice()(setState, getState, store),
  }));
};

export const useStore = create<AllSlices>()(initializeStore());
