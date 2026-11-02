/**
 * @author Aidan Boissonneault
 * @file p7-service-client.ts
 * @purpose Provides p7 service client behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * Selects the benchmark execution path: the classic in-process compiler or the parallel worker
 * pool.
 */
export type Engine = 'classic' | 'parallel';

/**
 * Current worker-pool status, including desired and ready worker counts, startup duration, and
 * aggregate resident memory.
 */
export type PoolStatus = {
  state: string;
  desiredWorkers: number;
  readyWorkers: number;
  startupMs: number;
  aggregateWorkerRssBytes: number;
  peakAggregateWorkerRssBytes: number;
};

/**
 * Derives `ServiceResult` from `Record<string, unknown> & { id: number; kind: string; ok: boolean;
 * elapsedMs: number; compilerMetrics?: Record<string, unknown>; }` to preserve its type relationship
 * in the scripts parallel compilation layer.
 */
export type ServiceResult = Record<string, unknown> & {
  id: number;
  kind: string;
  ok: boolean;
  elapsedMs: number;
  compilerMetrics?: Record<string, unknown>;
};

/**
 * Request to preview or export a source file, with its workspace root and compiler engine plus
 * optional tracing, overlays, and format.
 */
export type ServiceRequest = {
  kind: 'preview' | 'export';
  filePath: string;
  rootPath: string;
  engine: Engine;
  occtTrace?: boolean;
  overlays?: Record<string, string>;
  format?: 'step';
};

/** Owns one benchmark service so all non-cold samples reuse the same pool. */
export class P7ServiceClient {
  private readonly stderr: string[] = [];
  private nextRequestId = 1;

  /**
   * Initializes the `P7ServiceClient` instance with the values supplied by its caller.
   */
  private constructor(
    private readonly child: ChildProcessWithoutNullStreams,
    readonly startupWallMs: number,
    readonly readyStatus: PoolStatus,
    private readonly messages: unknown[],
  ) {
    createInterface({ input: child.stderr }).on('line', (line) =>
      this.stderr.push(line),
    );
  }

  /** Starts the real compiled CLI and waits until every OCCT owner is ready. */
  static async start(
    cliPath: string,
    workerCount: number,
  ): Promise<P7ServiceClient> {
    const startedAt = performance.now();
    const child = spawn(process.execPath, [cliPath, '--service'], {
      env: {
        ...process.env,
        BUSHSCAD_OCCT_WORKERS: String(workerCount),
      },
      windowsHide: true,
    });
    const messages: unknown[] = [];
    createInterface({ input: child.stdout }).on('line', (line) => {
      try {
        messages.push(JSON.parse(line));
      } catch {
        messages.push({ kind: 'invalid-json', line });
      }
    });
    const status = await waitForReady(messages, child);
    const client = new P7ServiceClient(
      child,
      performance.now() - startedAt,
      status,
      messages,
    );
    return client;
  }

  /** Sends one source request and captures coordinator wall time separately. */
  async request(
    request: ServiceRequest,
  ): Promise<{ response: ServiceResult; wallMs: number }> {
    const id = this.nextRequestId++;
    const startedAt = performance.now();
    this.child.stdin.write(`${JSON.stringify({ id, ...request })}\n`);
    const response = await waitForResponse(
      this.messages,
      this.child,
      id,
      request.kind,
    );
    return { response, wallMs: performance.now() - startedAt };
  }

  /** Returns the newest pool status emitted after task memory was sampled. */
  latestStatus(): PoolStatus {
    const status = [...this.messages].reverse().find(isPoolStatusMessage);
    if (!status) return this.readyStatus;
    return status.status;
  }

  /** Gracefully shuts down the service and all child OCCT owners. */
  async stop(): Promise<void> {
    if (this.child.exitCode !== null) return;
    this.child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      this.child.once('exit', () => resolve());
      setTimeout(resolve, 10_000);
    });
  }
}

/**
 * Waits for for ready to reach the requested state.
 */
async function waitForReady(
  messages: unknown[],
  child: ChildProcessWithoutNullStreams,
): Promise<PoolStatus> {
  return waitForValue(messages, child, (message) =>
    isPoolStatusMessage(message) && message.status.state === 'ready'
      ? message.status
      : undefined,
  );
}

/**
 * Waits for for response to reach the requested state.
 */
async function waitForResponse(
  messages: unknown[],
  child: ChildProcessWithoutNullStreams,
  id: number,
  kind: ServiceRequest['kind'],
): Promise<ServiceResult> {
  return waitForValue(messages, child, (message) =>
    responseForRequest(message, id, kind),
  );
}

/**
 * Handles response for request in the scripts parallel compilation flow.
 */
function responseForRequest(
  value: unknown,
  id: number,
  kind: ServiceRequest['kind'],
): ServiceResult | undefined {
  if (!isServiceResult(value)) return undefined;
  return matchesRequest(value, id, kind) ? value : undefined;
}

/**
 * Returns whether the input meets the `service result` condition.
 */
function isServiceResult(value: unknown): value is ServiceResult {
  return isRecord(value) && typeof value.ok === 'boolean';
}

/**
 * Handles matches request in the scripts parallel compilation flow.
 */
function matchesRequest(
  value: ServiceResult,
  id: number,
  kind: ServiceRequest['kind'],
): boolean {
  return value.id === id && value.kind === kind;
}

/**
 * Waits for for value to reach the requested state.
 */
async function waitForValue<T>(
  messages: unknown[],
  child: ChildProcessWithoutNullStreams,
  select: (message: unknown) => T | undefined,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 240_000) {
    const value = selectNewest(messages, select);
    if (value !== undefined) return value;
    if (child.exitCode !== null)
      throw new Error(`Compiler service exited with ${child.exitCode}.`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Compiler service response timed out.');
}

/**
 * Selects newest according to the supplied filters.
 */
function selectNewest<T>(
  messages: readonly unknown[],
  select: (message: unknown) => T | undefined,
): T | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const value = select(messages[index]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Returns whether the input meets the `pool status message` condition.
 */
function isPoolStatusMessage(
  value: unknown,
): value is { kind: 'pool-status'; status: PoolStatus } {
  return (
    isRecord(value) && value.kind === 'pool-status' && isRecord(value.status)
  );
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
