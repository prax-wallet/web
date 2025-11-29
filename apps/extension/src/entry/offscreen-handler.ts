import { ConnectError } from '@connectrpc/connect';
import { errorToJson } from '@connectrpc/connect/protocol-connect';
import {
  ActionBuildRequest,
  ActionBuildResponse,
  ParallelBuildRequest,
  ParallelBuildResponse,
  isActionBuildRequest,
  isParallelBuildRequest,
  isOffscreenRequest,
} from '@penumbra-zone/types/internal-msg/offscreen';

chrome.runtime.onMessage.addListener((req, _sender, respond) => {
  if (!isOffscreenRequest(req)) {
    return false;
  }
  const { type, request } = req;

  // Handle single action build (JS worker parallelism)
  if (type === 'BUILD_ACTION' && isActionBuildRequest(request)) {
    void handleBuildRequest(
      () => spawnActionBuildWorker(request),
      type,
      respond,
    );
    return true;
  }

  // Handle full parallel build (rayon parallelism)
  if (type === 'BUILD_PARALLEL' && isParallelBuildRequest(request)) {
    console.log('[Offscreen] Received BUILD_PARALLEL request, spawning rayon worker...');
    void handleBuildRequest(
      () => spawnParallelBuildWorker(request),
      type,
      respond,
    );
    return true;
  }

  return false;
});

/**
 * Generic handler for build requests with error handling.
 */
async function handleBuildRequest<T>(
  buildFn: () => Promise<T>,
  type: string,
  respond: (response: { type: string; data?: T; error?: unknown }) => void,
): Promise<void> {
  try {
    // propagate errors that occur in unawaited promises
    const unhandled = Promise.withResolvers<never>();
    self.addEventListener('unhandledrejection', unhandled.reject, {
      once: true,
    });

    const data = await Promise.race([buildFn(), unhandled.promise]).finally(() =>
      self.removeEventListener('unhandledrejection', unhandled.reject),
    );

    respond({ type, data });
  } catch (e) {
    const error = errorToJson(
      ConnectError.from(e instanceof PromiseRejectionEvent ? e.reason : e),
      undefined,
    );
    respond({ type, error });
  }
}

const spawnActionBuildWorker = (req: ActionBuildRequest) => {
  const { promise, resolve, reject } = Promise.withResolvers<ActionBuildResponse>();

  const worker = new Worker(new URL('../wasm-build-action.ts', import.meta.url));
  void promise.finally(() => worker.terminate());

  const onWorkerMessage = (e: MessageEvent) => resolve(e.data as ActionBuildResponse);

  const onWorkerError = ({ error, filename, lineno, colno, message }: ErrorEvent) =>
    reject(
      error instanceof Error
        ? error
        : new Error(`Worker ErrorEvent ${filename}:${lineno}:${colno} ${message}`),
    );

  const onWorkerMessageError = (ev: MessageEvent) => reject(ConnectError.from(ev.data ?? ev));

  worker.addEventListener('message', onWorkerMessage, { once: true });
  worker.addEventListener('error', onWorkerError, { once: true });
  worker.addEventListener('messageerror', onWorkerMessageError, { once: true });

  // Send data to web worker
  worker.postMessage(req);

  return promise;
};

/**
 * Persistent worker for rayon-based parallel transaction building.
 * Keeping the worker alive means:
 * - WASM only initializes once
 * - Rayon thread pool stays warm
 * - Proving keys stay cached in memory
 */
let persistentWorker: Worker | null = null;

const getOrCreateParallelWorker = (): Worker => {
  if (!persistentWorker) {
    console.log('[Offscreen] Creating persistent parallel build worker');
    persistentWorker = new Worker('wasm-build-parallel.js');

    // Handle worker errors - recreate on fatal error
    persistentWorker.addEventListener('error', (e) => {
      console.error('[Offscreen] Parallel worker error, will recreate:', e.message);
      persistentWorker = null;
    });
  }
  return persistentWorker;
};

/**
 * Build transaction using persistent rayon worker.
 * First build initializes WASM + loads keys, subsequent builds are faster.
 */
const spawnParallelBuildWorker = (req: ParallelBuildRequest) => {
  const { promise, resolve, reject } = Promise.withResolvers<ParallelBuildResponse>();

  const worker = getOrCreateParallelWorker();

  const onWorkerMessage = (e: MessageEvent) => {
    resolve(e.data as ParallelBuildResponse);
  };

  const onWorkerError = ({ error, filename, lineno, colno, message }: ErrorEvent) => {
    // Don't kill worker on build error, just reject this request
    reject(
      error instanceof Error
        ? error
        : new Error(`Parallel Worker ErrorEvent ${filename}:${lineno}:${colno} ${message}`),
    );
  };

  const onWorkerMessageError = (ev: MessageEvent) => reject(ConnectError.from(ev.data ?? ev));

  // Use once:true so handlers don't stack up
  worker.addEventListener('message', onWorkerMessage, { once: true });
  worker.addEventListener('error', onWorkerError, { once: true });
  worker.addEventListener('messageerror', onWorkerMessageError, { once: true });

  // Send data to web worker
  worker.postMessage(req);

  return promise;
};
