/**
 * Web Worker for rayon-based parallel transaction building.
 *
 * This worker initializes WASM with rayon thread pool support and builds
 * entire transactions in parallel using build_parallel_native.
 *
 * Unlike wasm-build-action.ts which builds individual actions, this worker
 * builds ALL actions concurrently via rayon's par_iter() in a single WASM call.
 */

import {
  AuthorizationData,
  Transaction,
  TransactionPlan,
  WitnessData,
} from '@penumbra-zone/protobuf/penumbra/core/transaction/v1/transaction_pb';
import type { JsonValue } from '@bufbuild/protobuf';
import type { ParallelBuildRequest } from '@penumbra-zone/types/internal-msg/offscreen';
import { FullViewingKey } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import actionKeys from '@penumbra-zone/keys';

// Map action types to proving key URLs
const keyFileNames: Partial<Record<string, URL>> = Object.fromEntries(
  Object.entries(actionKeys).map(([action, keyFile]) => [
    action,
    new URL('keys/' + keyFile, PRAX_ORIGIN),
  ]),
);

// Action type to proving key file mapping
const ACTION_KEY_FILES: Record<string, string> = {
  spend: 'spend_pk.bin',
  output: 'output_pk.bin',
  swap: 'swap_pk.bin',
  swapClaim: 'swapclaim_pk.bin',
  delegatorVote: 'delegator_vote_pk.bin',
  undelegateClaim: 'convert_pk.bin',
  actionLiquidityTournamentVote: 'delegator_vote_pk.bin',
};

// Propagate unhandled promise rejections
self.addEventListener(
  'unhandledrejection',
  event => {
    throw event.reason;
  },
  { once: true },
);

// Track initialization state
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize WASM with rayon parallel support.
 * Must be called before building transactions.
 */
const initParallelWasm = async () => {
  if (wasmInitialized) return;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    try {
      const wasmInit = await import('@penumbra-zone/wasm/init');

      if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error('SharedArrayBuffer not available - parallel WASM requires it');
      }

      const numThreads = navigator.hardwareConcurrency || 4;
      await wasmInit.initWasmWithParallel(numThreads);
      console.log(`[Parallel Build Worker] Initialized with ${numThreads} rayon threads`);
      wasmInitialized = true;
    } catch (error) {
      console.error('[Parallel Build Worker] Failed to initialize:', error);
      wasmInitPromise = null;
      throw error;
    }
  })();

  return wasmInitPromise;
};

// Track loaded proving keys
const loadedProvingKeys = new Set<string>();

/**
 * Load a proving key if not already loaded.
 */
const loadProvingKeyIfNeeded = async (
  actionType: string,
  loadKey: (key: Uint8Array, type: string) => void,
): Promise<void> => {
  if (loadedProvingKeys.has(actionType)) return;

  const keyFile = ACTION_KEY_FILES[actionType];
  if (!keyFile) {
    console.warn(`[Parallel Build Worker] No proving key file for action type: ${actionType}`);
    return;
  }

  const keyUrl = keyFileNames[actionType]?.href;
  if (!keyUrl) {
    console.warn(`[Parallel Build Worker] No key URL for action type: ${actionType}`);
    return;
  }

  console.log(`[Parallel Build Worker] Loading proving key: ${actionType}`);
  const response = await fetch(keyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch proving key: ${keyUrl}`);
  }

  const keyBytes = new Uint8Array(await response.arrayBuffer());
  loadKey(keyBytes, actionType);
  loadedProvingKeys.add(actionType);
};

/**
 * Get the set of action types that require proving keys from a transaction plan.
 */
const getRequiredProvingKeys = (txPlan: TransactionPlan): Set<string> => {
  const required = new Set<string>();

  for (const actionPlan of txPlan.actions) {
    const actionCase = actionPlan.action.case;
    if (!actionCase) continue;

    switch (actionCase) {
      case 'spend':
        required.add('spend');
        break;
      case 'output':
        required.add('output');
        break;
      case 'swap':
        required.add('swap');
        break;
      case 'swapClaim':
        required.add('swapClaim');
        break;
      case 'delegatorVote':
        required.add('delegatorVote');
        break;
      case 'undelegateClaim':
        required.add('undelegateClaim');
        break;
      case 'actionLiquidityTournamentVote':
        required.add('actionLiquidityTournamentVote');
        break;
    }
  }

  return required;
};

// Listen for build requests
const workerListener = ({ data }: { data: ParallelBuildRequest }) => {
  const {
    transactionPlan: transactionPlanJson,
    witness: witnessJson,
    fullViewingKey: fullViewingKeyJson,
    authData: authDataJson,
  } = data;

  // Deserialize payload
  const transactionPlan = TransactionPlan.fromJson(transactionPlanJson);
  const witness = WitnessData.fromJson(witnessJson);
  const fullViewingKey = FullViewingKey.fromJson(fullViewingKeyJson);
  const authData = AuthorizationData.fromJson(authDataJson);

  void executeWorker(transactionPlan, witness, fullViewingKey, authData).then(self.postMessage);
};

// Listen for all messages - worker is persistent
self.addEventListener('message', workerListener);

/**
 * Execute the parallel build.
 */
async function executeWorker(
  transactionPlan: TransactionPlan,
  witness: WitnessData,
  fullViewingKey: FullViewingKey,
  authData: AuthorizationData,
): Promise<JsonValue> {
  // Initialize parallel WASM first
  await initParallelWasm();

  // Import parallel WASM module directly - keys must be loaded into the same module that uses them
  const parallelWasm = await import('@penumbra-zone/wasm/wasm-parallel');

  // Load all required proving keys into the parallel WASM module
  const requiredKeys = getRequiredProvingKeys(transactionPlan);
  console.log(`[Parallel Build Worker] Loading ${requiredKeys.size} proving keys`);

  await Promise.all(
    Array.from(requiredKeys).map(actionType =>
      loadProvingKeyIfNeeded(actionType, parallelWasm.load_proving_key),
    ),
  );

  console.log('[Parallel Build Worker] Building transaction with rayon...');
  const startTime = performance.now();

  // Build all actions in parallel using rayon's build_parallel_native
  const result = parallelWasm.build_parallel_native(
    fullViewingKey.toBinary(),
    transactionPlan.toBinary(),
    witness.toBinary(),
    authData.toBinary(),
  );

  const transaction = Transaction.fromBinary(result);

  const elapsed = performance.now() - startTime;
  console.log(`[Parallel Build Worker] Built transaction in ${elapsed.toFixed(0)}ms`);

  return transaction.toJson();
}
