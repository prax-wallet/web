enum ValidProtocol {
  'https:' = 'https:',
}

type ValidSender = chrome.runtime.MessageSender & {
  frameId: 0;
  documentId: string;
  tab: chrome.tabs.Tab & { id: number };

  // the relationship between origin and url is pretty complex.
  // just rely on the browser's tools.
  origin: `${ValidProtocol}//${string}`;
  url: `${ValidProtocol}//${string}/${string}`;
};

export const assertValidSender = (sender?: chrome.runtime.MessageSender) => {
  if (!sender) throw new Error('Sender undefined');
  if (!sender.tab?.id) throw new Error('Sender is not a tab');
  if (sender.frameId !== 0) throw new Error('Sender is not a top-level frame');
  if (!sender.documentId) throw new Error('Sender is not a document');

  if (!sender.origin) throw new Error('Sender has no origin');
  const parsedOrigin = new URL(sender.origin);
  if (parsedOrigin.origin !== sender.origin) throw new Error('Sender origin is invalid');
  if (!(parsedOrigin.protocol in ValidProtocol))
    throw new Error(`Sender protocol is not ${Object.values(ValidProtocol).join(',')}`);

  if (!sender.url) throw new Error('Sender has no URL');
  const parsedUrl = new URL(sender.url);
  if (parsedUrl.href !== sender.url) throw new Error('Sender URL is invalid');
  if (parsedUrl.origin !== parsedOrigin.origin) throw new Error('Sender URL has unexpected origin');

  // TODO: externally_connectable can use more sender data
  //if (!sender.tlsChannelId) throw new Error('Sender has no tlsChannelId');
  //if (!sender.id) throw new Error('Sender has no crx id');

  return sender as ValidSender;
};

export const isValidSender = (sender: chrome.runtime.MessageSender): sender is ValidSender => {
  try {
    return Boolean(assertValidSender(sender));
  } catch {
    return false;
  }
};
