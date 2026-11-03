/**
 * @author Aidan Boissonneault
 * @file occt-probe-commands.ts
 * @purpose Executes and summarizes commands for persistent OCCT probe workers.
 * @last-edited November 3, 2026
 */

import { getBridge } from '@bushscad/compiler/node';
import type { CompileAssets, IRProgram, MeshData } from '@bushscad/ir';
import type {
  GeometrySummary,
  ProbeCommand,
  ProbeMessage,
} from './occt-probe-protocol.js';
import { exportNativeBrep, importNativeBrep } from './native-brep-transfer.js';

type Bridge = Awaited<ReturnType<typeof getBridge>>;
type ResultExtra = Partial<Extract<ProbeMessage, { kind: 'result' }>>;

/** Executes one probe request and packages its command-specific payload. */
export function executeProbeCommand(
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

/** Converts worker commands into result/error messages and closes on shutdown. */
export async function handleProbeCommand(
  bridge: Bridge,
  command: ProbeCommand,
  handlers: {
    send: (message: ProbeMessage) => void;
    sendResult: (
      requestId: number,
      startedAt: number,
      extra?: ResultExtra,
    ) => void;
    close: () => void;
  },
): Promise<void> {
  const startedAt = performance.now();
  try {
    const outcome = executeProbeCommand(bridge, command);
    handlers.sendResult(command.requestId, startedAt, outcome.extra);
    if (outcome.shutdown) handlers.close();
  } catch (error) {
    handlers.send({
      kind: 'error',
      requestId: command.requestId,
      message:
        error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
}

/** Creates summary geometry metrics for the worker's built meshes. */
export function summarizeProbeMeshes(meshes: MeshData[]): GeometrySummary {
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

/** Lists serialization APIs exposed by the initialized OpenCascade runtime. */
export function serializationApis(bridge: unknown): string[] {
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

/** Builds the fixed cuboid used by geometry transfer probes. */
function buildCuboid(bridge: Bridge): ResultExtra {
  const result = bridge.build(cuboidProgram(), emptyAssets());
  if (!result.ok) throw new Error(result.error.message);
  return { geometry: summarizeProbeMeshes(result.meshes) };
}

/** Exports the fixed cuboid as STEP data for transfer probes. */
function exportStepCuboid(bridge: Bridge): ResultExtra {
  const result = bridge.export(cuboidProgram(), 'step', emptyAssets());
  if (!result.ok) throw new Error(result.error.message);
  const data = result.buffers[0]?.data;
  if (!data) throw new Error('Cuboid STEP export returned no data.');
  return { dataBase64: Buffer.from(data).toString('base64') };
}

/** Imports serialized STEP data and summarizes the rebuilt geometry. */
function importStepCuboid(bridge: Bridge, dataBase64: string): ResultExtra {
  const result = bridge.build(importProgram(), importAssets(dataBase64));
  if (!result.ok) throw new Error(result.error.message);
  return { geometry: summarizeProbeMeshes(result.meshes) };
}

/** Creates the minimal IR cuboid used by build and export probe commands. */
function cuboidProgram(): IRProgram {
  const span = { file: '(parallel-compilation-probe)', line: 1, col: 1 };
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

/** Creates the minimal IR program used to import transferred geometry. */
function importProgram(): IRProgram {
  const span = { file: '(parallel-compilation-probe)', line: 1, col: 1 };
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

/** Returns empty compile assets for a self-contained probe model. */
function emptyAssets(): CompileAssets {
  return { fonts: [], shapes: [] };
}

/** Packages STEP import bytes as a compile shape asset. */
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
