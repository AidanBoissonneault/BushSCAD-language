/**
 * @author Aidan Boissonneault
 * @file occt-probe-worker.ts
 * @purpose Provides OpenCascade probe worker behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { getBridge } from '@bushscad/compiler/node';
import type { ProbeCommand, ProbeMessage } from './occt-probe-protocol.js';
import {
  handleProbeCommand,
  serializationApis,
} from './occt-probe-commands.js';

/** Runs one persistent OCCT runtime for the P0 isolation experiment. */
async function startProbeWorker(): Promise<void> {
  const workerId = readWorkerId();
  const startedAt = performance.now();
  const bridge = await getBridge();
  const memory = process.memoryUsage();
  send({
    kind: 'ready',
    workerId,
    initializationMs: performance.now() - startedAt,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    serializationApis: serializationApis(bridge),
  });
  listen((command) =>
    void handleProbeCommand(bridge, command, {
      send,
      sendResult,
      close: closeCommandChannel,
    }),
  );
}

/**
 * Closes command channel and releases its resources.
 */
function closeCommandChannel(): void {
  if (!isMainThread) parentPort?.close();
  else process.disconnect?.();
}

/**
 * Handles send result in the scripts parallel compilation flow.
 */
function sendResult(
  requestId: number,
  startedAt: number,
  extra: Partial<Extract<ProbeMessage, { kind: 'result' }>> = {},
): void {
  const memory = process.memoryUsage();
  send({
    kind: 'result',
    requestId,
    elapsedMs: performance.now() - startedAt,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    ...extra,
  });
}

/**
 * Reads worker ID from the supplied source.
 */
function readWorkerId(): number {
  if (!isMainThread)
    return Number((workerData as { workerId?: number }).workerId ?? 0);
  return Number(process.env.BUSHSCAD_PROBE_WORKER_ID ?? 0);
}

/**
 * Handles listen in the scripts parallel compilation flow.
 */
function listen(handler: (command: ProbeCommand) => void): void {
  if (!isMainThread) parentPort?.on('message', handler);
  else process.on('message', (message) => handler(message as ProbeCommand));
}

/**
 * Handles send in the scripts parallel compilation flow.
 */
function send(message: ProbeMessage): void {
  if (!isMainThread) parentPort?.postMessage(message);
  else process.send?.(message);
}

void startProbeWorker().catch((error) => {
  send({
    kind: 'error',
    message:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  process.exitCode = 1;
});
