/**
 * @author Aidan Boissonneault
 * @file p7-response-contract.ts
 * @purpose Provides p7 response contract behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { createHash } from 'node:crypto';
import type { ServiceResult } from './p7-service-client.js';

/** Hashes all stable compiler and geometry fields used by the P7 parity gate. */
export function responseContract(response: ServiceResult): {
  hash: string;
  value: unknown;
} {
  const value = response.ok
    ? successContract(response)
    : failureContract(response);
  return {
    hash: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    value,
  };
}

/**
 * Handles success contract in the scripts parallel compilation flow.
 */
function successContract(response: ServiceResult): unknown {
  return {
    ok: true,
    program: response.program,
    meshes: array(response.meshes).map(meshContract),
    interaction: interactionContract(response.interaction),
    drawings: response.drawings,
    validations: response.validations,
    joints: response.joints,
    env: response.env,
    dependents: response.dependents,
    buffers: array(response.buffers).map(bufferContract),
    traceErrors: array(response.occtTraceEvents)
      .filter(isErrorTrace)
      .map(traceContract),
  };
}

/**
 * Handles failure contract in the scripts parallel compilation flow.
 */
function failureContract(response: ServiceResult): unknown {
  return {
    ok: false,
    errors: response.errors,
    env: response.env,
    traceErrors: array(response.occtTraceEvents)
      .filter(isErrorTrace)
      .map(traceContract),
  };
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshContract(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const vertices = numberArray(value.vertices);
  const indices = numberArray(value.indices);
  const geometry = meshGeometry(vertices);
  return {
    partName: value.partName,
    bodyName: value.bodyName,
    color: value.color,
    material: value.material,
    vertexCount: vertices.length / 3,
    triangleCount: indices.length / 3,
    ...geometry,
  };
}

/** Reduces coordinates to stable bounds and sums independent of tessellation order. */
function meshGeometry(vertices: readonly number[]): {
  bounds: number[][];
  sums: number[];
} {
  const bounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity, -Infinity, -Infinity],
  ];
  const sums = [0, 0, 0];
  for (let index = 0; index < vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = vertices[index + axis] ?? 0;
      bounds[0][axis] = Math.min(bounds[0][axis], coordinate);
      bounds[1][axis] = Math.max(bounds[1][axis], coordinate);
      sums[axis] += coordinate;
    }
  }
  return { bounds, sums };
}

/**
 * Builds the interaction data required by the current scene.
 */
function interactionContract(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    topology: array(value.topology).map((entry) => {
      if (!isRecord(entry)) return entry;
      return {
        meshIndex: entry.meshIndex,
        partEntityId: entry.partEntityId,
        objectEntityId: entry.objectEntityId,
        faces: topologyContract(entry.faces, 'triangleCount'),
        edges: topologyContract(entry.edges, 'points'),
        corners: topologyContract(entry.corners),
      };
    }),
  };
}

/**
 * Handles topology contract in the scripts parallel compilation flow.
 */
function topologyContract(
  value: unknown,
  aggregate?: 'triangleCount' | 'points',
): unknown {
  const entries = array(value).filter(isRecord);
  const total = entries.reduce(
    (sum, entry) =>
      sum +
      (aggregate === 'triangleCount'
        ? number(entry.triangleCount)
        : aggregate === 'points'
          ? array(entry.points).length
          : 0),
    0,
  );
  return {
    count: entries.length,
    ...(aggregate === 'triangleCount' ? { triangles: total } : {}),
    ...(aggregate === 'points' ? { points: total } : {}),
    owners: unique(entries.map((entry) => String(entry.ownerEntityId))),
    targets: unique(
      entries.flatMap((entry) => array(entry.semanticTargetIds).map(String)),
    ),
  };
}

/**
 * Handles trace contract in the scripts parallel compilation flow.
 */
function traceContract(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const {
    timestampMs: _timestamp,
    elapsedMs: _elapsed,
    cpuMs: _cpu,
    ...stable
  } = value;
  return stable;
}

/**
 * Returns whether the input meets the `error trace` condition.
 */
function isErrorTrace(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === 'op-error' || value.kind === 'build-error')
  );
}

/**
 * Handles buffer contract in the scripts parallel compilation flow.
 */
function bufferContract(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const data = String(value.dataBase64 ?? '');
  return {
    name: value.name,
    byteLength: Buffer.from(data, 'base64').byteLength,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

/**
 * Removes duplicate values while preserving their first occurrence.
 */
function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Handles array in the scripts parallel compilation flow.
 */
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Handles number array in the scripts parallel compilation flow.
 */
function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'number')
    : [];
}

/**
 * Handles number in the scripts parallel compilation flow.
 */
function number(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
