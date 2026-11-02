/**
 * @author Aidan Boissonneault
 * @file occt-probe-worker.ts
 * @purpose Provides OpenCascade probe worker behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { getBridge } from '@bushscad/compiler/node';
import type { CompileAssets, IRProgram, MeshData } from '@bushscad/ir';
import type {
  GeometrySummary,
  ProbeCommand,
  ProbeMessage,
} from './occt-probe-protocol.js';
import { exportNativeBrep, importNativeBrep } from './native-brep-transfer.js';

const span = { file: '(parallel-compilation-probe)', line: 1, col: 1 };
/**
 * The initialized OpenCascade bridge used by the probe to build, import, and export native
 * shapes.
 */
type Bridge = Awaited<ReturnType<typeof getBridge>>;
/**
 * Optional payload fields used when constructing a successful probe result message.
 */
type ResultExtra = Partial<Extract<ProbeMessage, { kind: 'result' }>>;

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
  listen((command) => void handleCommand(bridge, command));
}

/**
 * Handles command in the current scripts parallel compilation flow.
 */
async function handleCommand(
  bridge: Bridge,
  command: ProbeCommand,
): Promise<void> {
  const startedAt = performance.now();
  try {
    const outcome = executeCommand(bridge, command);
    sendResult(command.requestId, startedAt, outcome.extra);
    if (outcome.shutdown) closeCommandChannel();
  } catch (error) {
    send({
      kind: 'error',
      requestId: command.requestId,
      message:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
}

/**
 * Handles execute command in the scripts parallel compilation flow.
 */
function executeCommand(
  bridge: Bridge,
  command: ProbeCommand,
): { extra?: ResultExtra; shutdown?: boolean } {
  switch (command.kind) {
    case 'shutdown':
      return { shutdown: true };
    case 'memory':
      return {};
    case 'build-cuboid':
      return { extra: buildCuboid(bridge) };
    case 'export-cuboid':
      return { extra: exportStepCuboid(bridge) };
    case 'export-brep':
      return { extra: { dataBase64: exportNativeBrep(bridge) } };
    case 'import-brep':
      return {
        extra: { geometry: importNativeBrep(bridge, command.dataBase64) },
      };
    case 'import-step':
      return { extra: importStepCuboid(bridge, command.dataBase64) };
  }
}

/**
 * Builds cuboid from the supplied inputs.
 */
function buildCuboid(bridge: Bridge): ResultExtra {
  const result = bridge.build(cuboidProgram(), emptyAssets());
  if (!result.ok) throw new Error(result.error.message);
  return { geometry: summarizeMeshes(result.meshes) };
}

/**
 * Exports step cuboid to the requested format.
 */
function exportStepCuboid(bridge: Bridge): ResultExtra {
  const result = bridge.export(cuboidProgram(), 'step', emptyAssets());
  if (!result.ok) throw new Error(result.error.message);
  const data = result.buffers[0]?.data;
  if (!data) throw new Error('Cuboid STEP export returned no data.');
  return { dataBase64: Buffer.from(data).toString('base64') };
}

/**
 * Imports step cuboid into the current workspace.
 */
function importStepCuboid(bridge: Bridge, dataBase64: string): ResultExtra {
  const result = bridge.build(importProgram(), importAssets(dataBase64));
  if (!result.ok) throw new Error(result.error.message);
  return { geometry: summarizeMeshes(result.meshes) };
}

/**
 * Closes command channel and releases its resources.
 */
function closeCommandChannel(): void {
  if (!isMainThread) parentPort?.close();
  else process.disconnect?.();
}

/**
 * Handles cuboid program in the scripts parallel compilation flow.
 */
function cuboidProgram(): IRProgram {
  return {
    ops: [
      { kind: 'part', name: 'probe', color: null, span },
      {
        kind: 'solidPrimitive',
        objName: 'probe_cuboid',
        shape: { primitive: 'cuboid', size: [40, 40, 60], segments: 1 },
        placement: null,
        span,
      },
    ],
    parts: ['probe'],
    baseUnitMm: 1,
    workplane: 'XY',
  };
}

/**
 * Imports program into the current workspace.
 */
function importProgram(): IRProgram {
  return {
    ops: [
      { kind: 'part', name: 'transfer_probe', color: null, span },
      {
        kind: 'solidPrimitive',
        objName: 'transfer_base',
        shape: { primitive: 'cuboid', size: [1, 1, 1], segments: 1 },
        placement: null,
        span,
      },
      {
        kind: 'importShape',
        name: 'transferred',
        fsPath: '/shapes/imported/transferred.step',
        format: 'step',
        span,
      },
      {
        kind: 'alignShape',
        name: 'transferred',
        instanceName: 'transferred_instance',
        sourceRef: null,
        targetPlacement: { faceRef: 'transfer_base.top.center' },
        span,
      },
    ],
    parts: ['transfer_probe'],
    baseUnitMm: 1,
    workplane: 'XY',
  };
}

/**
 * Handles empty assets in the scripts parallel compilation flow.
 */
function emptyAssets(): CompileAssets {
  return { fonts: [], shapes: [] };
}

/**
 * Imports assets into the current workspace.
 */
function importAssets(dataBase64: string): CompileAssets {
  return {
    fonts: [],
    shapes: [
      {
        name: 'transferred',
        sourcePath: '(probe-transfer)',
        fsPath: '/shapes/imported/transferred.step',
        format: 'step',
        data: new Uint8Array(Buffer.from(dataBase64, 'base64')),
      },
    ],
  };
}

/**
 * Handles summarize meshes in the scripts parallel compilation flow.
 */
function summarizeMeshes(meshes: MeshData[]): GeometrySummary {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let triangleCount = 0;
  for (const mesh of meshes) {
    triangleCount += mesh.indices.length / 3;
    for (let index = 0; index < mesh.vertices.length; index += 3) {
      for (let axis = 0; axis < 3; axis++) {
        const value = mesh.vertices[index + axis] ?? 0;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
  }
  return { meshCount: meshes.length, triangleCount, bounds: { min, max } };
}

/**
 * Handles serialization apis in the scripts parallel compilation flow.
 */
function serializationApis(bridge: unknown): string[] {
  const oc = (bridge as { oc?: Record<string, unknown> }).oc;
  if (!oc) return [];
  const topLevel = Object.keys(oc).filter((key) =>
    /^(BRepTools|BinTools)(_|$)/.test(key),
  );
  const tools = oc.BRepTools;
  const methods =
    tools && (typeof tools === 'object' || typeof tools === 'function')
      ? Object.keys(tools).map((key) => `BRepTools.${key}`)
      : [];
  return [...topLevel, ...methods].sort();
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
