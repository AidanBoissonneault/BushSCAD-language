/**
 * @author Aidan Boissonneault
 * @file parallel-service-harness.ts
 * @purpose Tests parallel service harness behavior in the fixtures in cli package.
 * @last-edited October 6, 2026
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import type { ServiceResponse } from '../../src/dto/types.js';
import type { ParallelPoolStatus } from '../../src/service/parallel/worker-protocol.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const defaultFixture = resolve(
  fixtureDir,
  'parallel-independent-parts.bscd',
);

export const parallelCliEntry = resolve(fixtureDir, '../../dist/index.js');

/** Starts the real CLI service and waits for its persistent OCCT pool. */
export async function startParallelService(
  workerCount?: number,
  envOverrides: Readonly<Record<string, string>> = {},
): Promise<{
  process: ChildProcessWithoutNullStreams;
  messages: unknown[];
}> {
  const env = { ...process.env };
  delete env['BUSHSCAD_EXPERIMENTAL_PARALLEL'];
  delete env['BUSHSCAD_OCCT_WORKERS'];
  if (workerCount !== undefined) {
    env['BUSHSCAD_OCCT_WORKERS'] = String(workerCount);
  }
  Object.assign(env, envOverrides);
  const child = spawn(process.execPath, [parallelCliEntry, '--service'], {
    env,
    windowsHide: true,
  });
  const messages: unknown[] = [];
  createInterface({ input: child.stdout }).on('line', (line) =>
    messages.push(JSON.parse(line)),
  );
  await waitFor(() => poolIsReady(messages));
  return { process: child, messages };
}

/** Sends one preview request and returns its source-matched service response. */
export async function requestPreview(
  child: ChildProcessWithoutNullStreams,
  messages: unknown[],
  id: number,
  engine?: 'classic',
  occtTrace = false,
  filePath = defaultFixture,
): Promise<ServiceResponse> {
  child.stdin.write(
    `${JSON.stringify({
      id,
      kind: 'preview',
      filePath,
      rootPath: resolve(fixtureDir, '../../../..'),
      entrypointMode: 'requested-file',
      ...(engine ? { engine } : {}),
      ...(occtTrace ? { occtTrace: true } : {}),
    })}\n`,
  );
  await waitFor(() => messages.some((message) => isResponse(message, id)));
  return messages.find((message) => isResponse(message, id)) as ServiceResponse;
}

/** Sends one export request and returns its source-matched service response. */
export async function requestExport(
  child: ChildProcessWithoutNullStreams,
  messages: unknown[],
  id: number,
  filePath: string,
  format: 'step' | 'stl',
): Promise<ServiceResponse> {
  child.stdin.write(
    `${JSON.stringify({
      id,
      kind: 'export',
      filePath,
      rootPath: resolve(fixtureDir, '../../../..'),
      entrypointMode: 'requested-file',
      format,
    })}\n`,
  );
  await waitFor(() =>
    messages.some((message) => isResponse(message, id, 'export')),
  );
  return messages.find((message) =>
    isResponse(message, id, 'export'),
  ) as ServiceResponse;
}

/** Waits for asynchronous service state with a bounded integration timeout. */
export async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 50_000)
      throw new Error('Service wait timed out.');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}

/**
 * Handles pool status count in the fixtures flow.
 */
export function poolStatusCount(
  messages: readonly unknown[],
  state: ParallelPoolStatus['state'],
): number {
  return messages.filter(
    (message) =>
      isRecord(message) &&
      message.kind === 'pool-status' &&
      isRecord(message.status) &&
      message.status.state === state,
  ).length;
}

/**
 * Handles pool is ready in the fixtures flow.
 */
function poolIsReady(messages: readonly unknown[]): boolean {
  return poolStatusCount(messages, 'ready') > 0;
}

/**
 * Returns whether the input meets the `response` condition.
 */
function isResponse(
  value: unknown,
  id: number,
  kind: ServiceResponse['kind'] = 'preview',
): boolean {
  return isRecord(value) && value.id === id && value.kind === kind;
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
