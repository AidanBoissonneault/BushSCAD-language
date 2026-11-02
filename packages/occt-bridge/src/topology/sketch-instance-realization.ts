/**
 * @author Aidan Boissonneault
 * @file sketch-instance-realization.ts
 * @purpose Provides sketch instance realization behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionSketchInstance,
  InteractionSnapshot,
  SketchInstanceTransform,
} from '@bushscad/ir';
import type { BuiltPart, OC } from '../bridge/bridge-types.js';
import { makeWorkplaneAxis } from '../core/geometry-utils.js';
import { ax2Axes } from './frame-utils.js';

/** Resolves evaluator placement intent through the same final OCCT label maps. */
export function realizeInteractionSketchInstances(
  oc: OC,
  parts: readonly BuiltPart[],
  snapshot: InteractionSnapshot | undefined,
): InteractionSnapshot | undefined {
  if (!snapshot?.sketchInstances) return snapshot;
  return {
    ...snapshot,
    sketchInstances: snapshot.sketchInstances.map((instance) =>
      realizeInstance(oc, parts, instance),
    ),
  };
}

/**
 * Handles realize instance in the topology flow.
 */
function realizeInstance(
  oc: OC,
  parts: readonly BuiltPart[],
  instance: InteractionSketchInstance,
): InteractionSketchInstance {
  const part = parts.find(
    (candidate) => candidate.group.name === instance.partName,
  );
  if (!part) {
    return {
      ...instance,
      unsupportedReason: `Sketch part '${instance.partName}' was not realized.`,
    };
  }

  let axis: OC | null = null;
  try {
    axis = instance.placement
      ? part.labelMap.resolveAxis(oc, instance.placement)
      : makeWorkplaneAxis(oc, instance.workplane);
    const axes = ax2Axes(axis);
    const offset = instance.localOffsetZ ?? 0;
    const point: [number, number, number] = [
      axes.point[0] + axes.z[0] * offset,
      axes.point[1] + axes.z[1] * offset,
      axes.point[2] + axes.z[2] * offset,
    ];
    return { ...instance, transform: transformFromAxes(axes, point) };
  } catch (error) {
    return {
      ...instance,
      unsupportedReason:
        instance.unsupportedReason ??
        `Sketch placement could not be realized: ${errorMessage(error)}`,
    };
  } finally {
    axis?.delete?.();
  }
}

/**
 * Handles transform from axes in the topology flow.
 */
function transformFromAxes(
  axes: ReturnType<typeof ax2Axes>,
  point: readonly [number, number, number],
): SketchInstanceTransform {
  return [
    axes.x[0],
    axes.x[1],
    axes.x[2],
    0,
    axes.y[0],
    axes.y[1],
    axes.y[2],
    0,
    axes.z[0],
    axes.z[1],
    axes.z[2],
    0,
    point[0],
    point[1],
    point[2],
    1,
  ];
}

/**
 * Converts the supplied value into readable error text.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
