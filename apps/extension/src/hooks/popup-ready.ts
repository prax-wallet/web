import { useEffect, useRef } from 'react';
import { PopupResponse, PopupType, Ready } from '../message/popup';

type IsReady = boolean | undefined;

// signals that react is ready (mounted) to service worker
export const usePopupReady = (isReady: IsReady = undefined) => {
  const sentMessagesRef = useRef(new Set());
  const searchParams = new URLSearchParams(window.location.search);
  const popupId = searchParams.get('popupId');

  useEffect(() => {
    if (popupId && (isReady === undefined || isReady) && !sentMessagesRef.current.has(popupId)) {
      sentMessagesRef.current.add(popupId);

      void chrome.runtime.sendMessage({
        type: PopupType.Ready,
        data: {
          popupId,
        },
      } as PopupResponse<Ready>);
    }
  }, [popupId, isReady]);
};
