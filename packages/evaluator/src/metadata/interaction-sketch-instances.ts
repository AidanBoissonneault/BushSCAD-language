/**
 * @author Aidan Boissonneault
 * @file interaction-sketch-instances.ts
 * @purpose Provides interaction sketch instances behavior for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import {
  interactionId,
  type InteractionSketchDefinition,
  type InteractionSketchInstance,
  type IROp,
  type IRPlacement,
  type IRSketch,
  type Workplane,
} from '@bushscad/ir';
import type { InteractionDeclarationSource } from './interaction-declarations.js';
import { interactionDeclarationSource } from './interaction-declarations.js';
import type { MutableInteractionEntity } from './interaction-entities.js';

/**
 * Record of sketch, including definition and op.
 */
type SketchRecord = {
  definition: InteractionSketchDefinition;
  op: IRSketch;
};

/** Builds reusable sketch definitions and all concrete evaluated placements. */
export function buildInteractionSketchInstances(
  entrypoint: string,
  ops: readonly IROp[],
  entities: readonly MutableInteractionEntity[],
  declarations: readonly InteractionDeclarationSource[],
  workplane: Workplane,
): {
  definitions: InteractionSketchDefinition[];
  instances: InteractionSketchInstance[];
} {
  const definitions = new Map<string, InteractionSketchDefinition>();
  const instances = new Map<string, InteractionSketchInstance>();
  const sketches = new Map<string, SketchRecord>();
  let partName = '__default__';
  let partEntityId = partId(entities, partName);

  for (const op of ops) {
    if (op.kind === 'part') {
      partName = op.name;
      partEntityId = partId(entities, partName);
      continue;
    }
    if (op.kind === 'sketch') {
      const source = interactionDeclarationSource(op.span, declarations);
      const entityIds = sketchEntityIds(entities, op, partEntityId);
      const signature = primitiveHash(op.primitive);
      const id = interactionId(
        'sketch-definition',
        entrypoint,
        source.span,
        'sketch',
        signature,
      );
      const existing = definitions.get(id);
      const definition: InteractionSketchDefinition = existing
        ? {
            ...existing,
            entityIds: [...new Set([...existing.entityIds, ...entityIds])],
          }
        : {
            id,
            entityIds,
            name: op.name,
            sourceSpan: source.span,
            revision: 1,
            primitive: op.primitive,
          };
      definitions.set(id, definition);
      sketches.set(scoped(partName, op.name), { definition, op });
      continue;
    }

    for (const use of sketchUses(op)) {
      const sketch = sketches.get(scoped(partName, use.name));
      if (!sketch) continue;
      addInstance(instances, entrypoint, sketch, {
        partName,
        partEntityId,
        sourceSpan: op.span,
        placement: use.placement ?? sketch.op.placement,
        workplane,
        localOffsetZ: use.localOffsetZ,
        unsupportedReason: sketchUnsupportedReason(sketch.op, op),
      });
    }
  }

  for (const [key, sketch] of sketches) {
    const owner = key.slice(0, key.indexOf('\u0000'));
    addInstance(instances, entrypoint, sketch, {
      partName: owner,
      partEntityId: partId(entities, owner),
      sourceSpan: sketch.op.span,
      placement: sketch.op.placement,
      workplane,
      unsupportedReason: sketchUnsupportedReason(sketch.op),
    });
  }

  return {
    definitions: [...definitions.values()],
    instances: [...instances.values()],
  };
}

/**
 * Type used for input for instance.
 */
type InstanceInput = Omit<
  InteractionSketchInstance,
  'id' | 'definitionId' | 'entityIds'
>;

/**
 * Adds instance to its owning collection.
 */
function addInstance(
  instances: Map<string, InteractionSketchInstance>,
  entrypoint: string,
  sketch: SketchRecord,
  input: InstanceInput,
): void {
  const placementKey = JSON.stringify([
    input.partName,
    input.placement,
    input.localOffsetZ ?? 0,
  ]);
  const key = `${sketch.definition.id}:${placementKey}`;
  if (instances.has(key)) return;
  instances.set(key, {
    ...input,
    id: interactionId(
      'sketch-instance',
      entrypoint,
      input.sourceSpan,
      sketch.definition.name,
      primitiveHash(placementKey),
    ),
    definitionId: sketch.definition.id,
    entityIds: sketch.definition.entityIds,
  });
}

/**
 * Handles sketch uses in the metadata flow.
 */
function sketchUses(op: IROp): Array<{
  name: string;
  placement?: IRPlacement | null;
  localOffsetZ?: number;
}> {
  switch (op.kind) {
    case 'extrude':
    case 'radial_extrude':
      return [{ name: op.sketchName, placement: op.from }];
    case 'cut':
    case 'radial_cut':
    case 'sweep_cut':
      return [{ name: op.sketchName, placement: op.from }];
    case 'revolve':
    case 'sweep':
      return [{ name: op.sketchName }];
    case 'loft': {
      const divisor = Math.max(1, op.sketchNames.length - 1);
      return op.sketchNames.map((name, index) => ({
        name,
        localOffsetZ: (op.height * index) / divisor,
      }));
    }
    default:
      return [];
  }
}

/**
 * Handles sketch unsupported reason in the metadata flow.
 */
function sketchUnsupportedReason(
  sketch: IRSketch,
  consumer?: IROp,
): string | undefined {
  const placement = sketch.surfaceBound ?? sketch.placement;
  const wrapped =
    (consumer && 'wrap' in consumer && consumer.wrap === true) ||
    placement?.surfaceAngleDeg !== undefined ||
    placement?.faceRef.includes('.curved');
  return wrapped
    ? 'Wrapped curved-surface sketch overlays are not yet represented exactly.'
    : undefined;
}

/**
 * Handles sketch entity ids in the metadata flow.
 */
function sketchEntityIds(
  entities: readonly MutableInteractionEntity[],
  op: IRSketch,
  ownerId: string,
): string[] {
  return entities
    .filter(
      (entity) =>
        entity.kind === 'sketch' &&
        entity.name === op.name &&
        entity.ownerId === ownerId,
    )
    .map((entity) => entity.id);
}

/**
 * Handles part ID in the metadata flow.
 */
function partId(
  entities: readonly MutableInteractionEntity[],
  name: string,
): string {
  return (
    entities.find((entity) => entity.kind === 'part' && entity.name === name)
      ?.id ?? `unlinked-part:${name}`
  );
}

/**
 * Handles scoped in the metadata flow.
 */
function scoped(partName: string, sketchName: string): string {
  return `${partName}\u0000${sketchName}`;
}

/**
 * Builds the primitive data required by the current operation.
 */
function primitiveHash(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
