/**
 * @author Aidan Boissonneault
 * @file occt-cancellation-probe.ts
 * @purpose Provides OpenCascade cancellation probe behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { ProbeCommand, ProbeMessage } from './occt-probe-protocol.js';
import { writeJsonReport } from './report-output.js';

/** Verifies that a terminated OCCT child cannot kill the coordinator and can be replaced. */
async function run(): Promise<void> {
  const workerPath = resolve(
    readArg('--worker', 'packages/cli/dist/occt-probe-worker.js'),
  );
  const outPath = resolve(
    readArg(
      '--out',
      '.bushscad-analysis/parallel-compilation/p0-process-cancellation.json',
    ),
  );
  const startedAt = performance.now();
  const cancelled = launch(workerPath, 1);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
  const cancelStartedAt = performance.now();
  cancelled.kill();
  const cancelledExit = await waitForExit(cancelled);
  const cancelLatencyMs = performance.now() - cancelStartedAt;

  const replacement = launch(workerPath, 2);
  const ready = await waitUntilReady(replacement);
  const shutdownResult = await requestShutdown(replacement);
  const replacementExit = await waitForExit(replacement);
  const report = {
    generatedAt: new Date().toISOString(),
    cancelledExit,
    cancelLatencyMs,
    replacementReadyMs: ready.initializationMs,
    replacementRssBytes: ready.rssBytes,
    shutdownElapsedMs: shutdownResult.elapsedMs,
    replacementExit,
    totalWallMs: performance.now() - startedAt,
    coordinatorSurvived: true,
  };
  await writeJsonReport(outPath, report);
}

/**
 * Handles launch in the scripts parallel compilation flow.
 */
function launch(workerPath: string, workerId: number): ChildProcess {
  return fork(workerPath, [], {
    env: { ...process.env, BUSHSCAD_PROBE_WORKER_ID: String(workerId) },
    serialization: 'advanced',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
}

/**
 * Waits for until ready to reach the requested state.
 */
function waitUntilReady(
  child: ChildProcess,
): Promise<Extract<ProbeMessage, { kind: 'ready' }>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(
      () => rejectPromise(new Error('Replacement worker readiness timed out.')),
      120_000,
    );
    child.on('message', (raw) => {
      const message = raw as ProbeMessage;
      if (message.kind === 'ready') {
        clearTimeout(timer);
        resolvePromise(message);
      } else if (message.kind === 'error') {
        clearTimeout(timer);
        rejectPromise(new Error(message.message));
      }
    });
  });
}

/**
 * Handles request shutdown in the scripts parallel compilation flow.
 */
function requestShutdown(
  child: ChildProcess,
): Promise<Extract<ProbeMessage, { kind: 'result' }>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const requestId = 1;
    child.on('message', (raw) => {
      const message = raw as ProbeMessage;
      if (message.kind === 'result' && message.requestId === requestId)
        resolvePromise(message);
      else if (message.kind === 'error')
        rejectPromise(new Error(message.message));
    });
    const command: ProbeCommand = { kind: 'shutdown', requestId };
    child.send(command);
  });
}

/**
 * Waits for for exit to reach the requested state.
 */
function waitForExit(
  child: ChildProcess,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  if (child.exitCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((resolvePromise) =>
    child.once('exit', (code, signal) => resolvePromise({ code, signal })),
  );
}

/**
 * Reads arg from the supplied source.
 */
function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

void run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
