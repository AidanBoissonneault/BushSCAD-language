/**
 * @author Aidan Boissonneault
 * @file runService.ts
 * @purpose Provides run service behavior for the service in cli package.
 * @last-edited October 6, 2026
 */

import { createInterface } from 'node:readline';
import { handleServiceRequest } from './handleServiceRequest.js';
import { stringifyCliResult } from '../dto/json.js';
import type {
  ServiceRequest,
  ServiceResponse,
  ServiceTraceMessage,
} from '../dto/types.js';
import { parseServiceRequest } from '../dto/request-parser.js';
import { PersistentOcctWorkerPool } from './parallel/persistent-worker-pool.js';
import { previewClassicInPool } from './parallel/classic-pool-preview.js';
import { exportInPool } from './parallel/pool-export.js';
import { previewWithDependencyAwareCompiler } from './parallel/dependency-aware-preview.js';
import { createVersionedTraceStream } from './tracing/versioned-trace-stream.js';

/**
 * Runs the persistent newline-delimited JSON service used by the CLI and VS Code
 * extension. It keeps a warm OpenCascade worker pool and streams trace,
 * pool-status, and final response messages through standard output.
 */
export function runService(): void {
  const pool = createParallelPool();
  process.on('uncaughtException', (err) => {
    process.stderr.write(`[BushSCAD service] ${err.stack ?? err.message}\n`);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[BushSCAD service] ${String(reason)}\n`);
  });

  // Start loading the OpenCascade WASM runtime immediately. It is a one-time
  // ~tens-of-seconds cost; warming it here overlaps with the user opening a
  // file so the first preview request does not pay the full cold-start.
  pool.warm();

  /**
   * Releases the owned resources held by this object.
   */
  const dispose = (): void => pool.dispose();
  process.once('exit', dispose);
  process.once('SIGTERM', () => {
    dispose();
    process.exit(0);
  });

  const rl = createInterface({ input: process.stdin });

  rl.on('line', (line) => void handleServiceLine(line, pool));
}

/** Parses, serves, and serializes one newline-delimited service request. */
export async function handleServiceLine(
  line: string,
  pool: PersistentOcctWorkerPool,
): Promise<void> {
      let request: ServiceRequest;

      try {
        request = parseServiceRequest(JSON.parse(line));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Invalid request: ${detail}\n`);
        return;
      }

      try {
        const trace = createVersionedTraceStream(request);
        const traceEvents: ServiceTraceMessage['event'][] = [];
        const response = await handleServiceRequest(request, {
          onOcctTraceEvent: (event) => {
            const versionedEvent = trace.next(event);
            traceEvents.push(versionedEvent);
            const message: ServiceTraceMessage = {
              id: request.id,
              kind: 'occt-trace',
              event: versionedEvent,
            };
            process.stdout.write(`${JSON.stringify(message)}\n`);
          },
          preview: async (options) => {
            if (request.engine === 'classic') {
              return previewClassicInPool(options, pool);
            }
            return previewWithDependencyAwareCompiler(options, pool);
          },
          export: (options) =>
            exportInPool(options, pool, request.engine ?? 'parallel'),
        });
        const tracedResponse = request.occtTrace
          ? { ...response, occtTraceEvents: traceEvents }
          : response;
        process.stdout.write(`${stringifyCliResult(tracedResponse)}\n`);
      } catch (error) {
        const response: ServiceResponse = {
          id: request.id,
          kind: request.kind,
          ok: false,
          errors: [
            {
              message: String(error),
              span: { file: request.filePath, line: 1, col: 1 },
            },
          ],
          env: [],
          elapsedMs: 0,
        };

        process.stdout.write(`${stringifyCliResult(response)}\n`);
      }
}

/**
 * Creates parallel pool with the supplied values.
 */
function createParallelPool(): PersistentOcctWorkerPool {
  const rawCount = Number(process.env['BUSHSCAD_OCCT_WORKERS'] ?? 1);
  const workerCount = Number.isInteger(rawCount)
    ? Math.max(1, Math.min(4, rawCount))
    : 1;
  return new PersistentOcctWorkerPool(workerCount, (status) => {
    process.stdout.write(
      `${JSON.stringify({ kind: 'pool-status', status })}\n`,
    );
  });
}
