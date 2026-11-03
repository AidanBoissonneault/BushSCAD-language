/**
 * @author Aidan Boissonneault
 * @file occt-probe-runner.ts
 * @purpose Provides OpenCascade probe runner behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { fork, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import type {
  ProbeCommand,
  ProbeMessage,
  ProbeMode,
  ProbeReport,
} from './occt-probe-protocol.js';
import { writeJsonReport } from './report-output.js';

/**
 * Worker lifecycle operations used by the probe runner: send a command, receive messages, and
 * terminate the worker.
 */
export type ProbeWorkerHandle = {
  send: (command: ProbeCommand) => void;
  onMessage: (listener: (message: ProbeMessage) => void) => void;
  terminate: () => Promise<void>;
};

/**
 * An in-flight worker request, pairing its promise settlement callbacks with the response being
 * awaited.
 */
type Pending = {
  resolve: (message: Extract<ProbeMessage, { kind: 'result' }>) => void;
  reject: (error: Error) => void;
};

/**
 * The geometry operation requested from the probe worker, such as building, importing, or
 * exporting a test shape.
 */
type ProbeRequestKind =
  | 'build-cuboid'
  | 'export-cuboid'
  | 'import-step'
  | 'export-brep'
  | 'import-brep'
  | 'memory';

/** Measures persistent OCCT worker initialization, reuse, idle memory, and transfer. */
type ProbeRunnerDependencies = {
  createWorker: typeof createWorker;
  writeJsonReport: typeof writeJsonReport;
  sleep: (milliseconds: number) => Promise<void>;
};

/** Runs persistent-worker measurements with injectable process and report services. */
export async function runProbe(
  argv: string[] = process.argv.slice(2),
  dependencies: ProbeRunnerDependencies = {
    createWorker,
    writeJsonReport,
    sleep: (milliseconds) =>
      new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
  },
): Promise<void> {
  const args = parseArgs(argv);
  const launchedAt = performance.now();
  const workers = Array.from({ length: args.workerCount }, (_, index) =>
    dependencies.createWorker(args.mode, index + 1, args.workerPath),
  );
  const ready = await Promise.all(workers.map(waitUntilReady));
  const wallInitializationMs = performance.now() - launchedAt;
  const clients = workers.map(createClient);
  try {
    const firstBuilds = await Promise.all(
      clients.map((client) => client.request('build-cuboid')),
    );
    const warmBuilds = await Promise.all(
      clients.map((client) => client.request('build-cuboid')),
    );
    const beforeIdle = await Promise.all(
      clients.map((client) => client.request('memory')),
    );
    await dependencies.sleep(args.idleMs);
    const afterIdle = await Promise.all(
      clients.map((client) => client.request('memory')),
    );
    const exporter = clients[0];
    const importer = clients[1] ?? clients[0];
    if (!exporter || !importer)
      throw new Error('At least one worker is required.');
    const exportResult = await exporter.request('export-cuboid');
    if (!exportResult.dataBase64)
      throw new Error('Transfer export returned no STEP payload.');
    const importResult = await importer.request(
      'import-step',
      exportResult.dataBase64,
    );
    const brepExportResult = await exporter.request('export-brep');
    if (!brepExportResult.dataBase64)
      throw new Error('Native transfer export returned no BRep payload.');
    const brepImportResult = await importer.request(
      'import-brep',
      brepExportResult.dataBase64,
    );
    const report: ProbeReport = {
      generatedAt: new Date().toISOString(),
      mode: args.mode,
      workerCount: args.workerCount,
      idleMs: args.idleMs,
      wallInitializationMs,
      ready,
      firstBuilds,
      warmBuilds,
      beforeIdle,
      afterIdle,
      transfer: {
        exportResult,
        importResult,
        stepBytes: Buffer.byteLength(exportResult.dataBase64, 'base64'),
      },
      nativeBrepTransfer: {
        exportResult: brepExportResult,
        importResult: brepImportResult,
        brepBytes: Buffer.byteLength(brepExportResult.dataBase64, 'base64'),
      },
    };
    await dependencies.writeJsonReport(args.outPath, report, reportSummary(report));
  } finally {
    await Promise.all(clients.map((client) => client.shutdown()));
  }
}

/**
 * Creates client with the supplied values.
 */
function createClient(handle: ProbeWorkerHandle): {
  request: (
    kind: ProbeRequestKind,
    data?: string,
  ) => Promise<Extract<ProbeMessage, { kind: 'result' }>>;
  shutdown: () => Promise<void>;
} {
  let nextRequestId = 1;
  const pending = new Map<number, Pending>();
  handle.onMessage((message) => {
    if (message.kind === 'ready') return;
    if (message.kind === 'error') {
      if (message.requestId !== undefined) {
        const request = pending.get(message.requestId);
        pending.delete(message.requestId);
        request?.reject(new Error(message.message));
      }
      return;
    }
    const request = pending.get(message.requestId);
    pending.delete(message.requestId);
    request?.resolve(message);
  });
  /**
   * Handles request in the scripts parallel compilation flow.
   */
  const request = (
    kind: ProbeRequestKind,
    dataBase64?: string,
  ): Promise<Extract<ProbeMessage, { kind: 'result' }>> => {
    const requestId = nextRequestId++;
    const command: ProbeCommand =
      kind === 'import-step' || kind === 'import-brep'
        ? { kind, requestId, dataBase64: dataBase64 ?? '' }
        : { kind, requestId };
    return new Promise((resolvePromise, rejectPromise) => {
      pending.set(requestId, {
        resolve: resolvePromise,
        reject: rejectPromise,
      });
      handle.send(command);
    });
  };
  return {
    request,
    shutdown: async () => {
      const requestId = nextRequestId++;
      await new Promise<void>((resolvePromise, rejectPromise) => {
        pending.set(requestId, {
          resolve: () => resolvePromise(),
          reject: rejectPromise,
        });
        handle.send({ kind: 'shutdown', requestId });
      });
      await handle.terminate();
    },
  };
}

/**
 * Handles report summary in the scripts parallel compilation flow.
 */
function reportSummary(report: ProbeReport): unknown {
  return {
    ...report,
    transfer: {
      ...report.transfer,
      exportResult: {
        ...report.transfer.exportResult,
        dataBase64: report.transfer.exportResult.dataBase64
          ? `(omitted ${report.transfer.stepBytes} bytes)`
          : undefined,
      },
    },
    nativeBrepTransfer: {
      ...report.nativeBrepTransfer,
      exportResult: {
        ...report.nativeBrepTransfer.exportResult,
        dataBase64: report.nativeBrepTransfer.exportResult.dataBase64
          ? `(omitted ${report.nativeBrepTransfer.brepBytes} bytes)`
          : undefined,
      },
    },
  };
}

/**
 * Waits for until ready to reach the requested state.
 */
function waitUntilReady(
  handle: ProbeWorkerHandle,
): Promise<Extract<ProbeMessage, { kind: 'ready' }>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(
      () => rejectPromise(new Error('OCCT probe worker readiness timed out.')),
      120_000,
    );
    handle.onMessage((message) => {
      if (message.kind === 'error' && message.requestId === undefined) {
        clearTimeout(timer);
        rejectPromise(new Error(message.message));
      } else if (message.kind === 'ready') {
        clearTimeout(timer);
        resolvePromise(message);
      }
    });
  });
}

/**
 * Creates worker with the supplied values.
 */
function createWorker(
  mode: ProbeMode,
  workerId: number,
  workerPath: string,
): ProbeWorkerHandle {
  if (mode === 'thread')
    return threadHandle(new Worker(workerPath, { workerData: { workerId } }));
  return processHandle(
    fork(workerPath, [], {
      env: { ...process.env, BUSHSCAD_PROBE_WORKER_ID: String(workerId) },
      serialization: 'advanced',
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    }),
  );
}

/**
 * Handles thread handle in the scripts parallel compilation flow.
 */
function threadHandle(worker: Worker): ProbeWorkerHandle {
  return {
    send: (command) => worker.postMessage(command),
    onMessage: (listener) => worker.on('message', listener),
    terminate: async () => void (await worker.terminate()),
  };
}

/**
 * Handles process handle in the scripts parallel compilation flow.
 */
function processHandle(child: ChildProcess): ProbeWorkerHandle {
  return {
    send: (command) => child.send?.(command),
    onMessage: (listener) =>
      child.on('message', (message) => listener(message as ProbeMessage)),
    terminate: async () => {
      if (child.exitCode !== null) return;
      await new Promise<void>((resolvePromise) => {
        child.once('exit', () => resolvePromise());
        setTimeout(() => {
          if (child.exitCode === null) child.kill();
        }, 2_000);
      });
    },
  };
}

/**
 * Parses args from the supplied source into the scripts parallel compilation representation.
 */
function parseArgs(args: string[]): {
  mode: ProbeMode;
  workerCount: number;
  idleMs: number;
  outPath: string;
  workerPath: string;
} {
  /**
   * Reads from the supplied source.
   */
  const read = (name: string, fallback: string): string => {
    const index = args.indexOf(name);
    return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
  };
  const mode = read('--mode', 'process') as ProbeMode;
  if (mode !== 'thread' && mode !== 'process')
    throw new Error(`Unsupported mode '${mode}'.`);
  const workerCount = Math.max(1, Number(read('--workers', '1')));
  const idleMs = Math.max(0, Number(read('--idle-ms', '10000')));
  return {
    mode,
    workerCount,
    idleMs,
    outPath: resolve(
      read(
        '--out',
        `.bushscad-analysis/parallel-compilation/p0-${mode}-${workerCount}.json`,
      ),
    ),
    workerPath: resolve(
      read('--worker', 'packages/cli/dist/occt-probe-worker.js'),
    ),
  };
}

const scriptPath = process.argv[1];
if (
  scriptPath &&
  pathToFileURL(resolve(scriptPath)).href === import.meta.url
) {
  void runProbe().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
