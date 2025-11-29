import { ConnectError, Code } from '@connectrpc/connect';
import { sessionExtStorage } from '@repo/storage-chrome/session';
import { PopupPath } from './routes/popup/paths';

const POPUP_BASE = chrome.runtime.getURL('/popup.html');
const LOGIN_POLL_INTERVAL = 500;

/**
 * Opens a login popup window and waits for the user to log in.
 * Resolves when logged in, rejects if window is closed without logging in.
 */
const spawnLoginPopup = async (): Promise<void> => {
  const geometry = await chrome.windows
    .getLastFocused()
    .then(({ top = 0, left = 0, width = 0 }) => ({
      width: 400,
      height: 628,
      top: Math.max(0, top),
      left: Math.max(0, left + width - 400),
    }));

  const loginUrl = new URL(POPUP_BASE);
  loginUrl.hash = PopupPath.LOGIN;

  const win = await chrome.windows.create({
    url: loginUrl.href,
    type: 'popup',
    ...geometry,
  });

  const windowId = win.id!;

  // Wait for login by polling session storage
  return new Promise((resolve, reject) => {
    const checkLogin = async () => {
      // Check if user logged in
      const loggedIn = await sessionExtStorage.get('passwordKey');
      if (loggedIn) {
        // Close login window and resolve
        chrome.windows.remove(windowId).catch(() => {});
        resolve();
        return;
      }

      // Check if window was closed by user
      try {
        await chrome.windows.get(windowId);
        setTimeout(checkLogin, LOGIN_POLL_INTERVAL);
      } catch {
        reject(new ConnectError('Login cancelled', Code.Canceled));
      }
    };
    checkLogin();
  });
};

/**
 * Ensures user is logged in before continuing.
 * If not logged in, opens a login popup and waits for login.
 * Throws if user closes the login window without logging in.
 */
export const throwIfNeedsLogin = async () => {
  const loggedIn = await sessionExtStorage.get('passwordKey');
  if (!loggedIn) {
    await spawnLoginPopup();
  }
};
