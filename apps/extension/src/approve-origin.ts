import { localExtStorage } from './storage/local';
import { OriginApproval, PopupType } from './message/popup';
import { popup } from './popup';
import { UserChoice } from '@penumbra-zone/types/user-choice';
import { produce } from 'immer';
import { OriginRecord } from './storage/types';

export const originAlreadyApproved = async (url: string): Promise<boolean> => {
  // parses the origin and returns a consistent format
  const urlOrigin = new URL(url).origin;
  const knownSites = await localExtStorage.get('knownSites');
  const existingRecord = knownSites.find(site => site.origin === urlOrigin);
  return existingRecord?.choice === UserChoice.Approved;
};

const getChoiceForOrigin = async (origin: string) => {
  const knownSites = await localExtStorage.get('knownSites');
  const existingRecords = knownSites.filter(record => record.origin === origin);
  if (!existingRecords.length) {
    return undefined;
  } else if (existingRecords.length === 1) {
    return existingRecords[0];
  } else {
    // TODO: It's likely that an array is not the best data structure for this in storage. Should revisit later.
    throw new Error(`There are multiple records for origin: ${origin}`);
  }
};

const addOrUpdateSiteRecord = async (proposal: OriginRecord) => {
  const knownSites = await localExtStorage.get('knownSites');
  const newKnownSites = produce(knownSites, allRecords => {
    const match = allRecords.find(r => r.origin === proposal.origin);
    if (!match) {
      allRecords.push(proposal);
    } else {
      match.choice = proposal.choice;
      match.date = proposal.date;
    }
  });
  await localExtStorage.set('knownSites', newKnownSites);
};

export const approveOrigin = async ({
  origin: senderOrigin,
  tab,
  frameId,
}: chrome.runtime.MessageSender): Promise<UserChoice> => {
  if (!senderOrigin?.startsWith('https://') || !tab?.id || frameId) {
    throw new Error('Unsupported sender');
  }

  // parses the origin and returns a consistent format
  const urlOrigin = new URL(senderOrigin).origin;
  const record = await getChoiceForOrigin(urlOrigin);

  // Choice already made
  if (record && (record.choice === UserChoice.Approved || record.choice === UserChoice.Ignored)) {
    return record.choice;
  }

  // It's the first or repeat ask
  const popupResponse = await popup<OriginApproval>({
    type: PopupType.OriginApproval,
    request: {
      origin: urlOrigin,
      favIconUrl: tab.favIconUrl,
      title: tab.title,
      lastRequest: record?.date,
    },
  });

  // if user interacted with popup, update record
  if (popupResponse) {
    await addOrUpdateSiteRecord(popupResponse);
  }

  return popupResponse?.choice ?? UserChoice.Denied;
};
