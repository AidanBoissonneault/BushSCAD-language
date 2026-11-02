/**
 * @author Aidan Boissonneault
 * @file worker-runtime.ts
 * @purpose Provides worker runtime behavior for the worker in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  CompileAssets,
  ExportFormat,
  IRProgram,
  InteractionSnapshot,
  OcctTraceEvent,
  ResolvedJointData,
  ValidationResult,
} from '@bushscad/ir';
import { OcctBridge } from '../index.js';

/**
 * Occt worker in msg is tagged by kind: 'build' carries OCCT tracing flag and 'export' carries
 * export format.
 */
type OcctWorkerInMsg =
  | {
      kind: 'build';
      id: number;
      program: IRProgram;
      assets?: CompileAssets;
      occtTrace?: boolean;
    }
  | {
      kind: 'export';
      id: number;
      program: IRProgram;
      format: ExportFormat;
      assets?: CompileAssets;
    };

/**
 * Occt worker out msg is tagged by kind: 'build:ok' carries identifier, meshes, interaction,
 * 'build:error' carries identifier, message, span, 'export:ok' carries identifier, buffers,
 * 'export:error' carries identifier, message, span, 'ready', and 'error' carries message.
 */
type OcctWorkerOutMsg =
  | {
      kind: 'build:ok';
      id: number;
      meshes: unknown[];
      interaction?: InteractionSnapshot;
      validations: ValidationResult[];
      joints: ResolvedJointData[];
      occtTraceEvents?: OcctTraceEvent[];
    }
  | {
      kind: 'build:error';
      id: number;
      message: string;
      span: unknown;
      occtTraceEvents?: OcctTraceEvent[];
    }
  | {
      kind: 'export:ok';
      id: number;
      buffers: { name: string; data: ArrayBuffer }[];
    }
  | { kind: 'export:error'; id: number; message: string; span: unknown }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/**
 * Options for start occt bridge worker, including init bridge and handle unhandled errors.
 */
type StartOcctBridgeWorkerOptions = {
  initBridge?: () => Promise<OcctBridge>;
  handleUnhandledErrors?: boolean;
};

/**
 * Starts OpenCascade bridge worker with the supplied configuration.
 */
export function startOcctBridgeWorker({
  initBridge = () => OcctBridge.init(),
  handleUnhandledErrors = false,
}: StartOcctBridgeWorkerOptions = {}): void {
  let bridge: OcctBridge | null = null;

  self.addEventListener('message', (event: MessageEvent<OcctWorkerInMsg>) => {
    if (!bridge) {
      postMessage({
        kind: 'error',
        message: 'OCCT bridge not initialized',
      } satisfies OcctWorkerOutMsg);
      return;
    }

    const msg = event.data;
    try {
      postWorkerResult(bridge, msg);
    } catch (err) {
      if (!handleUnhandledErrors) throw err;
      postUnhandledError(msg, err);
    }
  });

  initBridge()
    .then((nextBridge) => {
      bridge = nextBridge;
      postMessage({ kind: 'ready' } satisfies OcctWorkerOutMsg);
    })
    .catch((err) => {
      postMessage({
        kind: 'error',
        message: String(err),
      } satisfies OcctWorkerOutMsg);
    });
}

/**
 * Handles post worker result in the worker flow.
 */
function postWorkerResult(bridge: OcctBridge, msg: OcctWorkerInMsg): void {
  if (msg.kind === 'build') {
    postBuildResult(bridge, msg);
    return;
  }
  if (msg.kind === 'export') postExportResult(bridge, msg);
}

/**
 * Handles post build result in the worker flow.
 */
function postBuildResult(
  bridge: OcctBridge,
  msg: Extract<OcctWorkerInMsg, { kind: 'build' }>,
): void {
  const result = bridge.build(msg.program, msg.assets, undefined, {
    trace: msg.occtTrace === true,
  });
  if (!result.ok) {
    postMessage({
      kind: 'build:error',
      id: msg.id,
      message: result.error.message,
      span: result.error.span,
      ...(result.occtTraceEvents
        ? { occtTraceEvents: result.occtTraceEvents }
        : {}),
    } satisfies OcctWorkerOutMsg);
    return;
  }

  const transferables = result.meshes.flatMap((mesh) => [
    mesh.vertices.buffer,
    mesh.normals.buffer,
    mesh.indices.buffer,
  ]) as Transferable[];
  postMessage(
    {
      kind: 'build:ok',
      id: msg.id,
      meshes: result.meshes,
      ...(result.interaction ? { interaction: result.interaction } : {}),
      validations: result.validations,
      joints: result.joints,
      ...(result.occtTraceEvents
        ? { occtTraceEvents: result.occtTraceEvents }
        : {}),
    } satisfies OcctWorkerOutMsg,
    { transfer: transferables },
  );
}

/**
 * Handles post export result in the worker flow.
 */
function postExportResult(
  bridge: OcctBridge,
  msg: Extract<OcctWorkerInMsg, { kind: 'export' }>,
): void {
  const result = bridge.export(msg.program, msg.format, msg.assets);
  if (!result.ok) {
    postMessage({
      kind: 'export:error',
      id: msg.id,
      message: result.error.message,
      span: result.error.span,
    } satisfies OcctWorkerOutMsg);
    return;
  }

  const transferables = result.buffers.map((buffer) => buffer.data);
  postMessage(
    {
      kind: 'export:ok',
      id: msg.id,
      buffers: result.buffers,
    } satisfies OcctWorkerOutMsg,
    { transfer: transferables },
  );
}

/**
 * Handles post unhandled error in the worker flow.
 */
function postUnhandledError(msg: OcctWorkerInMsg, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const kind = msg.kind === 'build' ? 'build:error' : 'export:error';
  postMessage({
    kind,
    id: msg.id,
    message: `Unhandled OCCT worker error: ${message}`,
    span: { file: '(worker)', line: 1, col: 1 },
  } satisfies OcctWorkerOutMsg);
}
