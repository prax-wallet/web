import { vi } from 'vitest';

// chrome.storage persistence middleware is run upon importing from `state/index.ts`.
// For tests, this is problematic as it uses globals. This mocks those out.
global.chrome = {
  storage: {
    onChanged: {
      addListener: vi.fn(),
    },
    local: {
      set: vi.fn(),
      get: vi.fn().mockReturnValue({ wallets: [] }),
      getBytesInUse: vi.fn().mockReturnValue(0),
      remove: vi.fn(),
    },
    session: {
      set: vi.fn(),
      get: vi.fn().mockReturnValue({}),
      remove: vi.fn(),
      getBytesInUse: vi.fn().mockReturnValue(0),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn().mockReturnValue({
      onMessage: {
        addListener: vi.fn(),
      },
      onDisconnect: {
        addListener: vi.fn(),
      },
    }),
  },
};

global.DEFAULT_GRPC_URL = 'https://rpc.example.com/';
global.PRAX = 'thisisnotarealextensionid';
